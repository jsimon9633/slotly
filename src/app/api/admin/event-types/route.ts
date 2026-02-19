import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

// GET — list all event types with scheduling settings
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  // Optional team filter
  const teamId = url.searchParams.get("teamId");

  let query = supabaseAdmin
    .from("event_types")
    .select("id, slug, title, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id")
    .order("title");

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data, error } = await query;

  if (error) {
    return serverError("Failed to load event types.", error, "Admin event-types GET");
  }

  return NextResponse.json(data);
}

// PATCH — update scheduling settings for one event type
export async function PATCH(request: NextRequest) {
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

  const { id, title, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id } = body;

  if (!id || typeof id !== "string") {
    return badRequest("Missing event type id");
  }

  // Validate fields
  const updates: Record<string, any> = {};

  if (title !== undefined) {
    const trimmed = typeof title === "string" ? title.trim() : "";
    if (!trimmed || trimmed.length > 100) {
      return badRequest("Title must be 1-100 characters");
    }
    updates.title = trimmed;
  }

  if (is_locked !== undefined) {
    updates.is_locked = Boolean(is_locked);
  }

  if (before_buffer_mins !== undefined) {
    const val = parseInt(before_buffer_mins);
    if (isNaN(val) || val < 0 || val > 120) {
      return badRequest("Before buffer must be 0-120 minutes");
    }
    updates.before_buffer_mins = val;
  }

  if (after_buffer_mins !== undefined) {
    const val = parseInt(after_buffer_mins);
    if (isNaN(val) || val < 0 || val > 120) {
      return badRequest("After buffer must be 0-120 minutes");
    }
    updates.after_buffer_mins = val;
  }

  if (min_notice_hours !== undefined) {
    const val = parseInt(min_notice_hours);
    if (isNaN(val) || val < 0 || val > 168) {
      return badRequest("Minimum notice must be 0-168 hours");
    }
    updates.min_notice_hours = val;
  }

  if (max_daily_bookings !== undefined) {
    if (max_daily_bookings === null || max_daily_bookings === "" || max_daily_bookings === "null") {
      updates.max_daily_bookings = null;
    } else {
      const val = parseInt(max_daily_bookings);
      if (isNaN(val) || val < 1 || val > 100) {
        return badRequest("Daily limit must be 1-100 or empty for unlimited");
      }
      updates.max_daily_bookings = val;
    }
  }

  if (max_advance_days !== undefined) {
    const val = parseInt(max_advance_days);
    if (isNaN(val) || val < 2 || val > 30) {
      return badRequest("Advance days must be 2-30");
    }
    updates.max_advance_days = val;
  }

  if (team_id !== undefined) {
    if (team_id === null || team_id === "" || team_id === "null") {
      updates.team_id = null;
    } else if (typeof team_id === "string") {
      updates.team_id = team_id;
    } else {
      return badRequest("Invalid team_id");
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("No valid fields to update");
  }

  const { error } = await supabaseAdmin
    .from("event_types")
    .update(updates)
    .eq("id", id);

  if (error) {
    return serverError("Failed to update event type settings.", error, "Admin event-types PATCH");
  }

  return NextResponse.json({ success: true });
}
