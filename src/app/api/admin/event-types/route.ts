import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

// GET — list all event types with scheduling settings
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, duration_minutes, color, is_active, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings")
    .order("title");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH — update scheduling settings for one event type
export async function PATCH(request: NextRequest) {
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

  const { id, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing event type id" }, { status: 400 });
  }

  // Validate numeric fields
  const updates: Record<string, any> = {};

  if (before_buffer_mins !== undefined) {
    const val = parseInt(before_buffer_mins);
    if (isNaN(val) || val < 0 || val > 120) {
      return NextResponse.json({ error: "Before buffer must be 0-120 minutes" }, { status: 400 });
    }
    updates.before_buffer_mins = val;
  }

  if (after_buffer_mins !== undefined) {
    const val = parseInt(after_buffer_mins);
    if (isNaN(val) || val < 0 || val > 120) {
      return NextResponse.json({ error: "After buffer must be 0-120 minutes" }, { status: 400 });
    }
    updates.after_buffer_mins = val;
  }

  if (min_notice_hours !== undefined) {
    const val = parseInt(min_notice_hours);
    if (isNaN(val) || val < 0 || val > 168) {
      return NextResponse.json({ error: "Minimum notice must be 0-168 hours" }, { status: 400 });
    }
    updates.min_notice_hours = val;
  }

  if (max_daily_bookings !== undefined) {
    if (max_daily_bookings === null || max_daily_bookings === "" || max_daily_bookings === "null") {
      updates.max_daily_bookings = null;
    } else {
      const val = parseInt(max_daily_bookings);
      if (isNaN(val) || val < 1 || val > 100) {
        return NextResponse.json({ error: "Daily limit must be 1-100 or empty for unlimited" }, { status: 400 });
      }
      updates.max_daily_bookings = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("event_types")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
