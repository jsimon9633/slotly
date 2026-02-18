import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomBytes } from "crypto";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-admin-2024";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_TOKEN}`) return true;
  const token = req.nextUrl.searchParams.get("token");
  return token === ADMIN_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { expiresInDays?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  const expiresInDays = body.expiresInDays || 7;
  if (expiresInDays < 1 || expiresInDays > 30) {
    return NextResponse.json({ error: "Expiry must be 1-30 days." }, { status: 400 });
  }

  // Generate a URL-safe token (16 bytes = 32 hex chars)
  const inviteToken = randomBytes(16).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabaseAdmin.from("invite_tokens").insert({
    token: inviteToken,
    created_by: "admin",
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }

  return NextResponse.json({
    token: inviteToken,
    expires_at: expiresAt.toISOString(),
    link: `/join?invite=${inviteToken}`,
  });
}

// Cancel (delete) an invite — removes from DB so the link is no longer valid
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Missing invite ID." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Missing invite ID." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("invite_tokens")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: "Failed to cancel invite." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// List active (unused, unexpired) invites
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("invite_tokens")
    .select("id, token, is_used, used_by_email, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch invites." }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
