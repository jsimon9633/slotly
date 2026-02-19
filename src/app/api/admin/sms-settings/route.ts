import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * GET /api/admin/sms-settings — Read SMS / Twilio config from site_settings.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token !== ADMIN_TOKEN) return unauthorized();

  try {
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "sms_enabled",
        "twilio_account_sid",
        "twilio_auth_token",
        "twilio_phone_number",
      ]);

    if (error) {
      console.error("[SMS Settings] GET failed:", error.message);
      return NextResponse.json({ error: "Failed to load SMS settings" }, { status: 500 });
    }

    // Convert rows to key-value map
    const result: Record<string, string> = {};
    for (const row of data || []) {
      result[row.key] = row.value;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[SMS Settings] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/sms-settings — Upsert SMS / Twilio config in site_settings.
 */
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token !== ADMIN_TOKEN) return unauthorized();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const allowedKeys = [
    "sms_enabled",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_phone_number",
  ];

  try {
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        const value = String(body[key]).slice(0, 500);

        // Upsert: try update first, insert if not found
        const { data: existing } = await supabaseAdmin
          .from("site_settings")
          .select("key")
          .eq("key", key)
          .single();

        if (existing) {
          await supabaseAdmin
            .from("site_settings")
            .update({ value })
            .eq("key", key);
        } else {
          await supabaseAdmin
            .from("site_settings")
            .insert({ key, value });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SMS Settings] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to save SMS settings" }, { status: 500 });
  }
}
