import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateCalendarEvent } from "@/lib/google-calendar";
import { sendRescheduleEmails } from "@/lib/email";
import { addMinutes, parseISO } from "date-fns";

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
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { startTime, timezone } = body;

  if (!startTime || !timezone) {
    return NextResponse.json({ error: "Missing startTime or timezone" }, { status: 400 });
  }

  const newStart = parseISO(startTime);
  if (isNaN(newStart.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }

  // Don't allow rescheduling to the past
  if (newStart.getTime() < Date.now() - 60000) {
    return NextResponse.json({ error: "Cannot reschedule to the past" }, { status: 400 });
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

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "Cannot reschedule a cancelled booking" }, { status: 400 });
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
    return NextResponse.json({ error: "Failed to reschedule booking" }, { status: 500 });
  }

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
      console.error("Failed to update calendar event:", err);
      // Continue — booking is already updated in DB
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
    console.error("Failed to send reschedule emails:", err);
  }

  return NextResponse.json({
    success: true,
    booking: {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    },
  });
}
