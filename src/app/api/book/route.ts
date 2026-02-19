import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { createCalendarEvent } from "@/lib/google-calendar";
import { sendBookingEmails } from "@/lib/email";
import { fireWebhooks } from "@/lib/webhooks";
import { addMinutes, parseISO, differenceInMinutes } from "date-fns";
import {
  badRequest,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
  successWithWarnings,
  classifyGoogleError,
  validateTimezone,
  sanitizeString,
  EMAIL_REGEX,
} from "@/lib/api-errors";
import { calculateNoShowScore, getRiskTier } from "@/lib/no-show-score";

// Simple in-memory rate limiter (per IP, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // max bookings per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Validation constants
const MAX_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 254;

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return tooManyRequests("Too many booking requests. Please try again later.");
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { eventTypeSlug, teamSlug, startTime, timezone, name, email, phone, notes } = body;

  // Validate required fields
  if (!eventTypeSlug || !startTime || !timezone || !name || !email || !phone) {
    return badRequest("Missing required fields");
  }

  // Validate types
  if (
    typeof eventTypeSlug !== "string" ||
    typeof startTime !== "string" ||
    typeof timezone !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof phone !== "string"
  ) {
    return badRequest("Invalid field types");
  }

  // Validate & sanitize inputs
  const cleanName = sanitizeString(name, MAX_NAME_LENGTH);
  const cleanEmail = sanitizeString(email, MAX_EMAIL_LENGTH).toLowerCase();
  const cleanPhone = phone.replace(/[^\d+\-() ]/g, "").slice(0, 20);
  const cleanNotes = notes ? sanitizeString(String(notes), MAX_NOTES_LENGTH) : null;

  if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 7) {
    return badRequest("Invalid phone number");
  }

  if (!cleanName || cleanName.length < 2) {
    return badRequest("Name is too short");
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return badRequest("Invalid email address");
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(eventTypeSlug)) {
    return badRequest("Invalid event type");
  }

  // Validate timezone using IANA check
  if (!validateTimezone(timezone)) {
    return badRequest("Invalid timezone. Please select a valid timezone.");
  }

  // Validate startTime is a valid ISO date
  const parsedStart = parseISO(startTime);
  if (isNaN(parsedStart.getTime())) {
    return badRequest("Invalid start time");
  }

  // Prevent booking in the past
  if (parsedStart.getTime() < Date.now() - 60000) {
    return badRequest("Cannot book in the past");
  }

  // Prevent booking too far in the future (90 days)
  const maxFuture = Date.now() + 90 * 24 * 60 * 60 * 1000;
  if (parsedStart.getTime() > maxFuture) {
    return badRequest("Cannot book more than 90 days ahead");
  }

  try {
    // Resolve team if teamSlug provided
    let teamId: string | undefined;
    if (teamSlug && typeof teamSlug === "string") {
      if (!/^[a-z0-9-]+$/.test(teamSlug)) {
        return badRequest("Invalid team");
      }
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("slug", teamSlug)
        .eq("is_active", true)
        .single();

      if (!team) {
        return notFound("Team");
      }
      teamId = team.id;
    }

    // Get event type — scope to team if provided
    let etQuery = supabaseAdmin
      .from("event_types")
      .select("id, title, duration_minutes, max_daily_bookings, team_id")
      .eq("slug", eventTypeSlug)
      .eq("is_active", true);

    if (teamId) {
      etQuery = etQuery.eq("team_id", teamId);
    }

    const { data: eventType, error: etError } = await etQuery.single();

    if (etError || !eventType) {
      return notFound("Event type");
    }

    // Use the resolved team_id for round-robin scoping
    const resolvedTeamId = teamId || eventType.team_id;

    // Daily meeting limit check
    if (eventType.max_daily_bookings && eventType.max_daily_bookings > 0) {
      const dayStart = new Date(parsedStart);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(parsedStart);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const { count, error: countError } = await supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", eventType.id)
        .eq("status", "confirmed")
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEnd.toISOString());

      if (countError) {
        return serverError(
          "Unable to check availability. Please try again.",
          countError,
          "Daily limit count query"
        );
      }

      if (count !== null && count >= eventType.max_daily_bookings) {
        return conflict("No more bookings available for this day");
      }
    }

    // Round-robin: pick the team member who was booked least recently (scoped to team)
    const { getNextTeamMember } = await import("@/lib/availability");
    const teamMember = await getNextTeamMember(resolvedTeamId);

    if (!teamMember) {
      return serverError(
        "No team members available to take this booking.",
        null,
        "Team member lookup"
      );
    }

    const start = parsedStart;
    const end = addMinutes(start, eventType.duration_minutes);

    // ── No-Show Risk Score ──
    // Check if this email has booked before (repeat booker)
    const { count: priorBookings } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("invitee_email", cleanEmail)
      .in("status", ["confirmed", "completed"]);

    const isRepeatBooker = (priorBookings ?? 0) > 0;
    const hasTopic = !!cleanNotes && cleanNotes.toLowerCase().includes("topic:");
    const hasNotes = !!cleanNotes && cleanNotes.length > 5;

    // Get hour in the booking's timezone
    let meetingHour = start.getUTCHours();
    try {
      const localTime = new Date(start).toLocaleString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      });
      meetingHour = parseInt(localTime) || meetingHour;
    } catch { /* fallback to UTC hour */ }

    const noShowScore = calculateNoShowScore({
      leadTimeMinutes: differenceInMinutes(start, new Date()),
      dayOfWeek: start.getDay(),
      hourOfDay: meetingHour,
      isRepeatBooker,
      hasTopicFilled: hasTopic,
      hasNotes,
    });
    const riskTier = getRiskTier(noShowScore);

    // Track partial failures for warnings
    let calendarSynced = true;
    let emailSent = true;

    // Create Google Calendar event (with Google Meet)
    let googleEventId: string | null = null;
    let meetLink: string | undefined;
    let meetPhone: string | undefined;
    let meetPin: string | undefined;
    try {
      const calResult = await createCalendarEvent({
        calendarId: teamMember.google_calendar_id,
        summary: `${eventType.title} with ${cleanName}`,
        description: `Booked via Slotly\n\nInvitee: ${cleanName}\nPhone: ${cleanPhone}${cleanNotes ? `\nNotes: ${cleanNotes}` : ""}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        attendeeEmail: cleanEmail,
        timezone,
      });
      googleEventId = calResult.eventId;
      meetLink = calResult.meetLink;
      meetPhone = calResult.meetPhone;
      meetPin = calResult.meetPin;
    } catch (calErr: unknown) {
      calendarSynced = false;
      const classified = classifyGoogleError(calErr);
      console.error(`[Booking] Calendar event creation failed (${classified.type}):`, calErr instanceof Error ? calErr.message : calErr);
    }

    // Generate unique manage token for reschedule/cancel links
    const manageToken = randomUUID();

    // Save booking to database (with no-show risk data)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        event_type_id: eventType.id,
        team_member_id: teamMember.id,
        invitee_name: cleanName,
        invitee_email: cleanEmail,
        invitee_phone: cleanPhone,
        invitee_notes: cleanNotes,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        timezone,
        status: "confirmed",
        google_event_id: googleEventId,
        manage_token: manageToken,
        no_show_score: noShowScore,
        risk_tier: riskTier,
      })
      .select("id, start_time, end_time, manage_token")
      .single();

    if (bookingError || !booking) {
      return serverError(
        "Failed to save your booking. Please try again.",
        bookingError,
        "Booking insert"
      );
    }

    // Update round-robin: mark this team member as most recently booked
    const { error: rrError } = await supabaseAdmin
      .from("team_members")
      .update({ last_booked_at: new Date().toISOString() })
      .eq("id", teamMember.id);

    if (rrError) {
      console.error("[Booking] Round-robin update failed:", rrError.message);
      // Non-blocking — booking is saved, just round-robin tracking is off
    }

    // Send confirmation + team member alert emails
    try {
      await sendBookingEmails({
        inviteeName: cleanName,
        inviteeEmail: cleanEmail,
        teamMemberName: teamMember.name,
        teamMemberEmail: teamMember.email,
        eventTitle: eventType.title,
        durationMinutes: eventType.duration_minutes,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone,
        notes: cleanNotes,
        manageToken,
        meetLink,
        meetPhone,
        meetPin,
      });
    } catch (emailErr) {
      emailSent = false;
      console.error("[Booking] Email send failed:", emailErr instanceof Error ? emailErr.message : emailErr);
    }

    // Fire webhooks (best-effort, don't block response)
    fireWebhooks("booking.created", {
      booking_id: booking.id,
      event_type: eventType.title,
      invitee_name: cleanName,
      invitee_email: cleanEmail,
      invitee_phone: cleanPhone,
      team_member: teamMember.name,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      timezone,
    }).catch((err) => console.error("[Booking] Webhook fire failed:", err instanceof Error ? err.message : err));

    // Return confirmation with partial failure warnings
    return successWithWarnings(
      {
        success: true,
        booking: {
          start_time: booking.start_time,
          end_time: booking.end_time,
          team_member_name: teamMember.name.split(" ")[0],
          event_type: eventType.title,
        },
      },
      {
        calendar_synced: calendarSynced,
        email_sent: emailSent,
      }
    );
  } catch (err) {
    return serverError(
      "Something went wrong while creating your booking. Please try again.",
      err,
      "Booking POST"
    );
  }
}
