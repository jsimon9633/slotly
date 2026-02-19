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
        joined_at,
        team_members ( id, name, email, is_active )
      `)
      .eq("team_id", teamId)
      .eq("is_active", true);

    if (error) {
      return serverError("Failed to load team members.", error, "Team members GET");
    }

    const members = (memberships || []).map((m: any) => ({
      membership_id: m.id,
      role: m.role,
      joined_at: m.joined_at,
      ...m.team_members,
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
