import { supabaseAdmin } from "@/lib/supabase";
import type { EventType, SiteSettings, Team } from "@/lib/types";
import HomeClient from "./HomeClient";

// Default settings fallback
const DEFAULT_SETTINGS: SiteSettings = {
  company_name: "Slotly",
  logo_url: null,
  primary_color: "#4f46e5",
  accent_color: "#3b82f6",
};

// ISR: revalidate every 60 seconds so data stays fresh without rebuilds
export const revalidate = 60;

interface TeamWithEventTypes extends Team {
  event_types: Pick<EventType, "id" | "slug" | "title" | "description" | "duration_minutes" | "color">[];
}

async function getTeamsWithEventTypes(): Promise<TeamWithEventTypes[]> {
  try {
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, slug, description, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!teams || teams.length === 0) return [];

    // Fetch event types for all teams
    const { data: eventTypes } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, title, description, duration_minutes, color, team_id")
      .eq("is_active", true)
      .order("duration_minutes", { ascending: true });

    return teams.map((team) => ({
      ...team,
      event_types: (eventTypes || []).filter((et: any) => et.team_id === team.id),
    }));
  } catch {
    return [];
  }
}

async function getTeamMembers(): Promise<{ id: string; name: string }[]> {
  try {
    const { data } = await supabaseAdmin
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });
    return (data || []).map((m) => ({
      id: m.id,
      name: m.name.split(" ")[0],
    }));
  } catch {
    return [];
  }
}

async function getSettings(): Promise<SiteSettings> {
  try {
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("company_name, logo_url, primary_color, accent_color")
      .limit(1)
      .single();
    return data || DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default async function Home() {
  const [teams, teamMembers, settings] = await Promise.all([
    getTeamsWithEventTypes(),
    getTeamMembers(),
    getSettings(),
  ]);

  // Flatten event types for backward compat with HomeClient
  // (include team_id so HomeClient can build team-scoped URLs)
  const allEventTypes = teams.flatMap((team) =>
    team.event_types.map((et) => ({
      ...et,
      team_id: team.id,
      team_slug: team.slug,
      is_active: true,
      is_locked: false,
      before_buffer_mins: 0,
      after_buffer_mins: 0,
      min_notice_hours: 0,
      max_daily_bookings: null,
      max_advance_days: 10,
    }))
  );

  return (
    <HomeClient
      eventTypes={allEventTypes as any}
      teamMembers={teamMembers}
      settings={settings}
      teams={teams}
    />
  );
}
