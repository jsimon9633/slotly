import { supabaseAdmin } from "@/lib/supabase";
import type { EventType, SiteSettings } from "@/lib/types";
import BookingClient from "./BookingClient";
import { notFound } from "next/navigation";

// ISR: revalidate every 60 seconds
export const revalidate = 60;

// Pre-render known booking pages at build time → served from CDN, zero cold start
export async function generateStaticParams() {
  try {
    // Fetch event types with their teams (left join — includes unassigned)
    const { data } = await supabaseAdmin
      .from("event_types")
      .select("slug, team_id, teams ( slug )")
      .eq("is_active", true);

    if (!data) return [];

    // For unassigned event types, use the first active team's slug as default
    const { data: firstTeam } = await supabaseAdmin
      .from("teams")
      .select("slug")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const defaultSlug = firstTeam?.slug || "default";

    return data.map((et: any) => ({
      slug: et.teams?.slug || defaultSlug,
      eventSlug: et.slug,
    }));
  } catch {
    return [];
  }
}

const DEFAULT_SETTINGS: SiteSettings = {
  company_name: "Slotly",
  logo_url: null,
  primary_color: "#4f46e5",
  accent_color: "#3b82f6",
};

interface PageProps {
  params: Promise<{ slug: string; eventSlug: string }>;
}

export default async function BookingPage({ params }: PageProps) {
  const { slug: teamSlug, eventSlug } = await params;

  // Validate team exists
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name, slug")
    .eq("slug", teamSlug)
    .eq("is_active", true)
    .single();

  // Fetch settings in parallel
  const settings = await getSettings();

  if (team) {
    // Try team-scoped lookup first
    const eventType = await getEventType(eventSlug, team.id);
    if (eventType) {
      return (
        <BookingClient
          eventType={eventType}
          settings={settings}
          slug={eventSlug}
          teamSlug={teamSlug}
          teamName={team.name}
        />
      );
    }

    // Fallback: event type might be unassigned (team_id is null) but linked from this team's page
    const unassigned = await getUnassignedEventType(eventSlug);
    if (unassigned) {
      return (
        <BookingClient
          eventType={unassigned}
          settings={settings}
          slug={eventSlug}
          teamSlug={teamSlug}
          teamName={team.name}
        />
      );
    }
  } else {
    // Team slug doesn't match any team — try finding event type directly (unassigned)
    const unassigned = await getUnassignedEventType(eventSlug);
    if (unassigned) {
      return (
        <BookingClient
          eventType={unassigned}
          settings={settings}
          slug={eventSlug}
          teamSlug={teamSlug}
          teamName=""
        />
      );
    }
  }

  notFound();
}

async function getEventType(slug: string, teamId: string): Promise<EventType | null> {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select(
        "id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id"
      )
      .eq("slug", slug)
      .eq("team_id", teamId)
      .eq("is_active", true)
      .limit(1)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

async function getUnassignedEventType(slug: string): Promise<EventType | null> {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select(
        "id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id"
      )
      .eq("slug", slug)
      .is("team_id", null)
      .eq("is_active", true)
      .limit(1)
      .single();
    return data || null;
  } catch {
    return null;
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
