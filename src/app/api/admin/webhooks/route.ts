import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

const VALID_EVENTS = ["booking.created", "booking.cancelled", "booking.rescheduled"];

function authCheck(request: NextRequest): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("token") === ADMIN_TOKEN;
}

// GET — list all webhooks with recent delivery logs
export async function GET(request: NextRequest) {
  if (!authCheck(request)) {
    return unauthorized();
  }

  const { data: webhooks, error } = await supabaseAdmin
    .from("webhooks")
    .select("id, url, events, is_active, secret, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to load webhooks.", error, "Webhooks GET");
  }

  // Fetch recent logs for each webhook (last 10 per webhook)
  const webhookIds = (webhooks || []).map((w: any) => w.id);
  let logs: any[] = [];

  if (webhookIds.length > 0) {
    const { data: logData, error: logError } = await supabaseAdmin
      .from("webhook_logs")
      .select("id, webhook_id, event, status_code, success, created_at")
      .in("webhook_id", webhookIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (logError) {
      console.error("[Webhooks] Log query failed:", logError.message);
      // Non-fatal — return webhooks without logs
    } else {
      logs = logData || [];
    }
  }

  return NextResponse.json({ webhooks: webhooks || [], logs });
}

// POST — create a new webhook
export async function POST(request: NextRequest) {
  if (!authCheck(request)) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { url, events } = body;

  if (!url || typeof url !== "string") {
    return badRequest("URL is required");
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return badRequest("URL must be HTTP or HTTPS");
    }
  } catch {
    return badRequest("Invalid URL format");
  }

  // Validate events
  if (!Array.isArray(events) || events.length === 0) {
    return badRequest("At least one event is required");
  }

  const validEvents = events.filter((e: string) => VALID_EVENTS.includes(e));
  if (validEvents.length === 0) {
    return badRequest(`Invalid events. Valid options: ${VALID_EVENTS.join(", ")}`);
  }

  // Generate signing secret
  const secret = randomBytes(32).toString("hex");

  const { data, error } = await supabaseAdmin
    .from("webhooks")
    .insert({
      id: randomUUID(),
      url: url.trim(),
      events: validEvents,
      is_active: true,
      secret,
    })
    .select("id, url, events, is_active, secret, created_at")
    .single();

  if (error) {
    return serverError("Failed to create webhook.", error, "Webhooks POST");
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH — update webhook (toggle active, update URL/events)
export async function PATCH(request: NextRequest) {
  if (!authCheck(request)) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { id, url, events, is_active } = body;

  if (!id || typeof id !== "string") {
    return badRequest("Webhook id is required");
  }

  const updates: Record<string, any> = {};

  if (url !== undefined) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return badRequest("URL must be HTTP or HTTPS");
      }
      updates.url = url.trim();
    } catch {
      return badRequest("Invalid URL format");
    }
  }

  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return badRequest("At least one event is required");
    }
    const validEvents = events.filter((e: string) => VALID_EVENTS.includes(e));
    if (validEvents.length === 0) {
      return badRequest("No valid events provided");
    }
    updates.events = validEvents;
  }

  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("No valid fields to update");
  }

  const { error } = await supabaseAdmin
    .from("webhooks")
    .update(updates)
    .eq("id", id);

  if (error) {
    return serverError("Failed to update webhook.", error, "Webhooks PATCH");
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove a webhook
export async function DELETE(request: NextRequest) {
  if (!authCheck(request)) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id || typeof id !== "string") {
    return badRequest("Webhook id is required");
  }

  // Delete logs first (foreign key)
  const { error: logDeleteError } = await supabaseAdmin.from("webhook_logs").delete().eq("webhook_id", id);
  if (logDeleteError) {
    console.error("[Webhooks] Log cleanup failed:", logDeleteError.message);
  }

  const { error } = await supabaseAdmin
    .from("webhooks")
    .delete()
    .eq("id", id);

  if (error) {
    return serverError("Failed to delete webhook.", error, "Webhooks DELETE");
  }

  return NextResponse.json({ success: true });
}
