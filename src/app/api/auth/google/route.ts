import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, getGoogleOAuthUrl, getRedirectUri } from "@/lib/google-oauth";
import { supabaseAdmin } from "@/lib/supabase";
import { badRequest } from "@/lib/api-errors";

/**
 * GET /api/auth/google — Initiate Google OAuth flow
 *
 * Query params:
 *   ?invite={token}    — new member onboarding
 *   ?reauth={token}    — re-auth for existing member
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteToken = searchParams.get("invite");
  const reauthToken = searchParams.get("reauth");

  if (!inviteToken && !reauthToken) {
    return badRequest("Missing invite or reauth token");
  }

  // Validate invite token if provided
  if (inviteToken) {
    if (inviteToken.length < 10 || inviteToken.length > 64 || !/^[a-f0-9]+$/.test(inviteToken)) {
      return badRequest("Invalid invite token");
    }

    const { data: invite } = await supabaseAdmin
      .from("invite_tokens")
      .select("id, is_used, expires_at")
      .eq("token", inviteToken)
      .single();

    if (!invite || invite.is_used || new Date(invite.expires_at) < new Date()) {
      return badRequest("This invite link is invalid or has expired.");
    }

    const redirectUri = getRedirectUri(request.url);
    const state = createOAuthState({ type: "join", invite: inviteToken });
    return NextResponse.redirect(getGoogleOAuthUrl(state, redirectUri));
  }

  // Validate reauth token if provided
  if (reauthToken) {
    if (reauthToken.length < 10 || reauthToken.length > 64 || !/^[a-f0-9]+$/.test(reauthToken)) {
      return badRequest("Invalid reauth token");
    }

    const { data: reauth } = await supabaseAdmin
      .from("reauth_tokens")
      .select("id, team_member_id, is_used, expires_at")
      .eq("token", reauthToken)
      .single();

    if (!reauth || reauth.is_used || new Date(reauth.expires_at) < new Date()) {
      return badRequest("This reconnect link is invalid or has expired.");
    }

    const redirectUri = getRedirectUri(request.url);
    const state = createOAuthState({ type: "reauth", reauth: reauthToken, memberId: reauth.team_member_id });
    return NextResponse.redirect(getGoogleOAuthUrl(state, redirectUri));
  }

  return badRequest("Invalid request");
}
