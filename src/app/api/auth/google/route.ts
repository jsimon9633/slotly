import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, getGoogleOAuthUrl, getRedirectUri } from "@/lib/google-oauth";
import { supabaseAdmin } from "@/lib/supabase";

// Ensure this route is never cached by Next.js / Netlify CDN
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google — Initiate Google OAuth flow
 *
 * Query params:
 *   ?invite={token}    — new member onboarding
 *   ?reauth={token}    — re-auth for existing member
 */
export async function GET(request: NextRequest) {
  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const inviteToken = searchParams.get("invite");
  const reauthToken = searchParams.get("reauth");

  if (!inviteToken && !reauthToken) {
    return NextResponse.redirect(`${SITE_URL}/join?error=missing_params`);
  }

  // Validate invite token if provided
  if (inviteToken) {
    if (inviteToken.length < 10 || inviteToken.length > 64 || !/^[a-f0-9]+$/.test(inviteToken)) {
      return NextResponse.redirect(`${SITE_URL}/join?error=invite_expired`);
    }

    const { data: invite, error: dbError } = await supabaseAdmin
      .from("invite_tokens")
      .select("id, is_used, expires_at")
      .eq("token", inviteToken)
      .single();

    if (dbError) {
      console.error("[Auth Google] invite_tokens lookup failed:", dbError.message, dbError.code);
    }

    if (!invite) {
      console.error("[Auth Google] Invite token not found in DB:", inviteToken.slice(-8));
      return NextResponse.redirect(`${SITE_URL}/join?error=invite_expired`);
    }
    if (invite.is_used) {
      console.error("[Auth Google] Invite already used:", inviteToken.slice(-8));
      return NextResponse.redirect(`${SITE_URL}/join?error=invite_expired`);
    }
    if (new Date(invite.expires_at) < new Date()) {
      console.error("[Auth Google] Invite expired:", inviteToken.slice(-8), invite.expires_at);
      return NextResponse.redirect(`${SITE_URL}/join?error=invite_expired`);
    }

    const redirectUri = getRedirectUri(request.url);
    const state = createOAuthState({ type: "join", invite: inviteToken });
    return NextResponse.redirect(getGoogleOAuthUrl(state, redirectUri));
  }

  // Validate reauth token if provided
  if (reauthToken) {
    if (reauthToken.length < 10 || reauthToken.length > 64 || !/^[a-f0-9]+$/.test(reauthToken)) {
      return NextResponse.redirect(`${SITE_URL}/join?error=reauth_expired`);
    }

    const { data: reauth } = await supabaseAdmin
      .from("reauth_tokens")
      .select("id, team_member_id, is_used, expires_at")
      .eq("token", reauthToken)
      .single();

    if (!reauth || reauth.is_used || new Date(reauth.expires_at) < new Date()) {
      return NextResponse.redirect(`${SITE_URL}/join?error=reauth_expired`);
    }

    const redirectUri = getRedirectUri(request.url);
    const state = createOAuthState({ type: "reauth", reauth: reauthToken, memberId: reauth.team_member_id });
    return NextResponse.redirect(getGoogleOAuthUrl(state, redirectUri));
  }

  return NextResponse.redirect(`${SITE_URL}/join?error=missing_params`);
}
