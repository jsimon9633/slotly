import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { badRequest, notFound, gone, serverError } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || typeof token !== "string" || token.length < 10 || token.length > 64) {
    return badRequest("Invalid invite link.");
  }

  // Only allow alphanumeric tokens (hex)
  if (!/^[a-f0-9]+$/.test(token)) {
    return badRequest("Invalid invite link.");
  }

  const { data, error } = await supabaseAdmin
    .from("invite_tokens")
    .select("id, token, is_used, expires_at")
    .eq("token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return notFound("Invite");
    }
    return serverError("Unable to validate invite. Please try again.", error, "Invite validate");
  }

  if (!data) {
    return notFound("Invite");
  }

  if (data.is_used) {
    return gone("This invite has already been used.");
  }

  if (new Date(data.expires_at) < new Date()) {
    return gone("This invite has expired.");
  }

  return NextResponse.json({ valid: true });
}
