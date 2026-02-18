import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createCalendarEvent } from "@/lib/google-calendar";
import { sendBookingEmails } from "@/lib/email";
import { addMinutes, parseISO } from "date-fns";

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

// Validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 254;

function sanitizeString(str: string, maxLen: number): string {
  return str.trim().slice(0, maxLen);
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many booking requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { eventTypeSlug, startTime, timezone, name, email, notes } = body;

  // Validate required fields
  if (!eventTypeSlug || !startTime || !timezone || !name || !email) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Validate types
  if (
    typeof eventTypeSlug !== "string" ||
    typeof startTime !== "string" ||
    typeof timezone !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string"
  ) {
    return NextResponse.json({ error: "Invalid field types" }, { status: 400 });
  }

  // Validate & sanitize inputs
  const cleanName = sanitizeString(name, MAX_NAME_LENGTH);
  const cleanEmail = sanitizeString(email, MAX_EMAIL_LENGTH).toLowerCase();
  const cleanNotes = notes ? sanitizeString(String(notes), MAX_NOTES_LENGTH) : null;

  if (!cleanName || cleanName.length < 2) {
    return NextResponse.json({ error: "Name is too short" }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(eventTypeSlug)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  // Validate timezone
  if (!/^[A-Za-z_/]+$/.test(timezone)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  // Validate startTime is a valid ISO date
  const parsedStart = parseISO(startTime);
  if (isNaN(parsedStart.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }

  // Prevent booking in the past
  if (parsedStart.getTime() < Date.now() - 60000) {
    return NextResponse.json({ error: "Cannot book in the past" }, { status: 400 });
  }

  // Prevent booking too far in the future (90 days)
  const maxFuture = Date.now() + 90 * 24 * 60 * 60 * 1000;
  if (parsedStart.getTime() > maxFuture) {
    return NextResponse.json({ error: "Cannot book more than 90 days ahead" }, { status: 400 });
  }

  try {
    // Get event type — only needed fields
    const { data: eventType } = await supabaseAdmin
      .from("event_types")
      .select("id, title, duration_minutes")
      .eq("slug", eventTypeSlug)
      .eq("is_active", true)
      .single();

    if (!eventType) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    // Round-robin: pick the team member who was booked least recently
    // Only fetch fields we actually need
    const { data: teamMember } = await supabaseAdmin
      .from("team_members")
      .select("id, name, email, google_calendar_id")
      .eq("is_active", true)
      .order("last_booked_at", { ascending: true })
      .limit(1)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: "No team members available" }, { status: 500 });
    }

    const start = parsedStart;
    const end = addMinutes(start, eventType.duration_minutes);

    // Create Google Calendar event
    let googleEventId: string | null = null;
    try {
      googleEventId = await createCalendarEvent({
        calendarId: teamMember.google_calendar_id,
        summary: `${eventType.title} with ${cleanName}`,
        description: `Booked via Slotly\n\nInvitee: ${cleanName}${cleanNotes ? `\nNotes: ${cleanNotes}` : ""}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        attendeeEmail: cleanEmail,
        timezone,
      });
    } catch (calErr: any) {
      // Log error without exposing sensitive details
      console.error("Calendar event creation failed for booking");
    }

    // Save booking to database
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        event_type_id: eventType.id,
        team_member_id: teamMember.id,
        invitee_name: cleanName,
        invitee_email: cleanEmail,
        invitee_notes: cleanNotes,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        timezone,
        status: "confirmed",
        google_event_id: googleEventId,
      })
      .select("id, start_time, end_time")
      .single();

    if (bookingError) {
      console.error("Booking save failed");
      return NextResponse.json({ error: "Failed to save booking" }, { status: 500 });
    }

    // Update round-robin: mark this team member as most recently booked
    await supabaseAdmin
      .from("team_members")
      .update({ last_booked_at: new Date().toISOString() })
      .eq("id", teamMember.id);

    // Send confirmation + team member alert emails
    // Must await in serverless — Lambda freezes after response is sent
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
      });
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
      // Don't block booking — emails are best-effort
    }

    // Return minimal confirmation — no internal IDs, no emails
    return NextResponse.json({
      success: true,
      calendar_event_created: !!googleEventId,
      booking: {
        start_time: booking.start_time,
        end_time: booking.end_time,
        team_member_name: teamMember.name.split(" ")[0], // First name only
        event_type: eventType.title,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
