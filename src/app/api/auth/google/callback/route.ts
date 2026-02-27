import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  verifyOAuthState,
  exchangeCodeForTokens,
  getGoogleUserProfile,
  encryptToken,
  validateReauthToken,
  getRedirectUri,
} from "@/lib/google-oauth";

// Ensure this route is never cached by Next.js / Netlify CDN
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google/callback — Google OAuth callback
 *
 * Handles both new member onboarding and re-auth flows.
 */
export async function GET(request: NextRequest) {
  const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) || new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied consent
  if (error) {
    return NextResponse.redirect(`${SITE_URL}/join?error=consent_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${SITE_URL}/join?error=missing_params`);
  }

  // Verify state (CSRF protection)
  const state = verifyOAuthState(stateParam);
  if (!state) {
    return NextResponse.redirect(`${SITE_URL}/join?error=invalid_state`);
  }

  try {
    // Exchange code for tokens — redirect_uri must match the one used in the initial request
    const redirectUri = getRedirectUri(request.url);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${SITE_URL}/join?error=no_refresh_token`);
    }

    // Fetch Google user profile
    const profile = await getGoogleUserProfile(tokens.access_token);
    if (!profile.email) {
      return NextResponse.redirect(`${SITE_URL}/join?error=no_email`);
    }

    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // ── Join flow (new member) ──
    if (state.type === "join" && state.invite) {
      // Validate invite token is still valid
      const { data: invite } = await supabaseAdmin
        .from("invite_tokens")
        .select("id, is_used, expires_at")
        .eq("token", state.invite)
        .single();

      if (!invite || invite.is_used || new Date(invite.expires_at) < new Date()) {
        return NextResponse.redirect(`${SITE_URL}/join?error=invite_expired`);
      }

      // Check if team member with this email already exists
      const { data: existingMember } = await supabaseAdmin
        .from("team_members")
        .select("id, is_active")
        .eq("email", profile.email.toLowerCase())
        .single();

      if (existingMember) {
        // Update existing member's OAuth tokens and reactivate if needed
        await supabaseAdmin
          .from("team_members")
          .update({
            name: profile.name || existingMember.id,
            avatar_url: profile.picture || null,
            google_calendar_id: profile.email.toLowerCase(),
            google_oauth_refresh_token: encryptedRefreshToken,
            google_oauth_connected_at: new Date().toISOString(),
            google_oauth_revoked_at: null,
            google_oauth_scopes: tokens.scope || null,
          })
          .eq("id", existingMember.id);

        // Mark invite as used
        await supabaseAdmin
          .from("invite_tokens")
          .update({ is_used: true, used_by_email: profile.email.toLowerCase() })
          .eq("token", state.invite);

        const status = existingMember.is_active ? "reconnected" : "reactivated";
        return NextResponse.redirect(
          `${SITE_URL}/join?success=${status}&name=${encodeURIComponent(profile.name || "")}&avatar=${encodeURIComponent(profile.picture || "")}`
        );
      }

      // Create new team member (is_active=false until admin approves)
      const { data: newMember, error: insertError } = await supabaseAdmin
        .from("team_members")
        .insert({
          name: profile.name || profile.email.split("@")[0],
          email: profile.email.toLowerCase(),
          google_calendar_id: profile.email.toLowerCase(),
          avatar_url: profile.picture || null,
          google_oauth_refresh_token: encryptedRefreshToken,
          google_oauth_connected_at: new Date().toISOString(),
          google_oauth_scopes: tokens.scope || null,
          is_active: false, // Admin must approve
        })
        .select("id")
        .single();

      if (insertError || !newMember) {
        console.error("[OAuth Callback] Failed to create team member:", insertError?.message);
        return NextResponse.redirect(`${SITE_URL}/join?error=create_failed`);
      }

      // Create join request for admin approval
      await supabaseAdmin.from("join_requests").insert({
        name: profile.name || profile.email.split("@")[0],
        email: profile.email.toLowerCase(),
        invite_token: state.invite,
        calendar_shared: true, // OAuth-verified
        status: "pending",
      });

      // Mark invite as used
      await supabaseAdmin
        .from("invite_tokens")
        .update({ is_used: true, used_by_email: profile.email.toLowerCase() })
        .eq("token", state.invite);

      return NextResponse.redirect(
        `${SITE_URL}/join?success=true&name=${encodeURIComponent(profile.name || "")}&avatar=${encodeURIComponent(profile.picture || "")}`
      );
    }

    // ── Re-auth flow (existing member) ──
    if (state.type === "reauth" && state.reauth) {
      const reauthResult = await validateReauthToken(state.reauth);
      if (!reauthResult) {
        return NextResponse.redirect(`${SITE_URL}/join?error=reauth_expired`);
      }

      // Verify email matches the team member
      const { data: member } = await supabaseAdmin
        .from("team_members")
        .select("id, email")
        .eq("id", reauthResult.team_member_id)
        .single();

      if (!member || member.email.toLowerCase() !== profile.email.toLowerCase()) {
        return NextResponse.redirect(`${SITE_URL}/join?error=email_mismatch`);
      }

      // Update OAuth tokens
      await supabaseAdmin
        .from("team_members")
        .update({
          avatar_url: profile.picture || null,
          google_oauth_refresh_token: encryptedRefreshToken,
          google_oauth_connected_at: new Date().toISOString(),
          google_oauth_revoked_at: null,
          google_oauth_scopes: tokens.scope || null,
        })
        .eq("id", member.id);

      return NextResponse.redirect(
        `${SITE_URL}/join?reauth=success&name=${encodeURIComponent(profile.name || "")}`
      );
    }

    return NextResponse.redirect(`${SITE_URL}/join?error=invalid_flow`);
  } catch (err) {
    console.error("[OAuth Callback] Error:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(`${SITE_URL}/join?error=server_error`);
  }
}
