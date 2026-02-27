import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

/**
 * GET /api/admin/teams/[teamId]/members — List members of a team.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  const { teamId } = await params;

  try {
    const { data: memberships, error } = await supabaseAdmin
      .from("team_memberships")
      .select(`
        id,
        role,
        is_active,
        in_round_robin,
        joined_at,
        team_members ( id, name, email, is_active, avatar_url, google_oauth_connected_at, google_oauth_revoked_at, google_oauth_refresh_token )
      `)
      .eq("team_id", teamId)
      .eq("is_active", true);

    if (error) {
      return serverError("Failed to load team members.", error, "Team members GET");
    }

    const members = (memberships || []).map((m: any) => ({
      membership_id: m.id,
      role: m.role,
      in_round_robin: m.in_round_robin ?? true,
      joined_at: m.joined_at,
      id: m.team_members.id,
      name: m.team_members.name,
      email: m.team_members.email,
      is_active: m.team_members.is_active,
      avatar_url: m.team_members.avatar_url || null,
      connection_status: m.team_members.google_oauth_revoked_at
        ? "revoked"
        : m.team_members.google_oauth_connected_at
        ? "connected"
        : m.team_members.google_oauth_refresh_token
        ? "connected"
        : "service_account",
    }));

    return NextResponse.json(members);
  } catch (err) {
    return serverError("Team members query failed.", err, "Team members GET");
  }
}

/**
 * POST /api/admin/teams/[teamId]/members — Add a member to the team.
 *
 * Body: { team_member_id: string, role?: "admin" | "member" }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  const { teamId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { team_member_id, role = "member" } = body;

  if (!team_member_id || typeof team_member_id !== "string") {
    return badRequest("Missing team_member_id");
  }

  if (!["admin", "member"].includes(role)) {
    return badRequest("Role must be 'admin' or 'member'");
  }

  // Verify team exists
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .single();

  if (!team) {
    return notFound("Team");
  }

  // Upsert membership (re-activate if previously removed)
  const { data: membership, error } = await supabaseAdmin
    .from("team_memberships")
    .upsert(
      { team_id: teamId, team_member_id, role, is_active: true },
      { onConflict: "team_id,team_member_id" }
    )
    .select("id, role, is_active, joined_at")
    .single();

  if (error) {
    return serverError("Failed to add member to team.", error, "Team members POST");
  }

  return NextResponse.json(membership, { status: 201 });
}

/**
 * PATCH /api/admin/teams/[teamId]/members — Toggle round-robin for a member.
 *
 * Body: { team_member_id: string, in_round_robin: boolean }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  const { teamId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { team_member_id, in_round_robin } = body;

  if (!team_member_id || typeof team_member_id !== "string") {
    return badRequest("Missing team_member_id");
  }

  if (typeof in_round_robin !== "boolean") {
    return badRequest("in_round_robin must be a boolean");
  }

  const { data, error } = await supabaseAdmin
    .from("team_memberships")
    .update({ in_round_robin })
    .eq("team_id", teamId)
    .eq("team_member_id", team_member_id)
    .select("id, in_round_robin")
    .single();

  if (error) {
    return serverError("Failed to update round-robin setting.", error, "Team members PATCH");
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/admin/teams/[teamId]/members — Remove a member from the team (soft delete).
 *
 * Body: { team_member_id: string }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  const { teamId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { team_member_id } = body;

  if (!team_member_id || typeof team_member_id !== "string") {
    return badRequest("Missing team_member_id");
  }

  const { error } = await supabaseAdmin
    .from("team_memberships")
    .update({ is_active: false })
    .eq("team_id", teamId)
    .eq("team_member_id", team_member_id);

  if (error) {
    return serverError("Failed to remove member from team.", error, "Team members DELETE");
  }

  return NextResponse.json({ success: true });
}
