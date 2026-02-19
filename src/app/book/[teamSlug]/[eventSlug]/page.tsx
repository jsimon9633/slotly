import { supabaseAdmin } from "@/lib/supabase";
import type { EventType, SiteSettings } from "@/lib/types";
import BookingClient from "./BookingClient";
import { notFound } from "next/navigation";

// ISR: revalidate every 60 seconds
export const revalidate = 60;

// Pre-render known booking pages at build time → served from CDN, zero cold start
export async function generateStaticParams() {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select("slug, teams!inner ( slug )")
      .eq("is_active", true);

    if (!data) return [];

    return data.map((et: any) => ({
      teamSlug: et.teams?.slug || "default",
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
  params: Promise<{ teamSlug: string; eventSlug: string }>;
}

export default async function BookingPage({ params }: PageProps) {
  const { teamSlug, eventSlug } = await params;

  // Validate team exists
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name, slug")
    .eq("slug", teamSlug)
    .eq("is_active", true)
    .single();

  if (!team) {
    notFound();
  }

  // Fetch event type (scoped to team) and settings in parallel
  const [eventType, settings] = await Promise.all([
    getEventType(eventSlug, team.id),
    getSettings(),
  ]);

  if (!eventType) {
    notFound();
  }

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
