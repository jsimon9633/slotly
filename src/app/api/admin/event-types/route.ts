import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError, sanitizeString } from "@/lib/api-errors";
import { MEETING_TYPE_OPTIONS } from "@/lib/meeting-type-questions";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

// GET — list event types, optionally filtered by team (via join table)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  const teamId = url.searchParams.get("teamId");

  if (teamId) {
    // Get event types for a specific team via join table
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("team_event_types")
      .select("event_type_id")
      .eq("team_id", teamId);

    if (linkErr) {
      return serverError("Failed to load team event links.", linkErr, "Admin event-types GET");
    }

    const etIds = (links || []).map((l: any) => l.event_type_id);
    if (etIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, booking_questions, meeting_type")
      .in("id", etIds)
      .order("title");

    if (error) {
      return serverError("Failed to load event types.", error, "Admin event-types GET");
    }

    return NextResponse.json(data);
  }

  // No team filter — return all event types with their team associations
  const { data, error } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, description, duration_minutes, color, is_active, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, booking_questions, meeting_type")
    .order("title");

  if (error) {
    return serverError("Failed to load event types.", error, "Admin event-types GET");
  }

  // Fetch all join table entries to include team_ids per event type
  const { data: allLinks } = await supabaseAdmin
    .from("team_event_types")
    .select("event_type_id, team_id");

  const linkMap: Record<string, string[]> = {};
  for (const link of allLinks || []) {
    if (!linkMap[link.event_type_id]) linkMap[link.event_type_id] = [];
    linkMap[link.event_type_id].push(link.team_id);
  }

  const enriched = (data || []).map((et: any) => ({
    ...et,
    team_ids: linkMap[et.id] || [],
  }));

  return NextResponse.json(enriched);
}

// POST — create a new custom event type
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

  const { title, duration_minutes, color, description, meeting_type: mtBody } = body;

  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return badRequest("Title is required (min 2 characters)");
  }

  const dur = parseInt(duration_minutes);
  if (isNaN(dur) || dur < 5 || dur > 480) {
    return badRequest("Duration must be 5-480 minutes");
  }

  const cleanTitle = sanitizeString(title, 100);
  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  if (!slug) {
    return badRequest("Could not generate a valid slug from that title");
  }

  const cleanColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6366f1";
  const cleanDescription = description ? sanitizeString(String(description), 500) : null;

  const { data: et, error } = await supabaseAdmin
    .from("event_types")
    .insert({
      title: cleanTitle,
      slug,
      duration_minutes: dur,
      color: cleanColor,
      description: cleanDescription,
      is_active: true,
      is_locked: false,
      before_buffer_mins: 5,
      after_buffer_mins: 5,
      min_notice_hours: 1,
      max_daily_bookings: null,
      max_advance_days: 10,
      meeting_type: mtBody || null,
    })
    .select("id, slug, title, duration_minutes, color, is_active, meeting_type")
    .single();

  if (error) {
    if (error.code === "23505") {
      return badRequest("An event type with this slug already exists");
    }
    return serverError("Failed to create event type.", error, "Admin event-types POST");
  }

  return NextResponse.json(et, { status: 201 });
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

  const { id, title, description, is_locked, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, booking_questions, meeting_type } = body;

  if (!id || typeof id !== "string") {
    return badRequest("Missing event type id");
  }

  const updates: Record<string, any> = {};

  if (title !== undefined) {
    const trimmed = typeof title === "string" ? title.trim() : "";
    if (!trimmed || trimmed.length > 100) {
      return badRequest("Title must be 1-100 characters");
    }
    updates.title = trimmed;
  }

  if (description !== undefined) {
    if (description === null || description === "") {
      updates.description = null;
    } else {
      const trimmed = typeof description === "string" ? description.trim() : "";
      if (trimmed.length > 1000) {
        return badRequest("Description must be under 1000 characters");
      }
      updates.description = trimmed;
    }
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

  if (booking_questions !== undefined) {
    if (!Array.isArray(booking_questions)) {
      return badRequest("booking_questions must be an array");
    }
    // Validate each question
    const validTypes = ["text", "dropdown", "checkbox"];
    for (const q of booking_questions) {
      if (!q.id || typeof q.id !== "string") {
        return badRequest("Each question must have a string id");
      }
      if (!validTypes.includes(q.type)) {
        return badRequest(`Invalid question type: ${q.type}`);
      }
      if (!q.label || typeof q.label !== "string" || q.label.trim().length < 1) {
        return badRequest("Each question must have a label");
      }
      if (q.type === "dropdown" && (!Array.isArray(q.options) || q.options.length < 1)) {
        return badRequest("Dropdown questions must have at least one option");
      }
    }
    updates.booking_questions = booking_questions;
  }

  if (meeting_type !== undefined) {
    const validMeetingTypes: (string | null)[] = [...MEETING_TYPE_OPTIONS.map(o => o.value), null];
    if (!validMeetingTypes.includes(meeting_type)) {
      return badRequest("Invalid meeting type");
    }
    updates.meeting_type = meeting_type;
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

/**
 * DELETE /api/admin/event-types — Delete an event type.
 *
 * Body: { id: string }
 *
 * Also cleans up join table entries (CASCADE handles this if FK is set,
 * but we do it explicitly for safety).
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

  const { id } = body;
  if (!id || typeof id !== "string") {
    return badRequest("Missing event type id");
  }

  // Clean up join table first
  await supabaseAdmin
    .from("team_event_types")
    .delete()
    .eq("event_type_id", id);

  const { error } = await supabaseAdmin
    .from("event_types")
    .delete()
    .eq("id", id);

  if (error) {
    return serverError("Failed to delete event type.", error, "Admin event-types DELETE");
  }

  return NextResponse.json({ success: true });
}
