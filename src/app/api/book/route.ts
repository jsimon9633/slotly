import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createCalendarEvent } from "@/lib/google-calendar";
import { addMinutes, parseISO } from "date-fns";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { eventTypeSlug, startTime, timezone, name, email, notes } = body;

  // Validate required fields
  if (!eventTypeSlug || !startTime || !timezone || !name || !email) {
    return NextResponse.json(
      { error: "Missing required fields: eventTypeSlug, startTime, timezone, name, email" },
      { status: 400 }
    );
  }

  try {
    // Get event type
    const { data: eventType } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("slug", eventTypeSlug)
      .single();

    if (!eventType) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    // Round-robin: pick the team member who was booked least recently
    const { data: teamMember } = await supabaseAdmin
      .from("team_members")
      .select("*")
      .eq("is_active", true)
      .order("last_booked_at", { ascending: true })
      .limit(1)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: "No team members available" }, { status: 500 });
    }

    const start = parseISO(startTime);
    const end = addMinutes(start, eventType.duration_minutes);

    // Create Google Calendar event
    let googleEventId: string | null = null;
    try {
      googleEventId = await createCalendarEvent({
        calendarId: teamMember.google_calendar_id,
        summary: `${eventType.title} with ${name}`,
        description: `Booked via Slotly\n\nInvitee: ${name} (${email})${notes ? `\nNotes: ${notes}` : ""}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        attendeeEmail: email,
        timezone,
      });
    } catch (calErr) {
      console.error("Google Calendar error:", calErr);
      // Continue without calendar event — still save booking
    }

    // Save booking to database
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        event_type_id: eventType.id,
        team_member_id: teamMember.id,
        invitee_name: name,
        invitee_email: email,
        invitee_notes: notes || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        timezone,
        status: "confirmed",
        google_event_id: googleEventId,
      })
      .select()
      .single();

    if (bookingError) {
      console.error("Booking save error:", bookingError);
      return NextResponse.json({ error: "Failed to save booking" }, { status: 500 });
    }

    // Update round-robin: mark this team member as most recently booked
    await supabaseAdmin
      .from("team_members")
      .update({ last_booked_at: new Date().toISOString() })
      .eq("id", teamMember.id);

    // TODO: Send confirmation email via Resend
    // Skipping for POC — Google Calendar invite serves as confirmation

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        team_member_name: teamMember.name,
        event_type: eventType.title,
      },
    });
  } catch (err) {
    console.error("Booking error:", err);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
