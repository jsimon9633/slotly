import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/manage/[token] — Fetch booking details by manage token
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      invitee_name,
      invitee_email,
      start_time,
      end_time,
      timezone,
      status,
      invitee_notes,
      event_types ( id, slug, title, duration_minutes, color ),
      team_members ( id, name )
    `)
    .eq("manage_token", token)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      invitee_name: booking.invitee_name,
      start_time: booking.start_time,
      end_time: booking.end_time,
      timezone: booking.timezone,
      status: booking.status,
      event_type: booking.event_types,
      team_member_name: (booking.team_members as any)?.name || "Team member",
    },
  });
}
