import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serverError } from "@/lib/api-errors";

export async function GET() {
  // Only expose first names — never expose emails or calendar IDs
  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return serverError("Unable to load team members.", error, "Team GET");
  }

  // Strip to first name only — no last names in public API
  const safeData = (data || []).map((m) => ({
    id: m.id,
    name: m.name.split(" ")[0],
  }));

  return NextResponse.json(safeData);
}
