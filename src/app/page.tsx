import { supabaseAdmin } from "@/lib/supabase";
import type { EventType, SiteSettings } from "@/lib/types";
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

async function getEventTypes(): Promise<EventType[]> {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select(
        "id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days"
      )
      .eq("is_active", true)
      .order("duration_minutes", { ascending: true });
    return data || [];
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
  const [eventTypes, teamMembers, settings] = await Promise.all([
    getEventTypes(),
    getTeamMembers(),
    getSettings(),
  ]);

  return (
    <HomeClient
      eventTypes={eventTypes}
      teamMembers={teamMembers}
      settings={settings}
    />
  );
}
