import { supabaseAdmin } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";

/**
 * Legacy route: /book/[slug]
 *
 * Redirects to the new team-scoped URL: /book/[teamSlug]/[eventSlug]
 * This keeps old links (embeds, emails, bookmarks) working.
 */

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyBookingRedirect({ params }: PageProps) {
  const { slug } = await params;

  // Look up the event type and its team
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

  // Permanent redirect to new URL
  redirect(`/book/${teamSlug}/${slug}`);
}
