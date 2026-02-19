import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serverError } from "@/lib/api-errors";

/**
 * GET /api/teams — Public endpoint returning active teams.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("id, name, slug, description, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return serverError("Unable to load teams.", error, "Teams GET");
  }

  return NextResponse.json(data || []);
}
