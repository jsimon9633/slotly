import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { sendRescheduleEmails } from "@/lib/email";
import { addMinutes, parseISO } from "date-fns";
import {
  badRequest,
  notFound,
  serverError,
  successWithWarnings,
  classifyGoogleError,
  validateTimezone,
} from "@/lib/api-errors";

/**
 * POST /api/manage/[token]/reschedule — Reschedule a booking to a new time
 * Body: { startTime: string (ISO), timezone: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return badRequest("Invalid booking link");
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { startTime, timezone } = body;

  if (!startTime || !timezone) {
    return badRequest("Please select a new date and time.");
  }

  if (typeof startTime !== "string" || typeof timezone !== "string") {
    return badRequest("Invalid request format");
  }

  // Validate timezone
  if (!validateTimezone(timezone)) {
    return badRequest("Invalid timezone. Please select a valid timezone.");
  }

  const newStart = parseISO(startTime);
  if (isNaN(newStart.getTime())) {
    return badRequest("Invalid start time");
  }

  // Don't allow rescheduling to the past
  if (newStart.getTime() < Date.now() - 60000) {
    return badRequest("Cannot reschedule to a time in the past.");
  }

  // Don't allow rescheduling too far in the future (90 days)
  const maxFuture = Date.now() + 90 * 24 * 60 * 60 * 1000;
  if (newStart.getTime() > maxFuture) {
    return badRequest("Cannot reschedule more than 90 days ahead.");
  }

  // Fetch full booking with relations
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      invitee_name,
      invitee_email,
      invitee_notes,
      start_time,
      end_time,
      timezone,
      status,
      google_event_id,
      manage_token,
      event_types ( id, slug, title, duration_minutes ),
      team_members ( id, name, email, google_calendar_id )
    `)
    .eq("manage_token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return notFound("Booking");
    }
    return serverError("Unable to load booking. Please try again.", error, "Reschedule lookup");
  }

  if (!booking) {
    return notFound("Booking");
  }

  if (booking.status === "cancelled") {
    return badRequest("Cannot reschedule a cancelled booking.");
  }

  const teamMember = booking.team_members as any;
  const eventType = booking.event_types as any;
  const durationMinutes = eventType?.duration_minutes || 30;
  const newEnd = addMinutes(newStart, durationMinutes);

  const oldStartTime = booking.start_time;
  const oldEndTime = booking.end_time;

  // 1. Update booking in DB
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      timezone,
    })
    .eq("id", booking.id);

  if (updateError) {
    return serverError("Failed to reschedule booking. Please try again.", updateError, "Reschedule update");
  }

  // Track partial failures
  let calendarSynced = true;
  let emailSent = true;

  // 2. Update Google Calendar event
  if (booking.google_event_id && teamMember?.google_calendar_id) {
    try {
      await updateCalendarEvent({
        googleEventId: booking.google_event_id,
        calendarId: teamMember.google_calendar_id,
        summary: `${eventType?.title || "Meeting"} with ${booking.invitee_name}`,
        description: `Booked via Slotly (rescheduled)\n\nInvitee: ${booking.invitee_name}${booking.invitee_notes ? `\nNotes: ${booking.invitee_notes}` : ""}`,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        attendeeEmail: booking.invitee_email,
        timezone,
      });
    } catch (err) {
      calendarSynced = false;
      const classified = classifyGoogleError(err);
      console.error(`[Reschedule] Calendar update failed (${classified.type}):`, err instanceof Error ? err.message : err);
    }
  }

  // 3. Send reschedule emails
  try {
    await sendRescheduleEmails({
      inviteeName: booking.invitee_name,
      inviteeEmail: booking.invitee_email,
      teamMemberName: teamMember?.name || "Team member",
      teamMemberEmail: teamMember?.email || "",
      eventTitle: eventType?.title || "Meeting",
      durationMinutes,
      oldStartTime,
      oldEndTime,
      newStartTime: newStart.toISOString(),
      newEndTime: newEnd.toISOString(),
      timezone,
      manageToken: booking.manage_token,
    });
  } catch (err) {
    emailSent = false;
    console.error("[Reschedule] Email send failed:", err instanceof Error ? err.message : err);
  }

  return successWithWarnings(
    {
      success: true,
      booking: {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      },
    },
    { calendar_synced: calendarSynced, email_sent: emailSent }
  );
}
