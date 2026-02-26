import { supabaseAdmin } from "@/lib/supabase";
import type { EventType, SiteSettings } from "@/lib/types";
import BookingClient from "./BookingClient";
import { notFound } from "next/navigation";

// ISR: revalidate every 60 seconds
export const revalidate = 60;

// Pre-render known booking pages at build time → served from CDN, zero cold start
export async function generateStaticParams() {
  try {
    const { data: eventTypes } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, team_id")
      .eq("is_active", true);

    if (!eventTypes) return [];

    // Get all join table links and team slugs in parallel
    const [{ data: links }, { data: teams }] = await Promise.all([
      supabaseAdmin.from("team_event_types").select("event_type_id, team_id"),
      supabaseAdmin.from("teams").select("id, slug").eq("is_active", true),
    ]);

    const teamSlugMap = new Map((teams || []).map((t: any) => [t.id, t.slug]));
    const defaultSlug = teams?.[0]?.slug || "default";

    // Build event_type_id → team_ids map from join table
    const etToTeams: Record<string, string[]> = {};
    for (const link of links || []) {
      if (!etToTeams[link.event_type_id]) etToTeams[link.event_type_id] = [];
      etToTeams[link.event_type_id].push(link.team_id);
    }

    const params: { slug: string; eventSlug: string }[] = [];
    for (const et of eventTypes) {
      // Collect all team IDs for this event type (direct + join table)
      const teamIds = new Set<string>();
      if (et.team_id) teamIds.add(et.team_id);
      for (const tid of etToTeams[et.id] || []) teamIds.add(tid);

      if (teamIds.size === 0) {
        params.push({ slug: defaultSlug, eventSlug: et.slug });
      } else {
        for (const tid of teamIds) {
          const tSlug = teamSlugMap.get(tid);
          if (tSlug) params.push({ slug: tSlug, eventSlug: et.slug });
        }
      }
    }

    return params;
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
    const { data: eventType } = await supabaseAdmin
      .from("event_types")
      .select(
        "id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id, booking_questions"
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!eventType) return null;

    // Check if linked to this team via direct team_id or join table
    if (eventType.team_id === teamId) return eventType;

    const { data: link } = await supabaseAdmin
      .from("team_event_types")
      .select("event_type_id")
      .eq("team_id", teamId)
      .eq("event_type_id", eventType.id)
      .limit(1)
      .maybeSingle();

    return link ? eventType : null;
  } catch {
    return null;
  }
}

async function getUnassignedEventType(slug: string): Promise<EventType | null> {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select(
        "id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id, booking_questions"
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
