import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { badRequest, notFound, serverError } from "@/lib/api-errors";
import { NextResponse } from "next/server";

/**
 * GET /api/manage/[token] — Fetch booking details by manage token
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return badRequest("Invalid booking link");
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
      event_types ( id, slug, title, duration_minutes, color, max_advance_days ),
      team_members ( id, name )
    `)
    .eq("manage_token", token)
    .single();

  if (error) {
    // Distinguish between "not found" and actual DB errors
    if (error.code === "PGRST116") {
      return notFound("Booking");
    }
    return serverError("Unable to load booking details. Please try again.", error, "Manage token lookup");
  }

  if (!booking) {
    return notFound("Booking");
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
