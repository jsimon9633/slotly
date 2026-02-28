# Slotly — Project Knowledge Base

> **Last updated:** 2026-02-28 (Session 4)
> **Owner:** Alberto (asimon@masterworks.com)
> **Repo:** https://github.com/jsimon9633/slotly
> **Live URL:** https://sparkling-tarsier-bc26ef.netlify.app/
> **Deploy:** Netlify (auto-deploys on push to `main`, deploy previews on PRs)

---

## Stack

- **Framework:** Next.js 16, App Router, TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Calendar:** Google Calendar API via per-user OAuth (primary) + service account (fallback)
- **Email:** SendGrid (confirmation, reminders, workflow emails)
- **Hosting:** Netlify (serverless functions)
- **Date utils:** date-fns + date-fns-tz

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Calendar service account email |
| `GOOGLE_PRIVATE_KEY` | Google Calendar service account private key |
| `SENDGRID_API_KEY` | SendGrid API key for transactional email |
| `EMAIL_FROM` | Sender email address |
| `EMAIL_FROM_NAME` | Sender display name |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (for links in emails) |
| `ADMIN_TOKEN` | Admin panel auth token (`slotly-jsimon9633-2026`) |
| `ADMIN_USERNAME` | Admin panel username (`albertos`) |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 2.0 client ID (from Google Cloud Console) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | (optional) Override OAuth callback URL; auto-derived from request URL if not set. **Set this to production callback URL to fix deploy preview OAuth.** |
| `GOOGLE_OAUTH_HD` | (optional) Google Workspace domain (e.g. `masterworks.com`) — restricts account picker to that domain, prevents personal Gmail sign-in errors |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex string (64 hex chars) for AES-256-GCM encryption of OAuth tokens |
| `SLACK_BOT_TOKEN` | (optional) Slack bot token for re-auth DM notifications |
| `SLACK_WEBHOOK_URL` | (optional) Slack webhook for channel notifications |
| `CRON_SECRET` | Bearer token for cron endpoints |

---

## Architecture Overview

```
src/
├── app/
│   ├── page.tsx                          # Homepage / landing
│   ├── HomeClient.tsx                    # Client-side homepage component
│   ├── layout.tsx                        # Root layout
│   ├── not-found.tsx                     # 404 page
│   │
│   ├── book/
│   │   ├── [slug]/
│   │   │   ├── page.tsx                  # Team landing: shows event types for a team
│   │   │   └── [eventSlug]/
│   │   │       ├── page.tsx              # Server component: fetches event type data
│   │   │       └── BookingClient.tsx     # Client component: full booking flow
│   │   └── loading.tsx
│   │
│   ├── manage/[token]/
│   │   ├── page.tsx                      # View booking details via manage token
│   │   ├── cancel/page.tsx               # Cancel booking
│   │   └── reschedule/page.tsx           # Reschedule booking
│   │
│   ├── join/page.tsx                     # Team member join page (Google OAuth onboarding)
│   ├── embed/page.tsx                    # Embeddable booking widget
│   │
│   ├── admin/
│   │   ├── page.tsx                      # Redirects to /admin/settings
│   │   ├── settings/page.tsx             # Event types, buffers, limits, booking questions, descriptions
│   │   ├── teams/page.tsx                # Team management, members, round-robin config
│   │   ├── analytics/page.tsx            # Booking analytics dashboard
│   │   ├── branding/page.tsx             # Company name, logo, colors
│   │   ├── webhooks/page.tsx             # Webhook management
│   │   ├── workflows/page.tsx            # Workflow automations (email/SMS triggers)
│   │   └── join-requests/page.tsx        # Approve/reject team join requests
│   │
│   └── api/
│       ├── event-types/route.ts          # Public: GET event types
│       ├── availability/route.ts         # Public: GET available slots for a date
│       ├── book/route.ts                 # Public: POST create booking (uses OAuth tokens)
│       ├── team/route.ts                 # Public: GET team info
│       ├── teams/route.ts                # Public: GET all teams
│       ├── settings/route.ts             # Public: GET site branding settings
│       ├── join/route.ts                 # Public: POST join team request
│       ├── invite/validate/route.ts      # Public: GET validate invite link
│       │
│       ├── auth/
│       │   └── google/
│       │       ├── route.ts              # GET: initiate Google OAuth flow (?invite= or ?reauth=)
│       │       └── callback/route.ts     # GET: Google OAuth callback (creates/updates members)
│       │   └── status/route.ts           # GET: admin OAuth status; POST: generate re-auth links
│       │
│       ├── manage/[token]/
│       │   ├── route.ts                  # GET booking by manage token
│       │   ├── cancel/route.ts           # POST cancel booking (uses OAuth tokens)
│       │   └── reschedule/route.ts       # POST reschedule booking (uses OAuth tokens)
│       │
│       ├── cron/reminders/route.ts       # Cron: send booking reminders + OAuth token health check
│       │
│       └── admin/
│           ├── event-types/route.ts      # CRUD event types (GET, POST, PATCH, DELETE)
│           ├── team-members/route.ts     # CRUD team members
│           ├── teams/route.ts            # CRUD teams
│           ├── teams/[teamId]/members/route.ts  # Manage team memberships (includes OAuth status)
│           ├── team-event-links/route.ts # Link event types to teams
│           ├── analytics/route.ts        # GET analytics data
│           ├── bookings/outcome/route.ts # PATCH: mark booking outcome (completed/no-show)
│           ├── webhooks/route.ts         # CRUD webhooks
│           ├── workflows/route.ts        # CRUD workflow automations
│           ├── invite/route.ts           # POST/GET/DELETE: manage invite links
│           ├── join-requests/route.ts    # GET/PATCH: manage join requests
│           └── sms-settings/route.ts     # GET/PATCH: SMS notification settings
│
├── lib/
│   ├── supabase.ts                       # Supabase client (admin + public)
│   ├── google-calendar.ts                # Google Calendar API wrapper (OAuth + service account fallback)
│   ├── google-oauth.ts                   # Google OAuth: token encryption, exchange, refresh, state management
│   ├── availability.ts                   # Slot generation + round-robin logic (passes OAuth tokens)
│   ├── smart-scheduling.ts               # "Popular" / "Recommended" slot badges
│   ├── no-show-score.ts                  # No-show risk scoring (0-100)
│   ├── email.ts                          # SendGrid email templates
│   ├── slack-notify.ts                   # Slack DM/webhook notifications for re-auth
│   ├── webhooks.ts                       # Webhook delivery + HMAC signing + retry
│   ├── workflows.ts                      # Workflow automation engine (email/SMS triggers)
│   ├── api-errors.ts                     # Standardized API error responses
│   └── types.ts                          # TypeScript interfaces
│
├── public/
│   ├── embed.js                          # Embeddable widget script
│   └── mockup.html                       # Design mockup reference
│
└── supabase/
    ├── schema.sql                        # Full database schema + seed data
    └── migrations/
        ├── 20260219_add_teams.sql                # Teams, memberships, availability rules
        ├── 20260219_add_noshow_and_smart_scheduling.sql # No-show scoring + smart scheduling columns
        ├── 20260226_add_google_oauth.sql         # OAuth columns on team_members, reauth_tokens table, invite_tokens table
        ├── 20260227_add_round_robin_toggle.sql   # in_round_robin boolean on team_memberships (default true)
        └── 20260228_add_team_display_settings.sql # layout_style + calendar_style columns on teams
```

---

## Database Tables (Supabase)

| Table | Purpose |
|---|---|
| `team_members` | People who can be booked (name, email, Google Calendar ID, OAuth tokens, avatar_url, last_booked_at for round-robin) |
| `event_types` | Bookable events (title, slug, description, duration, color, buffers, limits, booking_questions) |
| `bookings` | All bookings (invitee info, start/end time, status, manage_token, no_show_score, risk_tier, outcome, custom_answers, reminder_sent_at) |
| `availability_rules` | Per-member working hours by day of week |
| `teams` | Team groupings (name, slug, description, layout_style, calendar_style) |
| `team_memberships` | Many-to-many: members ↔ teams with roles (admin/member), `in_round_robin` toggle per membership |
| `team_event_types` | Many-to-many: event types ↔ teams (allows one event type in multiple teams) |
| `webhooks` | Webhook endpoints (URL, secret, subscribed events) |
| `webhook_logs` | Delivery logs (status code, response, success) |
| `site_settings` | Branding config (company name, logo URL, primary/accent colors) |
| `workflows` | Workflow automations (trigger, action, recipient, template) |
| `join_requests` | Team member join requests (pending/approved/rejected) |
| `invite_tokens` | Invite links for OAuth onboarding (token, is_used, used_by_email, expires_at) |
| `reauth_tokens` | Re-auth links for reconnecting expired OAuth (token, team_member_id, is_used, expires_at) |
| `sms_settings` | SMS notification config |

---

## Features — What's Built

### Core Booking Flow
- **Team landing page** (`/book/[teamSlug]`) — shows all event types for a team with descriptions
- **Booking page** (`/book/[teamSlug]/[eventSlug]`) — 4-step flow: Date → Time → Form → Confirmed
- **Horizontal date strip** — scrollable date picker with available dates highlighted
- **Smart time slot grid** — 3-column grid with "Popular" and "Top Pick" badges based on booking intelligence
- **Booking form** — name, email, international phone picker with country flags, topic suggestion chips, notes field, custom booking questions
- **Event type description** — displayed on booking page below title (text with line break preservation)
- **Add to Calendar** — Google Calendar, Outlook, and iCal (.ics download) buttons on confirmation screen
- **Round-robin assignment** — books the team member who hasn't been booked in the longest time; per-team `in_round_robin` toggle controls which members participate
- **Round-robin member display** — homepage team cards and `/book/[teamSlug]` pages show "Round-robin across" with emoji pills for active members (dynamically queries `team_memberships.in_round_robin`)
- **Real-time availability** — checks Google Calendar free/busy + availability rules + buffer times
- **Timezone support** — auto-detects user timezone, searchable timezone picker
- **Google Meet auto-creation** — every booking creates a Google Meet link (via `conferenceData` on Calendar event), included in confirmation emails with join button + dial-in details
- **Multi-team event types** — one event type can belong to multiple teams via `team_event_types` join table; team landing pages, booking pages, and APIs all resolve through both direct `team_id` and the join table
- **Booking confirmation emails** — HTML emails via SendGrid with meeting details + manage link
- **Organizer avatar + name** — booking page shows the team member's avatar (from Google OAuth) and first name on the confirmation step; avatar shown as circular image with initials fallback
- **Expanded layout** (admin-configurable) — two-panel desktop layout: left panel shows event details (title, duration, description, team member avatars); right panel shows date/time selection. Compact widths optimized for 13" embed (256px left panel, 24px gap, max-w-3xl container). Admin toggles via "Expanded Layout" setting per team. DB value remains `"two-panel"` for backwards compat.
- **Month calendar view** (admin-configurable) — full month grid alternative to horizontal date strip. Shows clickable day cells with available-date highlighting (dot indicator), weekday headers, month/year navigation. Auto-advances to the first bookable month on init (skips past/weekend-only months). Forward navigation disabled past `max_advance_days`. Admin toggles via "Calendar Style" setting per team.
- **ISR + `generateStaticParams`** — booking pages pre-rendered at build time via `generateStaticParams()` (resolves all team+event combinations), served from CDN with ISR revalidation every 60s for zero cold-start loads

### Google OAuth Calendar Integration
- **Per-user OAuth** — each team member connects their Google Calendar via "Sign in with Google" (replaces manual calendar sharing)
- **OAuth onboarding** — invite link → `/join?invite={token}` → "Connect with Google" button → Google consent → member auto-created with name, email, avatar from Google
- **Token encryption** — refresh tokens encrypted with AES-256-GCM (via `TOKEN_ENCRYPTION_KEY`) before storage in Supabase
- **2-tier calendar auth** — OAuth token used as primary auth for all calendar operations; service account as fallback if OAuth fails
- **Token health check** — cron job (in `/api/cron/reminders`) detects revoked/expired tokens, sends Slack DM with reconnect link
- **Re-auth flow** — admin generates re-auth link from `/api/auth/status`, member clicks link → Google OAuth → tokens refreshed
- **CSRF protection** — OAuth state parameter is HMAC-SHA256 signed with 10-minute expiry
- **Connection status** — admin API at `/api/auth/status` shows connected/disconnected/revoked per member
- **Redirect URI auto-detection** — OAuth redirect URI derived from request URL at runtime; `GOOGLE_OAUTH_REDIRECT_URI` env var overrides for consistent behavior across deploy previews
- **Workspace domain restriction** — `GOOGLE_OAUTH_HD` env var adds `hd` parameter to Google OAuth URL, restricting account picker to the specified Workspace domain (prevents personal Gmail sign-in)
- **Error redirects** — `/api/auth/google` redirects to `/join?error=...` on all errors (instead of returning raw JSON), so users always see a proper error page with actionable messages
- **Consent error guidance** — if Google blocks the connection (wrong account type), error page explains the likely cause and offers a "Try again with a different account" button
- **"Use work account" hint** — Connect step includes guidance to sign in with work Google account, not personal Gmail
- **force-dynamic** — all auth/invite API routes export `dynamic = "force-dynamic"` to prevent Next.js/Netlify CDN caching
- **Server-side logging** — invite validation and OAuth initiation log specific failure reasons (token not found, already used, expired, DB errors) for debugging

### Booking Management
- **Manage booking page** (`/manage/[token]`) — view booking details via unique token
- **Cancel booking** — invitee self-service cancellation with Google Calendar event deletion
- **Reschedule booking** — invitee self-service rescheduling

### Admin Panel (`/admin`)
- **Token-based auth** — username + token login, session persistence
- **Event type settings** — create, edit, lock/unlock, activate/deactivate event types
- **Event type description editing** — inline textarea editor with 1000-char limit
- **Booking questions** — add custom text/dropdown/checkbox questions per event type
- **Buffer configuration** — before/after buffer minutes per event type
- **Booking limits** — min notice hours, max daily bookings, max advance days
- **Team management** — create teams, add/remove members, set roles (admin/member), per-member round-robin toggle (include/exclude from scheduling), copy booking link button on team cards, per-team display settings (Expanded Layout toggle, Calendar Style toggle)
- **Team invites** — generate invite links, approve/reject join requests
- **Analytics dashboard** — booking volume timeline, event type breakdown, team utilization, peak days/hours, cancellation rates (7/30/90 day views)
- **Booking outcomes** — mark bookings as completed/no-show for data collection
- **Branding** — company name, logo URL, primary/accent color pickers
- **Webhooks** — CRUD with HMAC-signed delivery, retry with exponential backoff, delivery logs
- **Workflow automations** — trigger-based email/SMS on booking events (on_booking, on_cancel, on_reschedule, before_meeting, after_meeting)
- **SMS settings** — SMS notification configuration (beta)

### Intelligence Features
- **Smart scheduling** (`src/lib/smart-scheduling.ts`) — surfaces "Popular" and "Recommended" time badges based on industry defaults (Tue-Thu, 10am-2pm) with planned upgrade to booking-history-based intelligence once enough data accumulates
- **No-show risk scoring** (`src/lib/no-show-score.ts`) — weighted heuristic model (0-100) based on lead time, day/hour, repeat booker status, topic/notes presence. Stored per booking for future model training

### Infrastructure
- **Embed widget** (`/public/embed.js`) — script tag for embedding booking on external sites, with iframe support
- **Security headers** — HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy in `next.config.ts`
- **Frame policy** — booking pages allow embedding (`frame-ancestors *`), homepage blocks it (`SAMEORIGIN`), API routes deny it
- **Cache headers** — static assets cached 1 year (immutable), embed script cached 1 day, API routes no-cache
- **Server-external packages** — googleapis, @sendgrid/mail, resend excluded from client bundle
- **Cron reminder endpoint** — `/api/cron/reminders` for scheduled booking reminders
- **Standardized API errors** — consistent error response format via `api-errors.ts`
- **Enhanced email templates** — booking confirmation, cancellation, reschedule, and new-booking-alert emails all include Google Meet join button with dial-in details, manage link buttons (reschedule/cancel), and clean table-based HTML layout compatible with all email clients

---

## Known Issues / Pending

### Google OAuth `redirect_uri_mismatch` (ACTIVE — 2026-02-27)
**Status:** Seeing `Error 400: redirect_uri_mismatch` on production. Google shows "Access blocked: This app's request is invalid."

**Root cause investigation:**
- Both production and deploy preview callback URLs are registered in Google Cloud Console
- The `getRedirectUri()` function resolves the redirect URI in this priority: `GOOGLE_OAUTH_REDIRECT_URI` env var → `NEXT_PUBLIC_SITE_URL` + `/api/auth/google/callback` → auto-derive from request URL
- If `NEXT_PUBLIC_SITE_URL` is not set (or set incorrectly), the redirect URI derived at runtime may not match what's registered in Google Cloud Console
- The error appears regardless of which Google account is signed in (personal vs Workspace)

**To resolve — check these in order:**
1. In Netlify env vars, verify `NEXT_PUBLIC_SITE_URL` is set to `https://sparkling-tarsier-bc26ef.netlify.app` (no trailing slash)
2. In Google Cloud Console → APIs & Services → Credentials → OAuth client, verify `https://sparkling-tarsier-bc26ef.netlify.app/api/auth/google/callback` is in the authorized redirect URIs list
3. If still failing, set `GOOGLE_OAUTH_REDIRECT_URI` = `https://sparkling-tarsier-bc26ef.netlify.app/api/auth/google/callback` explicitly in Netlify env vars (this overrides all auto-detection)
4. After changing env vars, **redeploy** (Netlify reads env vars at build time for `NEXT_PUBLIC_` vars and at function runtime for others)

**Workaround:** The `GOOGLE_OAUTH_REDIRECT_URI` env var is the most reliable fix — it forces all environments to use the exact registered callback URL regardless of which domain serves the page.

### Session 4 QA Fixes (2026-02-28)
All resolved:
- **Parallelized server queries** — booking `page.tsx` now fetches team + settings via `Promise.all` instead of sequentially (saves ~50-100ms per page load)
- **Month calendar forward bound** — forward arrow disabled when next month exceeds `max_advance_days` (was infinite scroll)
- **Month calendar auto-advance** — initializes to first bookable month, not current month (fixes dead-month bug when remaining days are past/weekend)
- **Duplicate `maxDate` cleanup** — removed duplicate computation, moved to single declaration after `days` array

---

## Features — What's Not Built Yet

### High Priority
- **AI Meeting Prep** — enrichment pipeline: booking history → Google search (name+email) → phone fallback → email handle clues → domain scrape (opportunistic) → Claude API synthesis. See `docs/Slotly Enrichment Services to Explore.docx`
- **Email template customization** — allow admins to customize confirmation/reminder email templates in the UI
- **Multi-language support** — i18n for booking pages

### Lower Priority
- **Booking analytics export** — CSV/Excel export of booking data
- **Calendar sync improvements** — handle Google Calendar API rate limits more gracefully, add retry logic
- **Team member availability overrides** — one-off date overrides (e.g., "unavailable Dec 25")
- **Recurring bookings** — allow invitees to book recurring slots
- **Waitlist** — when all slots are full, allow invitees to join a waitlist
- **Custom domains** — let teams use their own domain for booking pages
- **Payment integration** — Stripe for paid consultations

---

## Key Technical Patterns

### Round-Robin Algorithm
1. Query `team_members` sorted by `last_booked_at ASC` — longest-idle member goes next
2. **Filter by `in_round_robin`** — only members with `team_memberships.in_round_robin = true` participate (admin can toggle per member per team)
3. Check that member's Google Calendar free/busy + availability rules + buffer times
4. If available: create Google Calendar event, create booking, update `last_booked_at`
5. If not: try next member in the round-robin order

### Team Member Onboarding Flow (OAuth)
```
Admin generates invite link → /admin/join-requests (People tab)
  → invite_tokens row created (32-char hex, 7-day expiry)
  → admin sends link to team member

Team member clicks invite link → /join?invite={token}
  → validates invite token (hex, 10-64 chars, not expired, not used)
  → shows "Connect with Google" button
  → click → GET /api/auth/google?invite={token}
    → validates invite again
    → creates HMAC-signed state (type=join, invite token, 10-min expiry)
    → redirects to Google OAuth consent screen
  → user approves scopes (calendar, userinfo.email, userinfo.profile, openid)
  → Google redirects to /api/auth/google/callback?code={code}&state={state}
    → verifies state (HMAC + expiry)
    → exchanges code for access + refresh tokens
    → fetches Google userinfo (name, email, picture)
    → encrypts refresh token (AES-256-GCM)
    → creates team_members row (is_active=false, pending admin approval)
    → creates join_requests row (status=pending)
    → marks invite_tokens as used
    → redirects to /join?success=true&name={name}&avatar={avatar}
  → success page shows avatar + name + "pending admin approval" message

Admin approves in /admin/join-requests → member activated
```

### Booking Flow Data Pipeline
```
Public booking page (SSR) → fetches eventType (including description) from Supabase
BookingClient (CSR) → fetches availability slots via /api/availability
  → user picks date → fetches time slots (uses member's OAuth token for getFreeBusy)
  → user picks time → shows form
  → user submits → POST /api/book
    → validates inputs + rate limits
    → calculates no-show risk score
    → round-robin assigns team member
    → fetches member's google_oauth_refresh_token
    → creates Google Calendar event (OAuth primary, service account fallback)
    → creates Supabase booking row
    → sends confirmation email (SendGrid)
    → fires webhooks (best-effort, non-blocking)
    → triggers workflow automations
    → returns confirmation with start_time, end_time, team_member_name, event_type
```

### Team ↔ Event Type Resolution
Event types can belong to teams via two paths (both are checked everywhere):
1. **Direct FK** — `event_types.team_id` column (legacy, used by the default team)
2. **Join table** — `team_event_types` many-to-many table (used when one event type is shared across multiple teams)

All public pages and APIs (team landing, booking page, `/api/availability`, `/api/book`) check both paths: direct `team_id` match first, then fall back to `team_event_types` join table lookup. Admin APIs already use the join table exclusively.

### Layout & Calendar Configuration
Teams have two admin-configurable display settings stored in the `teams` table:
- **`layout_style`** — `"single"` (default) or `"two-panel"`. The `"two-panel"` value maps to "Expanded Layout" in the admin UI. BookingClient reads this as `isTwoPanel` (variable name kept for backwards compat). At `md:` breakpoint, renders left details panel + right booking panel.
- **`calendar_style`** — `"strip"` (default) or `"month"`. Controls whether the date picker is a horizontal scrollable strip or a full month grid calendar. Month calendar auto-advances to the first bookable month and disables forward navigation past `max_advance_days`.

Both settings flow from server component (`page.tsx`) → client component (`BookingClient.tsx`) as props. The server component fetches `layout_style` and `calendar_style` from the `teams` table alongside the team data.

### Smart Scheduling Badge Logic
- **Phase 1 (current):** Industry defaults — Tue/Wed/Thu + 10am-2pm slots get "Popular" badge
- **Phase 2 (planned):** Once MIN_BOOKINGS_FOR_INTELLIGENCE threshold is met, switches to actual booking heatmap data from Supabase

### No-Show Scoring Factors
- Baseline = 20 for every booking
- Lead time (under 2h = +30, under 6h = +20, under 24h = +10, over 7d = +8)
- Day/time (Friday after 2pm = +15, Monday before 10am = +5, before 8am = +10, after 4pm = +8)
- Repeat booker = −15 (lowers risk)
- No topic filled = +12, No notes = +5
- Risk tiers: low (< 30), medium (30–49), high (≥ 65)
- See detailed weight table in Code Deep Dive section below

---

## Development Rules

### Git Workflow
- **Branch from `main`** for all features: `git checkout -b feat/feature-name`
- **Test via Netlify deploy preview** on the PR
- **Merge to `main`** = production deploy
- **Do NOT run git from the Cowork VM** — only provide commands for Alberto to run on his Mac
- **Commands one per line** — Alberto runs them sequentially
- **Correct order every time:**
  1. `git checkout -b feat/branch-name`
  2. `git add <files>`
  3. `git commit -m "message"`
  4. `git push -u origin feat/branch-name`
  5. `gh pr create --title "..." --body "..." --base main`

### Database Migrations
- Provide migration SQL as copy-paste for Alberto to run in Supabase SQL Editor
- Never run migrations from the VM
- Schema file: `supabase/schema.sql` (initial setup)
- Incremental migrations: `supabase/migrations/`

### Code Style
- TypeScript strict mode
- Tailwind CSS v4 utility classes
- Server components by default, `"use client"` only when needed
- API routes use standardized error helpers from `api-errors.ts`
- All dates stored as ISO 8601 / TIMESTAMPTZ in Supabase
- Timezone handling via date-fns-tz

### Testing
- **Always test via live Netlify URL** — localhost/file URLs don't work in Cowork VM
- **Live URL:** https://sparkling-tarsier-bc26ef.netlify.app/
- **Admin panel:** /admin (username: `albertos`)
- Run `npx tsc --noEmit` after code changes to catch type errors

---

## Key Paths

| What | Path |
|---|---|
| Local repo (Alberto's Mac) | `~/Documents/Claude Cowork/slotly-fast-scheduling/slotly/` |
| Docs folder | `~/Documents/Claude Cowork/slotly-fast-scheduling/docs/` |
| Supabase project | `https://zppkhvtdkhgviqeyhqgu.supabase.co` (same instance as Accrue) |
| Service account | `slotly-calendar@slotly-fast-scheduling.iam.gserviceaccount.com` |
| GitHub repo | `https://github.com/jsimon9633/slotly` |
| Live site | `https://sparkling-tarsier-bc26ef.netlify.app/` |

---

## Code Deep Dive — Key Library Modules

### `src/lib/availability.ts` — Slot Generation Engine

**Core functions:**

- `getNextTeamMember(teamId?)` — Returns the single next member in round-robin order. Queries `team_members` ordered by `last_booked_at ASC` (longest-idle first). When `teamId` is provided, joins through `team_memberships` to scope the pool and filters by `in_round_robin = true`. Returns `null` if no active members exist. Also returns `google_oauth_refresh_token`.

- `getAllTeamMembers(teamId?)` — Same scoping logic but returns all active members with `in_round_robin = true` (used by `getCombinedAvailability` to check every member's calendar in parallel). Also returns `google_oauth_refresh_token`.

- `getAvailableSlots(memberId, calendarId, dateStr, duration, timezone, constraints, oauthRefreshToken?)` — The main slot generator for a single member on a single date. Passes OAuth token to `getFreeBusy()` when available. Algorithm:
  1. Looks up the member's `availability_rules` for the day-of-week
  2. Uses the **noon-UTC trick** (`dateStr + "T12:00:00Z"`) to safely determine day-of-week without timezone boundary bugs
  3. Parses `start_time`/`end_time` from the rule (e.g., "09:00"/"17:00") and converts from local timezone to UTC via `fromZonedTime`
  4. Applies `minNoticeHours` — calculates `earliestAllowed` and takes the later of that vs. work start
  5. Rounds up to the next **15-minute slot boundary** (`Math.ceil(mins / 15) * 15`)
  6. Calls `getFreeBusy()` for the Google Calendar busy periods within the work window
  7. Iterates in 15-min steps, checking each slot against busy periods. Buffer zones extend the "blocked" window before and after each slot (`beforeBufferMins`, `afterBufferMins`). Overlap check: `bufferedStart < busyEnd && bufferedEnd > busyStart`
  8. Returns all non-conflicting slots as `{ start, end }` ISO pairs

- `getCombinedAvailability(dateStr, duration, timezone, constraints, teamId?)` — Union merge for round-robin. Calls `getAvailableSlots` for **every** active team member in parallel (`Promise.all`), passing each member's OAuth refresh token when available. Merges into a `Map<slotStart, memberIds[]>`. A slot appears if **at least one** member is free. Each slot includes `available_member_ids` so the booking API knows which members can accept that time.

**Gotcha:** Slots are keyed by start time string, so all members must produce the same 15-min boundary times. The 15-min step size is hardcoded (`slotBoundary = 15`).

### `src/lib/google-calendar.ts` — 4-Tier Calendar Fallback

**Auth pattern:** All calendar functions accept an optional `oauthRefreshToken` parameter. When provided, the function first tries per-user OAuth authentication. Falls back to service account tiers.

**4-Tier fallback** (used identically for create, update, delete, and free/busy):

| Tier | Strategy | When it works |
|------|----------|--------------|
| 0 | **Per-user OAuth** — `getOAuthCalendarClient(accessToken)` from `google-oauth.ts`, operates on `"primary"` | Member has connected via Google OAuth and token is valid |
| 1 | **Impersonation** — `getCalendarClient(calendarId)`, insert to `"primary"` | Google Workspace org with domain-wide delegation enabled for the service account |
| 2 | **Shared calendar** — `getCalendarClient()`, insert to `calendarId` directly | Team member shared their calendar with the service account (editor role) |
| 3 | **Service account own calendar** — `getCalendarClient()`, insert to `"primary"`, add both team member and invitee as attendees | Always works (service account's own calendar), but event lives on the SA calendar not the team member's |

Each tier tries silently and catches errors to fall through. `tryGetOAuthClient()` handles token refresh before attempting OAuth tier. If refresh fails, token is marked as revoked and falls through to service account tiers.

**Google Meet auto-creation:** Every `createCalendarEvent` and `updateCalendarEvent` call includes `conferenceData.createRequest` with `type: "hangoutsMeet"` and `conferenceDataVersion: 1`. The response is parsed by `extractMeetDetails()` which pulls `meetLink`, `meetPhone`, and `meetPin` from the conference entry points.

**Gotcha:** `calendarId` in this codebase means the team member's email address (used as both the calendar identifier and the impersonation subject). This is a Google Calendar convention — a user's primary calendar ID equals their email.

### `src/lib/google-oauth.ts` — OAuth Token Management

**Token encryption:** AES-256-GCM using `TOKEN_ENCRYPTION_KEY` (32-byte hex). Format: `{iv}:{authTag}:{ciphertext}` (all hex-encoded). Used for `google_oauth_refresh_token` column.

**Key functions:**
- `getRedirectUri(requestUrl?)` — Computes OAuth callback URL. Priority: `GOOGLE_OAUTH_REDIRECT_URI` env var → `NEXT_PUBLIC_SITE_URL` + path → derive from `request.url` origin. Strips trailing slashes to avoid double-slash bugs.
- `getGoogleOAuthUrl(state, redirectUri)` — Builds Google consent URL. Scopes: `calendar`, `userinfo.email`, `userinfo.profile`, `openid`. Always requests `access_type=offline` + `prompt=consent` to ensure refresh token. Includes `hd` parameter (from `GOOGLE_OAUTH_HD` env var) to restrict account picker to Workspace domain.
- `exchangeCodeForTokens(code, redirectUri)` — Exchanges auth code for access + refresh tokens. The `redirectUri` must match what was used in the consent URL.
- `refreshAccessToken(encryptedRefreshToken)` — Decrypts token, refreshes with Google. Returns `null` if token is revoked/expired (detected via `invalid_grant`).
- `getValidAccessToken(encryptedRefreshToken, memberId)` — Refreshes token; marks member as revoked in DB if refresh fails.
- `createOAuthState(payload)` / `verifyOAuthState(state)` — HMAC-SHA256 signed state tokens with 10-minute expiry (CSRF protection).
- `createReauthToken(memberId)` / `validateReauthToken(token)` — 7-day expiring re-auth tokens stored in `reauth_tokens` table.

**OAuth flow paths:**
1. **Join (new member):** Invite link → `/api/auth/google?invite={token}` → Google → `/api/auth/google/callback` → creates team member (inactive) + join request → redirects to `/join?success=true`
2. **Re-auth (existing member):** Re-auth link → `/api/auth/google?reauth={token}` → Google → callback → updates tokens → redirects to `/join?reauth=success`

### `src/lib/smart-scheduling.ts` — Intelligence Badges

**Two-phase system:**

- **Phase 1 (defaults):** `DEFAULT_RECOMMENDED_HOURS = [10, 11, 13, 14]` (10am-2pm, skip noon), `DEFAULT_POPULAR_DAYS = [2, 3, 4]` (Tue-Thu). Scoring: popular day + popular hour = 75 ("popular"), just popular hour = 50 ("recommended"), just popular day = 30 (no badge).

- **Phase 2 (data-driven):** Kicks in when `getBookingHeatmap()` returns non-null (requires `MIN_BOOKINGS_FOR_INTELLIGENCE = 30` bookings in the last 90 days). Aggregates `start_time` into `hourCounts[hour]` and `dayHourCounts["day-hour"]`. Score = 60% overall hour popularity + 40% day-specific popularity. Badges: ≥70 → "popular", ≥45 → "recommended".

**Gotcha:** Heatmap uses `getUTCHours()` and `getUTCDay()`, meaning the hour buckets are UTC-based. The `getSmartSchedulingData()` function takes a `timezone` param but doesn't actually convert the heatmap data to local time — the labels are computed from UTC. This could misalign badges in timezones far from UTC.

### `src/lib/no-show-score.ts` — Risk Scoring Model

**Weighted heuristic (hand-tuned weights, not ML):**

| Factor | Condition | Points |
|--------|-----------|--------|
| Lead time | < 2 hours | +30 |
| Lead time | < 6 hours | +20 |
| Lead time | < 24 hours | +10 |
| Lead time | > 7 days | +8 |
| Day/time | Friday after 2pm | +15 |
| Day/time | Monday before 10am | +5 |
| Time of day | Before 8am | +10 |
| Time of day | After 4pm | +8 |
| Engagement | No topic filled | +12 |
| Engagement | No notes | +5 |
| Engagement | Repeat booker | **−15** |

Baseline = 20. Clamped to 0–100. Risk tiers: low (< 30), medium (30–49), high (≥ 65).

**Where it's used:** The booking API calculates the score at booking time and stores it on the `bookings` row (`no_show_score`, `risk_tier`). High-risk bookings get a 2-hour pre-meeting reminder email via the cron endpoint.

**Future:** Comments note these weights should be replaced with logistic regression once 200+ bookings have outcome data (`outcome` column).

### `src/lib/email.ts` — Transactional Email System

**5 email types** all built with a shared `emailWrapper()` that produces table-based HTML (email client compatible):

1. **Booking confirmation** → invitee (subject: "Confirmed: {title} on {date}")
2. **New booking alert** → team member (subject: "New booking: {title} with {name}")
3. **Cancellation** → both parties (separate templates for invitee vs team perspective)
4. **Reschedule** → both parties (shows old time with strikethrough + new time)
5. **Reminder** → invitee only (2hr before, high-risk bookings)

All emails include Reschedule + Cancel buttons via `manageButtonsHtml()` (except reminders for invitees only). Meet link with dial-in details shown when available.

**Pattern:** `build*Email()` returns `{ subject, html }`, then `send*Emails()` fires both parties' emails in parallel via `Promise.allSettled`. Individual `sendEmail()` calls go through SendGrid, with graceful fallback if `SENDGRID_API_KEY` is unset.

### `src/lib/webhooks.ts` — HMAC-Signed Delivery

**Events:** `booking.created`, `booking.cancelled`, `booking.rescheduled`

**Delivery flow:**
1. `fireWebhooks(event, data)` → fetches all active webhooks, filters to those subscribed to the event
2. `deliverWebhook()` → up to 3 attempts with exponential backoff (1s, 4s, 9s between retries)
3. Signs payload with `HMAC-SHA256` using the webhook's secret → sent as `X-Slotly-Signature` header
4. 10-second timeout per attempt via `AbortController`
5. **Smart retry:** 4xx errors (except 429) are NOT retried (client error = won't help). 5xx and network errors are retried.
6. Every attempt is logged to `webhook_logs` (status code, response body capped at 2000 chars, success boolean)

### `src/lib/workflows.ts` — Workflow Automation Engine

**Template variables:** `{{name}}`, `{{email}}`, `{{phone}}`, `{{event_title}}`, `{{start_time}}`, `{{date}}`, `{{time}}`, `{{meet_link}}`, `{{manage_link}}`, `{{host_name}}`, `{{host_email}}` — all rendered by `renderTemplate()` which does regex `replace` for each variable.

**Two execution paths:**

1. **Instant workflows** (`executeInstantWorkflows`) — called from booking/cancel/reschedule API handlers. Queries workflows matching `event_type_id + trigger + is_active=true`, executes all in parallel via `Promise.allSettled`.

2. **Timed workflows** (`executeTimedWorkflows`) — called from cron handler every 15 minutes. For `before_meeting`: looks for bookings starting in `trigger_minutes ± 7.5min` from now. For `after_meeting`: looks for bookings that ended `trigger_minutes ± 7.5min` ago. The ±7.5min window accounts for the 15-minute cron interval.

**SMS support:** Checks `site_settings` for `sms_enabled=true`, then fetches Twilio credentials from `site_settings`. Sends via Twilio REST API with Basic auth. Currently only sends to invitee phone (host SMS would need phone column on `team_members`).

**Known limitation:** No deduplication table for timed workflows — a `workflow_executions` join table is mentioned in comments but not yet implemented. Currently relies on the timing window to avoid duplicates, which could fire twice if cron runs more frequently than 15 minutes.

---

## Google Cloud Console Setup (for OAuth)

The OAuth integration requires these Google Cloud Console settings:

1. **OAuth 2.0 Client ID** — Web application type, from APIs & Services → Credentials
2. **Authorized redirect URI:** `https://sparkling-tarsier-bc26ef.netlify.app/api/auth/google/callback` (also add deploy preview URLs for testing)
3. **OAuth consent screen:** Internal (Workspace-only) — no Google app verification needed
4. **Required APIs:** Google Calendar API, Google People API (for userinfo)
5. **Scopes:** `calendar`, `userinfo.email`, `userinfo.profile`, `openid`

**Common OAuth errors:**
- `Error 400: invalid_request` with relative `redirect_uri` → `NEXT_PUBLIC_SITE_URL` is empty. Code now auto-derives from request URL, but env var should be set.
- `Access blocked: Authorization Error` → consent screen may be in "Testing" mode with limited test users, or redirect URI not registered.
- `Error 400: redirect_uri_mismatch` → the callback URL registered in Google Cloud Console doesn't match what the app sends. **Fix:** set `GOOGLE_OAUTH_REDIRECT_URI` env var to the exact registered callback URL.
- `Access blocked: This app's request is invalid` (with personal Gmail) → if OAuth consent screen is "Internal", only Workspace users can authorize. Set `GOOGLE_OAUTH_HD` env var to restrict account picker to the correct domain. Code now shows helpful error message + retry button instead of leaving user on Google's dead-end error page.

---

## Reference Docs (in `docs/` folder)

- **Slotly Build Timeline v5.0.docx** — full development history across all build sessions
- **Slotly Release Notes v1.5.docx** — release notes for shipped features
- **Calendly vs Slotly - UX Audit.docx** — feature comparison and implementation roadmap
- **Slotly Enrichment Services to Explore.docx** — AI Meeting Prep enrichment pipeline research
- **slotly-onboarding-flow.mermaid** — team member onboarding flow diagram
