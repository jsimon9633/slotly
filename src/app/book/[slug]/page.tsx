import { supabaseAdmin } from "@/lib/supabase";
import type { SiteSettings } from "@/lib/types";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

/**
 * Unified route: /book/[slug]
 *
 * Handles two cases:
 * 1. Team slug → shows team landing page with event types
 * 2. Event type slug → redirects to /book/[teamSlug]/[eventSlug]
 */

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

export default async function BookSlugPage({ params }: PageProps) {
  const { slug } = await params;

  // 1. Check if this is a team slug
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (team) {
    // Render team landing page
    const [eventTypes, settings] = await Promise.all([
      getTeamEventTypes(team.id),
      getSettings(),
    ]);

    return (
      <div className="min-h-screen bg-[#fafbfc]">
        <header className="max-w-2xl mx-auto flex items-center justify-between px-4 sm:px-5 pt-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div
              className="w-7 h-7 rounded-lg grid place-items-center text-white text-xs font-bold"
              style={{ backgroundColor: settings.primary_color }}
            >
              {settings.company_name.charAt(0)}
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              {settings.company_name}
            </span>
          </Link>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-5 pt-6 pb-12">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
              {team.name}
            </h1>
            {team.description && (
              <p className="text-gray-500 text-sm sm:text-base">
                {team.description}
              </p>
            )}
            <p className="text-gray-400 text-sm mt-2">
              Choose a meeting type to get started.
            </p>
          </div>

          {eventTypes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No event types available for this team.
            </div>
          ) : (
            <div className="space-y-3">
              {eventTypes.map((et) => (
                <Link
                  key={et.id}
                  href={`/book/${slug}/${et.slug}`}
                  className="block w-full p-4 sm:p-5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: et.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {et.title}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {et.duration_minutes} minutes
                        {et.description && ` · ${et.description}`}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // 2. Not a team — check if it's an event type slug (legacy redirect)
  const { data: eventType } = await supabaseAdmin
    .from("event_types")
    .select("slug, team_id, teams!inner ( slug )")
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!eventType) {
    notFound();
  }

  const teamSlug = (eventType as any).teams?.slug || "default";
  redirect(`/book/${teamSlug}/${slug}`);
}

async function getTeamEventTypes(teamId: string) {
  try {
    const { data } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, title, description, duration_minutes, color")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("duration_minutes", { ascending: true });
    return data || [];
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
