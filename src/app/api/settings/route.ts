import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
  // Admin auth
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { company_name, logo_url, primary_color, accent_color } = body;

  // Validate
  if (company_name && typeof company_name !== "string") {
    return NextResponse.json({ error: "Invalid company name" }, { status: 400 });
  }
  if (primary_color && !/^#[0-9a-fA-F]{6}$/.test(primary_color)) {
    return NextResponse.json({ error: "Invalid primary color (use hex like #4f46e5)" }, { status: 400 });
  }
  if (accent_color && !/^#[0-9a-fA-F]{6}$/.test(accent_color)) {
    return NextResponse.json({ error: "Invalid accent color (use hex like #3b82f6)" }, { status: 400 });
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
  } catch (err: any) {
    console.error("Settings update failed:", err?.message);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
