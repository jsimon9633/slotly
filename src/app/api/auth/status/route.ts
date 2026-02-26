import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-admin-2024";

/**
 * GET /api/auth/status — Get OAuth connection status for all team members
 * Admin-only endpoint.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const auth = req.headers.get("authorization");
  if (token !== ADMIN_TOKEN && auth !== `Bearer ${ADMIN_TOKEN}`) {
    return unauthorized();
  }

  const { data: members, error } = await supabaseAdmin
    .from("team_members")
    .select("id, name, email, avatar_url, google_oauth_connected_at, google_oauth_revoked_at, google_oauth_refresh_token, is_active")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }

  // Return connection status without exposing actual tokens
  const statuses = (members || []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    avatar_url: m.avatar_url,
    is_active: m.is_active,
    connection_status: m.google_oauth_revoked_at
      ? "revoked"
      : m.google_oauth_connected_at
      ? "connected"
      : m.google_oauth_refresh_token
      ? "connected" // has token but no connected_at timestamp (legacy)
      : "service_account", // no OAuth token, using service account fallback
    connected_at: m.google_oauth_connected_at,
    revoked_at: m.google_oauth_revoked_at,
  }));

  return NextResponse.json(statuses);
}
