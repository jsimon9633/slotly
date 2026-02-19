import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError, sanitizeString } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

const VALID_TRIGGERS = ["on_booking", "on_cancel", "on_reschedule", "before_meeting", "after_meeting"];
const VALID_ACTIONS = ["send_email", "send_sms"];
const VALID_RECIPIENTS = ["invitee", "host", "both"];

// GET — list workflows, optionally filtered by event_type_id
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) return unauthorized();

  const eventTypeId = url.searchParams.get("eventTypeId");

  let query = supabaseAdmin
    .from("workflows")
    .select("id, event_type_id, name, trigger, trigger_minutes, action, recipient, subject, body, is_active, created_at")
    .order("created_at", { ascending: false });

  if (eventTypeId) {
    query = query.eq("event_type_id", eventTypeId);
  }

  const { data, error } = await query;
  if (error) return serverError("Failed to load workflows.", error, "Admin workflows GET");

  return NextResponse.json(data || []);
}

// POST — create a new workflow
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) return unauthorized();

  let body: any;
  try { body = await request.json(); } catch { return badRequest("Invalid request body"); }

  const { event_type_id, name, trigger, trigger_minutes, action, recipient, subject, body: wfBody } = body;

  if (!event_type_id || typeof event_type_id !== "string") return badRequest("Missing event_type_id");
  if (!name || typeof name !== "string" || name.trim().length < 2) return badRequest("Name is required (min 2 characters)");
  if (!VALID_TRIGGERS.includes(trigger)) return badRequest("Invalid trigger");
  if (!VALID_ACTIONS.includes(action)) return badRequest("Invalid action");
  if (!VALID_RECIPIENTS.includes(recipient || "invitee")) return badRequest("Invalid recipient");
  if (!wfBody || typeof wfBody !== "string" || wfBody.trim().length < 2) return badRequest("Body is required");

  // Validate trigger_minutes for time-based triggers
  let cleanTriggerMins = 0;
  if (trigger === "before_meeting" || trigger === "after_meeting") {
    cleanTriggerMins = parseInt(trigger_minutes);
    if (isNaN(cleanTriggerMins) || cleanTriggerMins < 5 || cleanTriggerMins > 10080) {
      return badRequest("Trigger minutes must be 5-10080 (up to 7 days)");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("workflows")
    .insert({
      event_type_id,
      name: sanitizeString(name, 100),
      trigger,
      trigger_minutes: cleanTriggerMins,
      action,
      recipient: recipient || "invitee",
      subject: subject ? sanitizeString(subject, 200) : null,
      body: sanitizeString(wfBody, 5000),
      is_active: true,
    })
    .select("id, event_type_id, name, trigger, trigger_minutes, action, recipient, subject, body, is_active, created_at")
    .single();

  if (error) return serverError("Failed to create workflow.", error, "Admin workflows POST");

  return NextResponse.json(data, { status: 201 });
}

// PATCH — update a workflow
export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) return unauthorized();

  let body: any;
  try { body = await request.json(); } catch { return badRequest("Invalid request body"); }

  const { id, name, trigger, trigger_minutes, action, recipient, subject, body: wfBody, is_active } = body;

  if (!id || typeof id !== "string") return badRequest("Missing workflow id");

  const updates: Record<string, any> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) return badRequest("Name must be at least 2 characters");
    updates.name = sanitizeString(name, 100);
  }
  if (trigger !== undefined) {
    if (!VALID_TRIGGERS.includes(trigger)) return badRequest("Invalid trigger");
    updates.trigger = trigger;
  }
  if (trigger_minutes !== undefined) {
    const val = parseInt(trigger_minutes);
    if (isNaN(val) || val < 0 || val > 10080) return badRequest("Invalid trigger minutes");
    updates.trigger_minutes = val;
  }
  if (action !== undefined) {
    if (!VALID_ACTIONS.includes(action)) return badRequest("Invalid action");
    updates.action = action;
  }
  if (recipient !== undefined) {
    if (!VALID_RECIPIENTS.includes(recipient)) return badRequest("Invalid recipient");
    updates.recipient = recipient;
  }
  if (subject !== undefined) {
    updates.subject = subject ? sanitizeString(subject, 200) : null;
  }
  if (wfBody !== undefined) {
    if (typeof wfBody !== "string" || wfBody.trim().length < 2) return badRequest("Body must be at least 2 characters");
    updates.body = sanitizeString(wfBody, 5000);
  }
  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }

  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const { error } = await supabaseAdmin.from("workflows").update(updates).eq("id", id);
  if (error) return serverError("Failed to update workflow.", error, "Admin workflows PATCH");

  return NextResponse.json({ success: true });
}

// DELETE — delete a workflow
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) return unauthorized();

  let body: any;
  try { body = await request.json(); } catch { return badRequest("Invalid request body"); }

  const { id } = body;
  if (!id || typeof id !== "string") return badRequest("Missing workflow id");

  const { error } = await supabaseAdmin.from("workflows").delete().eq("id", id);
  if (error) return serverError("Failed to delete workflow.", error, "Admin workflows DELETE");

  return NextResponse.json({ success: true });
}
