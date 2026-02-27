# Slotly: Google OAuth Calendar Integration — Full Plan & Context

> **Created:** 2026-02-26
> **Branch:** `claude/plan-calendar-integration-0m4EV`
> **Status:** Planning complete, ready for implementation
> **Purpose:** Give this file to Claude in any future session to restore full context

---

## Why This Change

Slotly currently uses a single Google service account for all calendar operations. Team members must manually share their Google Calendar with the service account email. This has critical problems:

1. **Silent failures:** If sharing isn't set up correctly, `getFreeBusy()` returns empty — system thinks the member is free all day — double-books them
2. **Wrong calendar placement:** The 3-tier fallback masks failures — bookings "succeed" but events land on the service account's calendar, not the team member's
3. **No connection verification:** The only "check" is an honor-system checkbox during onboarding
4. **Onboarding friction:** Members must navigate Google Calendar settings, find "Share with specific people," paste a service account email, set correct permissions

**The fix:** Per-user Google OAuth. Each team member clicks "Connect with Google" during onboarding. This gives Slotly a verified, detectable connection — either it works or it doesn't.

---

## Design Goals

1. **Simpler than Calendly** — no account creation, no profile form. Invite link → Google OAuth → done.
2. **Auto-pull everything from Google** — name, email, profile photo. Zero manual form fields.
3. **Simple re-auth** — Slack DM notification when tokens expire, with a one-click re-auth link.
4. **Service account kept as fallback** — existing members continue working; gradual migration.

---

## Current Architecture (What Exists Today)

### Service Account Auth (`src/lib/google-calendar.ts`)
- Single service account: `slotly-calendar@slotly-fast-scheduling.iam.gserviceaccount.com`
- JWT auth with `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` env vars
- 3-tier fallback for every operation (create/update/delete events, free/busy):
  - **Tier 1:** Domain-wide delegation (impersonate team member's email)
  - **Tier 2:** Shared calendar (service account has editor access)
  - **Tier 3:** Service account's own calendar (adds both parties as attendees)
- `getCalendarClient(impersonateEmail?)` — single function creates JWT-authenticated client

### Current Onboarding (`src/app/join/page.tsx`)
- Admin generates invite link → `/join?invite={token}`
- 2-step wizard: enter name+email → manually share calendar → checkbox confirmation
- Admin approves on `/admin/join-requests` → manually runs SQL in Supabase
- No actual calendar connection verification

### Database Schema (`team_members` table)
```sql
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  google_calendar_id TEXT NOT NULL,  -- their email (Google Calendar convention)
  is_active BOOLEAN DEFAULT true,
  last_booked_at TIMESTAMPTZ DEFAULT '1970-01-01T00:00:00Z',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Where `google_calendar_id` Is Used
| File | Usage |
|------|-------|
| `src/lib/availability.ts` | `getNextTeamMember()`, `getAllTeamMembers()` — fetched for round-robin |
| `src/lib/availability.ts` | `getAvailableSlots()` → passed to `getFreeBusy()` |
| `src/app/api/book/route.ts` | Passed to `createCalendarEvent()` |
| `src/app/api/manage/[token]/cancel/route.ts` | Passed to `deleteCalendarEvent()` |
| `src/app/api/manage/[token]/reschedule/route.ts` | Passed to `updateCalendarEvent()` |
| `src/app/api/cron/reminders/route.ts` | Fetched with team member data |
| `src/lib/workflows.ts` | `executeTimedWorkflows()` — fetched but not used for calendar ops |

---

## Implementation Plan

### Phase 1: Database Migration

**File:** `supabase/migrations/20260226_add_oauth_columns.sql`

```sql
-- Add OAuth-related columns to team_members
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS google_oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_oauth_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_oauth_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_oauth_scopes TEXT,
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Make google_calendar_id nullable for backward compat
ALTER TABLE team_members ALTER COLUMN google_calendar_id DROP NOT NULL;

-- Index for connection status lookups
CREATE INDEX IF NOT EXISTS idx_team_members_oauth_status
  ON team_members (google_oauth_connected_at, google_oauth_revoked_at)
  WHERE is_active = true;

-- Re-auth tokens for Slack-sent reconnect links
CREATE TABLE IF NOT EXISTS reauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reauth_tokens_token ON reauth_tokens (token) WHERE is_used = false;

-- Slack config in site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS slack_bot_token TEXT;
```

### Phase 2: New Environment Variables

| Variable | Purpose |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM encryption of refresh tokens |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for re-auth notifications |

Existing `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` stay for fallback.

### Phase 3: New Lib — `src/lib/google-oauth.ts`

Core functions:
- `encryptToken(token)` / `decryptToken(encrypted)` — AES-256-GCM using `TOKEN_ENCRYPTION_KEY`
- `getGoogleOAuthUrl(state)` — Builds consent URL with scopes: `calendar`, `userinfo.email`, `userinfo.profile`. Uses `access_type=offline`, `prompt=consent`.
- `exchangeCodeForTokens(code)` — POST to `https://oauth2.googleapis.com/token`
- `refreshAccessToken(encryptedRefreshToken)` — Decrypt, refresh, return new access token. Returns `null` if token revoked.
- `getGoogleUserProfile(accessToken)` — GET `https://www.googleapis.com/oauth2/v2/userinfo` → `{ email, name, picture }`
- `getOAuthCalendarClient(accessToken)` — Creates Google Calendar client using OAuth2 access token
- `getValidAccessToken(member)` — Check if cached access token is still valid, refresh if needed, update DB

### Phase 4: Refactor `src/lib/google-calendar.ts`

**New 2-tier auth (replaces 3-tier):**

| Tier | Strategy | When |
|------|----------|------|
| 1 | **Per-user OAuth** — OAuth2 client with member's access token, calendar = `"primary"` | Primary path for OAuth-connected members |
| 2 | **Service account fallback** — existing JWT auth | When OAuth token invalid AND refresh fails |

All exported functions gain an optional `oauthRefreshToken?: string` parameter:
- `getFreeBusy(calendarId, timeMin, timeMax, oauthRefreshToken?)`
- `createCalendarEvent({ ...existing, oauthRefreshToken? })`
- `updateCalendarEvent({ ...existing, oauthRefreshToken? })`
- `deleteCalendarEvent(eventId, calendarId, oauthRefreshToken?)`

Internal flow for each function:
1. If `oauthRefreshToken` provided → try OAuth client on `"primary"` calendar
2. If OAuth fails or no token → fall back to existing service account tiers
3. If OAuth token revoked → trigger re-auth notification, use service account

**Zero breaking changes** — callers that don't pass the new param get identical behavior to today.

### Phase 5: Update `src/lib/availability.ts`

- Extend selects to include `google_oauth_refresh_token`:
  ```
  .select("id, name, email, google_calendar_id, google_oauth_refresh_token")
  ```
- Pass token through `getAvailableSlots()` → `getFreeBusy()`
- Filter out members with `google_oauth_revoked_at IS NOT NULL` and no fallback

### Phase 6: Update Booking/Cancel/Reschedule Routes

All three routes add `google_oauth_refresh_token` to their team member select and pass it to calendar functions:
- `src/app/api/book/route.ts` → `createCalendarEvent()`
- `src/app/api/manage/[token]/cancel/route.ts` → `deleteCalendarEvent()`
- `src/app/api/manage/[token]/reschedule/route.ts` → `updateCalendarEvent()`

### Phase 7: New OAuth API Routes

**`src/app/api/auth/google/route.ts`** — Start OAuth flow
- `GET /api/auth/google?invite={token}` — new member onboarding
- `GET /api/auth/google?reauth={reauthToken}` — re-auth for existing member
- Creates signed state JWT, redirects to Google consent URL

**`src/app/api/auth/google/callback/route.ts`** — OAuth callback
- Exchanges code for tokens
- Fetches Google userinfo (name, email, avatar)
- **For new members:** validates invite, creates team_member (is_active=false), creates join_request (pending), marks invite used, redirects to success
- **For re-auth:** validates reauth token, updates member's OAuth tokens, clears revoked_at, redirects to success
- **CSRF protection:** validates state JWT signature and expiry

**`src/app/api/auth/status/route.ts`** — Admin connection status check

### Phase 8: Rewrite Join Page (`src/app/join/page.tsx`)

**New flow (single action, no form):**
1. Validate invite token (same as today)
2. Show "Connect with Google" button — links to `/api/auth/google?invite={token}`
3. Google consent screen → callback auto-creates member
4. Redirect back to `/join?success=true` → show "You're connected!" with avatar + name

**No form fields.** Everything comes from Google.

### Phase 9: Update Admin Join Requests

**`src/app/admin/join-requests/page.tsx`:**
- Remove SQL snippet generation (no longer needed)
- Show avatar + connection status (green/red indicator)
- "Approve" now sets `is_active=true`, creates availability rules + team membership server-side

**`src/app/api/admin/join-requests/route.ts`:**
- PATCH handler auto-provisions on approval: activate member, create availability rules, create team membership

### Phase 10: Slack Re-Auth Notifications

**`src/lib/slack-notify.ts`:**
- `sendSlackReauthNotification({ name, email, reauthUrl, slackUserId? })` — Posts to Slack webhook or sends DM
- Message: ":warning: {name}'s calendar connection expired. Click to reconnect: {link}"

**`src/lib/google-oauth.ts` — `triggerReauthFlow(memberId)`:**
1. Set `google_oauth_revoked_at` on member
2. Create reauth_tokens row (7-day expiry)
3. Send Slack notification with re-auth link

**Add to cron** (`src/app/api/cron/reminders/route.ts`):
- Periodic token health check — attempt refresh for tokens expiring soon
- Trigger re-auth flow for any that fail

### Phase 11: Migrate Existing Members

- Deploy with service account fallback active — zero disruption
- Admin panel shows "Service Account (legacy)" for un-migrated members
- Admin can generate "reconnect" links for existing members
- Members click link → OAuth → tokens stored → connection upgraded to OAuth
- Members who never migrate continue working via service account

### Phase 12: Update Types

**`src/lib/types.ts`:**
```typescript
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  google_calendar_id: string;
  avatar_url: string | null;
  google_oauth_refresh_token?: string;  // server-side only
  google_oauth_connected_at?: string;
  google_oauth_revoked_at?: string;
  is_active: boolean;
  last_booked_at: string;
}
```

---

## Build Order Summary

1. DB migration (non-breaking, all nullable columns)
2. `google-oauth.ts` (encryption, OAuth helpers)
3. Refactor `google-calendar.ts` (add OAuth path, keep service account fallback)
4. Refactor `availability.ts` (propagate OAuth tokens)
5. Update booking/cancel/reschedule routes (pass OAuth tokens)
6. OAuth API routes (`/api/auth/google` + callback)
7. Rewrite join page (single Google button)
8. Update admin join-requests (auto-provision on approve)
9. `slack-notify.ts` + cron health check
10. Admin connection status UI
11. Types update throughout

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/google-oauth.ts` | OAuth URL generation, token exchange, refresh, encryption |
| `src/lib/slack-notify.ts` | Slack DM/webhook notifications |
| `src/app/api/auth/google/route.ts` | Initiate OAuth flow |
| `src/app/api/auth/google/callback/route.ts` | OAuth callback handler |
| `src/app/api/auth/status/route.ts` | Connection status check (admin) |
| `src/app/join/success/page.tsx` | Post-OAuth success page (optional, can use query params) |
| `supabase/migrations/20260226_add_oauth_columns.sql` | DB migration |

## Modified Files

| File | Changes |
|---|---|
| `src/lib/google-calendar.ts` | Add OAuth client path, 2-tier auth |
| `src/lib/availability.ts` | Fetch/pass OAuth refresh tokens |
| `src/lib/types.ts` | Extend TeamMember with OAuth + avatar fields |
| `src/app/api/book/route.ts` | Pass OAuth token to createCalendarEvent |
| `src/app/api/manage/[token]/cancel/route.ts` | Pass OAuth token to deleteCalendarEvent |
| `src/app/api/manage/[token]/reschedule/route.ts` | Pass OAuth token to updateCalendarEvent |
| `src/app/join/page.tsx` | Replace form wizard with single Google OAuth button |
| `src/app/api/join/route.ts` | Simplify (OAuth callback handles creation) |
| `src/app/api/admin/join-requests/route.ts` | Auto-provision on approval |
| `src/app/admin/join-requests/page.tsx` | Remove SQL block, add avatar/status |
| `src/app/api/cron/reminders/route.ts` | Add token health check |

---

## Google Cloud Console Setup Required (Manual — Alberto)

1. Go to Google Cloud Console → project `slotly-fast-scheduling`
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://sparkling-tarsier-bc26ef.netlify.app/api/auth/google/callback`
4. Netlify deploy preview URLs will also need to be added as authorized redirect URIs when testing
5. OAuth consent screen: "Slotly", scopes: `calendar`, `userinfo.profile`, `userinfo.email`
6. Set to **"Internal"** (Workspace-only — confirmed). No app verification needed.
7. Copy Client ID + Client Secret → add to Netlify env vars

---

## Verification Plan

1. `npx tsc --noEmit` — type check after all changes
2. New member flow: generate invite → click → OAuth → verify member in Supabase with tokens + avatar
3. Booking: book meeting → verify Calendar event created via OAuth (check Google Calendar)
4. Availability: check `/api/availability` returns correct slots using OAuth free/busy
5. Cancel/Reschedule: test both, verify calendar events updated via OAuth
6. Token expiry: manually expire token in DB → verify cron detects → verify Slack DM sent
7. Re-auth: click re-auth link → OAuth → verify tokens updated, status = connected
8. Fallback: remove OAuth token for a member → verify service account fallback still works
9. Admin panel: verify connection status indicators
10. Deploy preview: full flow on Netlify deploy preview

---

## Previous Discussion Context

The user (Alberto) evaluated Calendly's approach vs Slotly's current service account approach. Key conclusions from that discussion:

- **Biggest argument for OAuth:** reliability — failures are detectable and recoverable, vs service account's dangerous silent failures
- **Biggest argument for service account:** simplicity and avoiding Google's OAuth app verification process
- **Decision:** Go with OAuth, but keep service account as fallback
- **Onboarding preference:** simpler than Calendly — no account creation, no profile form, just OAuth connect. Pull avatar from Google automatically.
- **Re-auth preference:** Slack DM notification with reconnect link (Slack workspace available, can create webhook/bot)
- **OAuth consent screen:** Internal (Workspace-only) — no Google app verification needed
- **Scope:** minimal — just what's needed, no over-engineering
