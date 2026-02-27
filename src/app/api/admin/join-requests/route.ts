import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-admin-2024";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_TOKEN}`) return true;
  const token = req.nextUrl.searchParams.get("token");
  return token === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  const status = req.nextUrl.searchParams.get("status") || "pending";
  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) {
    return badRequest("Invalid status filter. Use: pending, approved, or rejected.");
  }

  const { data, error } = await supabaseAdmin
    .from("join_requests")
    .select("id, name, email, calendar_shared, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to fetch join requests.", error, "Admin join-requests GET");
  }

  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const { id, status } = body;
  if (typeof id !== "string" || !["approved", "rejected"].includes(status)) {
    return badRequest("Invalid input. Provide a valid id and status (approved or rejected).");
  }

  // Get the join request to find the email
  const { data: joinReq, error: fetchError } = await supabaseAdmin
    .from("join_requests")
    .select("id, email")
    .eq("id", id)
    .single();

  if (fetchError || !joinReq) {
    return serverError("Join request not found.", fetchError, "Admin join-requests PATCH lookup");
  }

  // Update join request status
  const { error } = await supabaseAdmin
    .from("join_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return serverError("Failed to update join request.", error, "Admin join-requests PATCH");
  }

  // If approved, auto-provision the team member
  if (status === "approved") {
    const email = joinReq.email.toLowerCase();

    // Find the team member (created during OAuth callback with is_active=false)
    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("id, is_active")
      .eq("email", email)
      .single();

    if (member) {
      // Activate the member
      if (!member.is_active) {
        await supabaseAdmin
          .from("team_members")
          .update({ is_active: true })
          .eq("id", member.id);
      }

      // Create default availability rules (Mon-Fri 9am-5pm) if none exist
      const { data: existingRules } = await supabaseAdmin
        .from("availability_rules")
        .select("id")
        .eq("team_member_id", member.id)
        .limit(1);

      if (!existingRules || existingRules.length === 0) {
        const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
        await supabaseAdmin.from("availability_rules").insert(
          weekdays.map((day) => ({
            team_member_id: member.id,
            day_of_week: day,
            start_time: "09:00",
            end_time: "17:00",
            is_available: true,
          }))
        );
      }

      // Add to default team if one exists and member isn't already in it
      const { data: defaultTeam } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (defaultTeam) {
        const { data: existingMembership } = await supabaseAdmin
          .from("team_memberships")
          .select("id")
          .eq("team_id", defaultTeam.id)
          .eq("team_member_id", member.id)
          .limit(1)
          .maybeSingle();

        if (!existingMembership) {
          await supabaseAdmin.from("team_memberships").insert({
            team_id: defaultTeam.id,
            team_member_id: member.id,
            role: "member",
            is_active: true,
          });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
