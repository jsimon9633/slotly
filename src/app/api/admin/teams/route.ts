import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError, sanitizeString } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

/**
 * GET /api/admin/teams — List all teams with member count and event type count.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  try {
    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, slug, description, is_active, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return serverError("Failed to load teams.", error, "Admin teams GET");
    }

    // Enrich with counts
    const enriched = await Promise.all(
      (teams || []).map(async (team) => {
        const [{ count: memberCount }, { count: eventTypeCount }] = await Promise.all([
          supabaseAdmin
            .from("team_memberships")
            .select("id", { count: "exact", head: true })
            .eq("team_id", team.id)
            .eq("is_active", true),
          supabaseAdmin
            .from("team_event_types")
            .select("id", { count: "exact", head: true })
            .eq("team_id", team.id),
        ]);

        return {
          ...team,
          member_count: memberCount || 0,
          event_type_count: eventTypeCount || 0,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    return serverError("Teams query failed.", err, "Admin teams GET");
  }
}

/**
 * POST /api/admin/teams — Create a new team.
 *
 * Body: { name: string, slug?: string, description?: string }
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { name, slug, description } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return badRequest("Team name is required (min 2 characters)");
  }

  const cleanName = sanitizeString(name, 100);
  const cleanSlug = slug
    ? String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50)
    : cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

  if (!cleanSlug) {
    return badRequest("Could not generate a valid slug");
  }

  const cleanDescription = description ? sanitizeString(String(description), 500) : null;

  const { data: team, error } = await supabaseAdmin
    .from("teams")
    .insert({ name: cleanName, slug: cleanSlug, description: cleanDescription })
    .select("id, name, slug, description, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return badRequest("A team with this slug already exists");
    }
    return serverError("Failed to create team.", error, "Admin teams POST");
  }

  return NextResponse.json(team, { status: 201 });
}

/**
 * PATCH /api/admin/teams — Update a team.
 *
 * Body: { id: string, name?: string, slug?: string, description?: string, is_active?: boolean }
 */
export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { id, name, slug, description, is_active } = body;

  if (!id || typeof id !== "string") {
    return badRequest("Missing team id");
  }

  const updates: Record<string, any> = {};

  if (name !== undefined) {
    const cleanName = sanitizeString(String(name), 100);
    if (cleanName.length < 2) return badRequest("Team name must be at least 2 characters");
    updates.name = cleanName;
  }

  if (slug !== undefined) {
    const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50);
    if (!cleanSlug) return badRequest("Invalid slug");
    updates.slug = cleanSlug;
  }

  if (description !== undefined) {
    updates.description = description ? sanitizeString(String(description), 500) : null;
  }

  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("No valid fields to update");
  }

  const { error } = await supabaseAdmin.from("teams").update(updates).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return badRequest("A team with this slug already exists");
    }
    return serverError("Failed to update team.", error, "Admin teams PATCH");
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/teams — Delete a team.
 *
 * Body: { id: string }
 * Removes all team_memberships first, nullifies team_id on event_types, then deletes the team.
 */
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { id } = body;

  if (!id || typeof id !== "string") {
    return badRequest("Missing team id");
  }

  // 1. Remove all memberships for this team
  await supabaseAdmin
    .from("team_memberships")
    .delete()
    .eq("team_id", id);

  // 2. Remove all event type associations for this team
  await supabaseAdmin
    .from("team_event_types")
    .delete()
    .eq("team_id", id);

  // 3. Delete the team
  const { error } = await supabaseAdmin
    .from("teams")
    .delete()
    .eq("id", id);

  if (error) {
    return serverError("Failed to delete team.", error, "Admin teams DELETE");
  }

  return NextResponse.json({ success: true });
}
