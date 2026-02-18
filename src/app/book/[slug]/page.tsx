import { supabaseAdmin } from "@/lib/supabase";
import type { EventType, SiteSettings } from "@/lib/types";
import BookingClient from "./BookingClient";
import { notFound } from "next/navigation";

// ISR: revalidate every 60 seconds
export const revalidate = 60;

const DEFAULT_SETTINGS: SiteSettings = {
  company_name: "Slotly",
  logo_url: null,
  primary_color: "#4f46e5",
  accent_color: "#3b82f6",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookingPage({ params }: PageProps) {
  const { slug } = await params;

  // Fetch event type and settings in parallel on the server
  const [eventType, settings] = await Promise.all([
    getEventType(slug),
    getSettings(),
  ]);

  if (!eventType) {
    notFound();
  }

  return <BookingClient eventType={eventType} settings={settings} slug={slug} />;
}

async function getEventType(slug: string): Promise<EventType | null> {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select(
        "id, slug, title, description, duration_minutes, color, is_active, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings"
      )
      .eq("slug", slug)
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
