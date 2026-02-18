import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { sendCancellationEmails } from "@/lib/email";

/**
 * POST /api/manage/[token]/cancel — Cancel a booking
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
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
      team_members ( id, name, email, google_calendar_id )
    `)
    .eq("manage_token", token)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
  }

  const teamMember = booking.team_members as any;
  const eventType = booking.event_types as any;

  // 1. Update booking status
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }

  // 2. Delete Google Calendar event
  if (booking.google_event_id && teamMember?.google_calendar_id) {
    try {
      await deleteCalendarEvent(booking.google_event_id, teamMember.google_calendar_id);
    } catch (err) {
      console.error("Failed to delete calendar event:", err);
      // Continue — booking is already cancelled in DB
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
    console.error("Failed to send cancellation emails:", err);
  }

  return NextResponse.json({ success: true });
}
