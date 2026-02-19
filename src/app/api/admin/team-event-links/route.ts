import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

/**
 * POST /api/admin/team-event-links — Add an event type to a team (insert join table row).
 *
 * Body: { team_id: string, event_type_id: string }
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

  const { team_id, event_type_id } = body;

  if (!team_id || typeof team_id !== "string") {
    return badRequest("Missing team_id");
  }
  if (!event_type_id || typeof event_type_id !== "string") {
    return badRequest("Missing event_type_id");
  }

  const { error } = await supabaseAdmin
    .from("team_event_types")
    .insert({ team_id, event_type_id });

  if (error) {
    if (error.code === "23505") {
      // Already linked — not an error
      return NextResponse.json({ success: true, already_linked: true });
    }
    return serverError("Failed to link event type to team.", error, "Team-event-links POST");
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

/**
 * DELETE /api/admin/team-event-links — Remove an event type from a team (delete join table row).
 *
 * Body: { team_id: string, event_type_id: string }
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

  const { team_id, event_type_id } = body;

  if (!team_id || typeof team_id !== "string") {
    return badRequest("Missing team_id");
  }
  if (!event_type_id || typeof event_type_id !== "string") {
    return badRequest("Missing event_type_id");
  }

  const { error } = await supabaseAdmin
    .from("team_event_types")
    .delete()
    .eq("team_id", team_id)
    .eq("event_type_id", event_type_id);

  if (error) {
    return serverError("Failed to unlink event type from team.", error, "Team-event-links DELETE");
  }

  return NextResponse.json({ success: true });
}
