import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Simple admin token check — in production, use proper auth
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-admin-2024";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_TOKEN}`) return true;
  // Also allow via query param for simple browser access
  const token = req.nextUrl.searchParams.get("token");
  return token === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") || "pending";
  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("join_requests")
    .select("id, name, email, calendar_shared, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch requests." }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { id, status } = body;
  if (typeof id !== "string" || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("join_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to update request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
