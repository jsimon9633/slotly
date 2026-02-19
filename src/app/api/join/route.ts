import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  badRequest,
  conflict,
  tooManyRequests,
  serverError,
  EMAIL_REGEX,
  sanitizeString,
} from "@/lib/api-errors";

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return tooManyRequests("Too many requests. Please try again later.");
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request.");
  }

  const { name, email, calendarShared, inviteToken } = body;

  // Validate types
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof calendarShared !== "boolean" ||
    typeof inviteToken !== "string"
  ) {
    return badRequest("Invalid input.");
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

  const cleanName = sanitizeString(name, MAX_NAME_LENGTH);
  const cleanEmail = sanitizeString(email, MAX_EMAIL_LENGTH).toLowerCase();

  if (!cleanName || cleanName.length < 2) {
    return badRequest("Please enter your full name.");
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return badRequest("Please enter a valid email address.");
  }

  if (!calendarShared) {
    return badRequest("Please confirm you've shared your calendar.");
  }

  // Check for existing request with same email
  const { data: existing } = await supabaseAdmin
    .from("join_requests")
    .select("id, status")
    .eq("email", cleanEmail)
    .single();

  if (existing) {
    if (existing.status === "pending") {
      return conflict("A request with this email is already pending.");
    }
    if (existing.status === "approved") {
      return conflict("This email is already part of the team.");
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
      return serverError("Something went wrong. Please try again.", updateError, "Join re-submit");
    }

    // Mark invite as used
    const { error: invMarkErr } = await supabaseAdmin
      .from("invite_tokens")
      .update({ is_used: true, used_by_email: cleanEmail })
      .eq("token", inviteToken);

    if (invMarkErr) {
      console.error("[Join] Failed to mark invite as used:", invMarkErr.message);
    }

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
      return conflict("A request with this email already exists.");
    }
    return serverError("Something went wrong. Please try again.", insertError, "Join insert");
  }

  // Mark invite as used
  const { error: invMarkErr } = await supabaseAdmin
    .from("invite_tokens")
    .update({ is_used: true, used_by_email: cleanEmail })
    .eq("token", inviteToken);

  if (invMarkErr) {
    console.error("[Join] Failed to mark invite as used:", invMarkErr.message);
  }

  return NextResponse.json({ success: true });
}
