import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

// Default settings when none exist in DB
const DEFAULT_SETTINGS = {
  company_name: "Slotly",
  logo_url: null,
  primary_color: "#4f46e5",
  accent_color: "#3b82f6",
};

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("company_name, logo_url, primary_color, accent_color")
      .limit(1)
      .single();

    return NextResponse.json(data || DEFAULT_SETTINGS);
  } catch {
    // Table might not exist yet — return defaults
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const { company_name, logo_url, primary_color, accent_color } = body;

  // Validate
  if (company_name !== undefined && typeof company_name !== "string") {
    return badRequest("Invalid company name.");
  }
  if (primary_color !== undefined && primary_color && !/^#[0-9a-fA-F]{6}$/.test(primary_color)) {
    return badRequest("Invalid primary color (use hex like #4f46e5).");
  }
  if (accent_color !== undefined && accent_color && !/^#[0-9a-fA-F]{6}$/.test(accent_color)) {
    return badRequest("Invalid accent color (use hex like #3b82f6).");
  }

  try {
    // Check if row exists
    const { data: existing } = await supabaseAdmin
      .from("site_settings")
      .select("id")
      .limit(1)
      .single();

    const updates: Record<string, any> = {};
    if (company_name !== undefined) updates.company_name = company_name.trim().slice(0, 50);
    if (logo_url !== undefined) updates.logo_url = logo_url ? logo_url.trim().slice(0, 500) : null;
    if (primary_color !== undefined) updates.primary_color = primary_color;
    if (accent_color !== undefined) updates.accent_color = accent_color;

    if (existing) {
      const { error } = await supabaseAdmin
        .from("site_settings")
        .update(updates)
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("site_settings")
        .insert({ ...DEFAULT_SETTINGS, ...updates });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError("Failed to update settings.", err, "Settings PUT");
  }
}
