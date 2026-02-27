import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendCancellationEmails } from "@/lib/email";
import {
  badRequest,
  notFound,
  serverError,
  successWithWarnings,
  classifyGoogleError,
} from "@/lib/api-errors";

/**
 * POST /api/manage/[token]/cancel — Cancel a booking
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return badRequest("Invalid booking link");
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
      event_types ( id, title, duration_minutes ),
      team_members ( id, name, email, google_calendar_id, google_oauth_refresh_token )
    `)
    .eq("manage_token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return notFound("Booking");
    }
    return serverError("Unable to load booking. Please try again.", error, "Cancel lookup");
  }

  if (!booking) {
    return notFound("Booking");
  }

  if (booking.status === "cancelled") {
    return badRequest("This booking has already been cancelled.");
  }

  const teamMember = booking.team_members as any;
  const eventType = booking.event_types as any;

  // 1. Update booking status
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);

  if (updateError) {
    return serverError("Failed to cancel booking. Please try again.", updateError, "Cancel update");
  }

  // Track partial failures
  let calendarSynced = true;
  let emailSent = true;

  // 2. Delete Google Calendar event
  if (booking.google_event_id && teamMember?.google_calendar_id) {
    try {
      await deleteCalendarEvent(booking.google_event_id, teamMember.google_calendar_id, teamMember.google_oauth_refresh_token || undefined);
    } catch (err) {
      calendarSynced = false;
      const classified = classifyGoogleError(err);
      console.error(`[Cancel] Calendar delete failed (${classified.type}):`, err instanceof Error ? err.message : err);
    }
  }

  // 3. Send cancellation emails
  try {
    await sendCancellationEmails({
      inviteeName: booking.invitee_name,
      inviteeEmail: booking.invitee_email,
      teamMemberName: teamMember?.name || "Team member",
      teamMemberEmail: teamMember?.email || "",
      eventTitle: eventType?.title || "Meeting",
      durationMinutes: eventType?.duration_minutes || 30,
      startTime: booking.start_time,
      endTime: booking.end_time,
      timezone: booking.timezone,
      cancelledBy: "invitee",
    });
  } catch (err) {
    emailSent = false;
    console.error("[Cancel] Email send failed:", err instanceof Error ? err.message : err);
  }

  return successWithWarnings(
    { success: true },
    { calendar_synced: calendarSynced, email_sent: emailSent }
  );
}
