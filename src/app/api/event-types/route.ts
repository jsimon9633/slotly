import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serverError } from "@/lib/api-errors";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, description, duration_minutes, color, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, meeting_type")
    .eq("is_active", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    return serverError("Unable to load event types. Please try again.", error, "Event types GET");
  }

  // Fetch join table for many-to-many team associations
  const { data: links } = await supabaseAdmin
    .from("team_event_types")
    .select("event_type_id, team_id");

  const etToTeams: Record<string, string[]> = {};
  for (const link of links || []) {
    if (!etToTeams[link.event_type_id]) etToTeams[link.event_type_id] = [];
    etToTeams[link.event_type_id].push(link.team_id);
  }

  const enriched = (data || []).map((et: any) => ({
    ...et,
    team_ids: etToTeams[et.id] || [],
  }));

  return NextResponse.json(enriched);
}
