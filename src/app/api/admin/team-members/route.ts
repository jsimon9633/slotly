import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError, sanitizeString } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

/**
 * GET /api/admin/team-members — List all team members (the people who can be assigned to teams).
 * Returns ALL members including inactive ones so admin can still assign them to teams.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("team_members")
      .select("id, name, email, is_active")
      .order("name", { ascending: true });

    if (error) {
      return serverError("Failed to load team members.", error, "Admin team-members GET");
    }

    return NextResponse.json(data || []);
  } catch (err) {
    return serverError("Team members query failed.", err, "Admin team-members GET");
  }
}

/**
 * POST /api/admin/team-members — Create a new team member (person).
 *
 * Body: { name: string, email: string }
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

  const { name, email } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    return badRequest("Name is required");
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return badRequest("Valid email is required");
  }

  const cleanName = sanitizeString(name, 200);
  const cleanEmail = email.trim().toLowerCase().slice(0, 320);

  // Check if member already exists (by email)
  const { data: existing } = await supabaseAdmin
    .from("team_members")
    .select("id, is_active")
    .eq("email", cleanEmail)
    .single();

  if (existing) {
    // Re-activate if previously deactivated
    if (!existing.is_active) {
      await supabaseAdmin
        .from("team_members")
        .update({ is_active: true, name: cleanName })
        .eq("id", existing.id);
    }
    return NextResponse.json({ id: existing.id, name: cleanName, email: cleanEmail, is_active: true });
  }

  const { data: member, error } = await supabaseAdmin
    .from("team_members")
    .insert({ name: cleanName, email: cleanEmail })
    .select("id, name, email, is_active")
    .single();

  if (error) {
    if (error.code === "23505") {
      return badRequest("A member with this email already exists");
    }
    return serverError("Failed to create team member.", error, "Admin team-members POST");
  }

  return NextResponse.json(member, { status: 201 });
}
