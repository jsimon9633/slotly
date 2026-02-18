import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

const VALID_EVENTS = ["booking.created", "booking.cancelled", "booking.rescheduled"];

function authCheck(request: NextRequest): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("token") === ADMIN_TOKEN;
}

// GET — list all webhooks with recent delivery logs
export async function GET(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: webhooks, error } = await supabaseAdmin
    .from("webhooks")
    .select("id, url, events, is_active, secret, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch recent logs for each webhook (last 10 per webhook)
  const webhookIds = (webhooks || []).map((w: any) => w.id);
  let logs: any[] = [];

  if (webhookIds.length > 0) {
    const { data: logData } = await supabaseAdmin
      .from("webhook_logs")
      .select("id, webhook_id, event, status_code, success, created_at")
      .in("webhook_id", webhookIds)
      .order("created_at", { ascending: false })
      .limit(50);

    logs = logData || [];
  }

  return NextResponse.json({ webhooks: webhooks || [], logs });
}

// POST — create a new webhook
export async function POST(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { url, events } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL must be HTTP or HTTPS" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // Validate events
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
  }

  const validEvents = events.filter((e: string) => VALID_EVENTS.includes(e));
  if (validEvents.length === 0) {
    return NextResponse.json(
      { error: `Invalid events. Valid: ${VALID_EVENTS.join(", ")}` },
      { status: 400 }
    );
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH — update webhook (toggle active, update URL/events)
export async function PATCH(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, url, events, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: "Webhook id is required" }, { status: 400 });
  }

  const updates: Record<string, any> = {};

  if (url !== undefined) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "URL must be HTTP or HTTPS" }, { status: 400 });
      }
      updates.url = url.trim();
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }
  }

  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }
    const validEvents = events.filter((e: string) => VALID_EVENTS.includes(e));
    if (validEvents.length === 0) {
      return NextResponse.json({ error: "No valid events provided" }, { status: 400 });
    }
    updates.events = validEvents;
  }

  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("webhooks")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove a webhook
export async function DELETE(request: NextRequest) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Webhook id is required" }, { status: 400 });
  }

  // Delete logs first (foreign key)
  await supabaseAdmin.from("webhook_logs").delete().eq("webhook_id", id);

  const { error } = await supabaseAdmin
    .from("webhooks")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
