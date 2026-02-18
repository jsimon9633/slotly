import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

// Rate limit: 5 join requests per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function sanitize(str: string, maxLen: number): string {
  return str.trim().slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { name, email, calendarShared, inviteToken } = body;

  // Validate types
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof calendarShared !== "boolean" ||
    typeof inviteToken !== "string"
  ) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  // Validate invite token format
  if (!inviteToken || inviteToken.length < 10 || !/^[a-f0-9]+$/.test(inviteToken)) {
    return NextResponse.json({ error: "Invalid invite link." }, { status: 403 });
  }

  // Verify invite token is valid, unused, and not expired
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("invite_tokens")
    .select("id, token, is_used, expires_at")
    .eq("token", inviteToken)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invalid invite link." }, { status: 403 });
  }

  if (invite.is_used) {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 403 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired. Ask your admin for a new one." }, { status: 403 });
  }

  const cleanName = sanitize(name, MAX_NAME_LENGTH);
  const cleanEmail = sanitize(email, MAX_EMAIL_LENGTH).toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!calendarShared) {
    return NextResponse.json({ error: "Please confirm you've shared your calendar." }, { status: 400 });
  }

  // Check for existing request with same email
  const { data: existing } = await supabaseAdmin
    .from("join_requests")
    .select("id, status")
    .eq("email", cleanEmail)
    .single();

  if (existing) {
    if (existing.status === "pending") {
      return NextResponse.json({ error: "A request with this email is already pending." }, { status: 409 });
    }
    if (existing.status === "approved") {
      return NextResponse.json({ error: "This email is already part of the team." }, { status: 409 });
    }
    // If rejected, allow re-submission by updating
    const { error: updateError } = await supabaseAdmin
      .from("join_requests")
      .update({
        name: cleanName,
        invite_token: inviteToken,
        calendar_shared: true,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    // Mark invite as used
    await supabaseAdmin
      .from("invite_tokens")
      .update({ is_used: true, used_by_email: cleanEmail })
      .eq("token", inviteToken);

    return NextResponse.json({ success: true });
  }

  // Insert new request
  const { error: insertError } = await supabaseAdmin
    .from("join_requests")
    .insert({
      name: cleanName,
      email: cleanEmail,
      invite_token: inviteToken,
      calendar_shared: true,
      status: "pending",
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "A request with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Mark invite as used
  await supabaseAdmin
    .from("invite_tokens")
    .update({ is_used: true, used_by_email: cleanEmail })
    .eq("token", inviteToken);

  return NextResponse.json({ success: true });
}
