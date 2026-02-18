import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || typeof token !== "string" || token.length < 10 || token.length > 64) {
    return NextResponse.json({ valid: false, error: "Invalid invite link." }, { status: 400 });
  }

  // Only allow alphanumeric tokens (hex)
  if (!/^[a-f0-9]+$/.test(token)) {
    return NextResponse.json({ valid: false, error: "Invalid invite link." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("invite_tokens")
    .select("id, token, is_used, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ valid: false, error: "Invite not found." }, { status: 404 });
  }

  if (data.is_used) {
    return NextResponse.json({ valid: false, error: "This invite has already been used." }, { status: 410 });
  }

  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: "This invite has expired." }, { status: 410 });
  }

  return NextResponse.json({ valid: true });
}
