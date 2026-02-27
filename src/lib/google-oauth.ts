import { google } from "googleapis";
import { randomBytes, createCipheriv, createDecipheriv, createHmac } from "crypto";
import { supabaseAdmin } from "./supabase";

// ── Environment ──

const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || "";

/**
 * Compute the OAuth redirect URI. Prefers env var overrides, falls back
 * to deriving from the incoming request URL (works on any domain including
 * Netlify deploy previews).
 */
export function getRedirectUri(requestUrl?: string): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}/api/auth/google/callback`;
  }
  if (requestUrl) {
    const origin = new URL(requestUrl).origin;
    return `${origin}/api/auth/google/callback`;
  }
  throw new Error(
    "Cannot determine OAuth redirect URI: set GOOGLE_OAUTH_REDIRECT_URI or NEXT_PUBLIC_SITE_URL"
  );
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

// ── Token Encryption (AES-256-GCM) ──

function getEncryptionKey(): Buffer {
  if (!TOKEN_ENCRYPTION_KEY || TOKEN_ENCRYPTION_KEY.length < 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return Buffer.from(TOKEN_ENCRYPTION_KEY, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted token format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// ── OAuth State (CSRF protection via HMAC-signed JWT-like token) ──

export function createOAuthState(payload: Record<string, string>): string {
  const data = JSON.stringify({ ...payload, iat: Date.now() });
  const encoded = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", getEncryptionKey()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyOAuthState(state: string): Record<string, string> | null {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;

  const expectedSig = createHmac("sha256", getEncryptionKey()).update(encoded).digest("base64url");
  if (sig !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    // Expire after 10 minutes
    if (Date.now() - data.iat > 10 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

// ── OAuth URL ──

export function getGoogleOAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Token Exchange ──

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json();
}

// ── Token Refresh ──

export async function refreshAccessToken(encryptedRefreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const refreshToken = decryptToken(encryptedRefreshToken);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Token revoked or invalid
    if (body.includes("invalid_grant") || body.includes("Token has been expired or revoked")) {
      return null;
    }
    throw new Error(`Token refresh failed: ${body}`);
  }

  return res.json();
}

// ── Google User Profile ──

export async function getGoogleUserProfile(accessToken: string): Promise<{
  email: string;
  name: string;
  picture: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google user profile: ${res.status}`);
  }

  return res.json();
}

// ── OAuth-authenticated Calendar Client ──

export function getOAuthCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

// ── Get Valid Access Token for a Member ──
// Refreshes if needed. Returns null if token is revoked.

export async function getValidAccessToken(
  encryptedRefreshToken: string,
  memberId: string
): Promise<string | null> {
  try {
    const result = await refreshAccessToken(encryptedRefreshToken);
    if (!result) {
      // Token revoked — mark member as revoked
      await supabaseAdmin
        .from("team_members")
        .update({ google_oauth_revoked_at: new Date().toISOString() })
        .eq("id", memberId);
      return null;
    }
    return result.access_token;
  } catch (err) {
    console.error(`[OAuth] Token refresh failed for member ${memberId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Re-auth Flow Trigger ──

export async function createReauthToken(teamMemberId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await supabaseAdmin.from("reauth_tokens").insert({
    team_member_id: teamMemberId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function validateReauthToken(token: string): Promise<{
  team_member_id: string;
} | null> {
  const { data } = await supabaseAdmin
    .from("reauth_tokens")
    .select("id, team_member_id, expires_at, is_used")
    .eq("token", token)
    .single();

  if (!data || data.is_used || new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Mark as used
  await supabaseAdmin
    .from("reauth_tokens")
    .update({ is_used: true })
    .eq("id", data.id);

  return { team_member_id: data.team_member_id };
}
