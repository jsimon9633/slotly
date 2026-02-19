import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serverError } from "@/lib/api-errors";

/**
 * GET /api/teams — Public endpoint returning active teams with event type counts.
 */
export async function GET() {
  const { data: teams, error } = await supabaseAdmin
    .from("teams")
    .select("id, name, slug, description, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return serverError("Unable to load teams.", error, "Teams GET");
  }

  // Fetch join table for many-to-many associations
  const { data: links } = await supabaseAdmin
    .from("team_event_types")
    .select("team_id, event_type_id");

  const teamToEtIds: Record<string, string[]> = {};
  for (const link of links || []) {
    if (!teamToEtIds[link.team_id]) teamToEtIds[link.team_id] = [];
    teamToEtIds[link.team_id].push(link.event_type_id);
  }

  const enriched = (teams || []).map((team: any) => ({
    ...team,
    event_type_ids: teamToEtIds[team.id] || [],
    event_type_count: (teamToEtIds[team.id] || []).length,
  }));

  return NextResponse.json(enriched);
}
