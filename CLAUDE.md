# Slotly — Project Knowledge Base

> **Last updated:** 2026-02-26
> **Owner:** Alberto (asimon@masterworks.com)
> **Repo:** https://github.com/jsimon9633/slotly
> **Live URL:** https://sparkling-tarsier-bc26ef.netlify.app/
> **Deploy:** Netlify (auto-deploys on push to `main`, deploy previews on PRs)

---

## Stack

- **Framework:** Next.js 16, App Router, TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Calendar:** Google Calendar API via service account
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
│   ├── join/page.tsx                     # Team member join page (invite link)
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
│       ├── book/route.ts                 # Public: POST create booking
│       ├── team/route.ts                 # Public: GET team info
│       ├── teams/route.ts                # Public: GET all teams
│       ├── settings/route.ts             # Public: GET site branding settings
│       ├── join/route.ts                 # Public: POST join team request
│       ├── invite/validate/route.ts      # Public: GET validate invite link
│       │
│       ├── manage/[token]/
│       │   ├── route.ts                  # GET booking by manage token
│       │   ├── cancel/route.ts           # POST cancel booking
│       │   └── reschedule/route.ts       # POST reschedule booking
│       │
│       ├── cron/reminders/route.ts       # Cron: send booking reminders
│       │
│       └── admin/
│           ├── event-types/route.ts      # CRUD event types (GET, POST, PATCH, DELETE)
│           ├── team-members/route.ts     # CRUD team members
│           ├── teams/route.ts            # CRUD teams
│           ├── teams/[teamId]/members/route.ts  # Manage team memberships
│           ├── team-event-links/route.ts # Link event types to teams
│           ├── analytics/route.ts        # GET analytics data
│           ├── bookings/outcome/route.ts # PATCH: mark booking outcome (completed/no-show)
│           ├── webhooks/route.ts         # CRUD webhooks
│           ├── workflows/route.ts        # CRUD workflow automations
│           ├── invite/route.ts           # POST: generate invite links
│           ├── join-requests/route.ts    # GET/PATCH: manage join requests
│           └── sms-settings/route.ts     # GET/PATCH: SMS notification settings
│
├── lib/
│   ├── supabase.ts                       # Supabase client (admin + public)
│   ├── google-calendar.ts                # Google Calendar API wrapper
│   ├── availability.ts                   # Slot generation + round-robin logic
│   ├── smart-scheduling.ts               # "Popular" / "Recommended" slot badges
│   ├── no-show-score.ts                  # No-show risk scoring (0-100)
│   ├── email.ts                          # SendGrid email templates
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
        └── 005_team_event_types_join.sql # Team-event type join table migration
```

---

## Database Tables (Supabase)

| Table | Purpose |
|---|---|
| `team_members` | People who can be booked (name, email, Google Calendar ID, last_booked_at for round-robin) |
| `event_types` | Bookable events (title, slug, description, duration, color, buffers, limits, booking_questions) |
| `bookings` | All bookings (invitee info, start/end time, status, manage_token, no_show_score, risk_tier, outcome, custom_answers, reminder_sent_at) |
| `availability_rules` | Per-member working hours by day of week |
| `teams` | Team groupings (name, slug, description) |
| `team_memberships` | Many-to-many: members ↔ teams with roles (admin/member) |
| `team_event_links` | Many-to-many: event types ↔ teams |
| `webhooks` | Webhook endpoints (URL, secret, subscribed events) |
| `webhook_logs` | Delivery logs (status code, response, success) |
| `site_settings` | Branding config (company name, logo URL, primary/accent colors) |
| `workflows` | Workflow automations (trigger, action, recipient, template) |
| `join_requests` | Team member join requests (pending/approved/rejected) |
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
- **Round-robin assignment** — books the team member who hasn't been booked in the longest time
- **Real-time availability** — checks Google Calendar free/busy + availability rules + buffer times
- **Timezone support** — auto-detects user timezone, searchable timezone picker
- **Booking confirmation emails** — HTML emails via SendGrid with meeting details + manage link

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
- **Team management** — create teams, add/remove members, set roles (admin/member)
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

---

## Features — What's Not Built Yet

### High Priority (UX Audit Findings)
- **Organizer avatar/info** — show team member photo and name on booking page (needs `avatar_url` column on teams or member profiles)
- **Two-panel desktop layout** — left panel for event details, right panel for date/time selection (CSS-only at md: breakpoint)

### Medium Priority
- **Full month calendar option** — alternative to horizontal date strip for desktop users (consider making it a toggle)
- **AI Meeting Prep** — enrichment pipeline: booking history → Google search (name+email) → phone fallback → email handle clues → domain scrape (opportunistic) → Claude API synthesis. See `docs/Slotly Enrichment Services to Explore.docx`
- **Google Meet auto-creation** — create Google Meet link during booking and include in confirmation email
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
2. Check that member's Google Calendar free/busy + availability rules + buffer times
3. If available: create Google Calendar event, create booking, update `last_booked_at`
4. If not: try next member in the round-robin order

### Booking Flow Data Pipeline
```
Public booking page (SSR) → fetches eventType (including description) from Supabase
BookingClient (CSR) → fetches availability slots via /api/availability
  → user picks date → fetches time slots
  → user picks time → shows form
  → user submits → POST /api/book
    → validates inputs + rate limits
    → calculates no-show risk score
    → round-robin assigns team member
    → creates Google Calendar event
    → creates Supabase booking row
    → sends confirmation email (SendGrid)
    → fires webhooks (best-effort, non-blocking)
    → triggers workflow automations
    → returns confirmation with start_time, end_time, team_member_name, event_type
```

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

- `getNextTeamMember(teamId?)` — Returns the single next member in round-robin order. Queries `team_members` ordered by `last_booked_at ASC` (longest-idle first). When `teamId` is provided, joins through `team_memberships` to scope the pool. Returns `null` if no active members exist.

- `getAllTeamMembers(teamId?)` — Same scoping logic but returns all active members (used by `getCombinedAvailability` to check every member's calendar in parallel).

- `getAvailableSlots(memberId, calendarId, dateStr, duration, timezone, constraints)` — The main slot generator for a single member on a single date. Algorithm:
  1. Looks up the member's `availability_rules` for the day-of-week
  2. Uses the **noon-UTC trick** (`dateStr + "T12:00:00Z"`) to safely determine day-of-week without timezone boundary bugs
  3. Parses `start_time`/`end_time` from the rule (e.g., "09:00"/"17:00") and converts from local timezone to UTC via `fromZonedTime`
  4. Applies `minNoticeHours` — calculates `earliestAllowed` and takes the later of that vs. work start
  5. Rounds up to the next **15-minute slot boundary** (`Math.ceil(mins / 15) * 15`)
  6. Calls `getFreeBusy()` for the Google Calendar busy periods within the work window
  7. Iterates in 15-min steps, checking each slot against busy periods. Buffer zones extend the "blocked" window before and after each slot (`beforeBufferMins`, `afterBufferMins`). Overlap check: `bufferedStart < busyEnd && bufferedEnd > busyStart`
  8. Returns all non-conflicting slots as `{ start, end }` ISO pairs

- `getCombinedAvailability(dateStr, duration, timezone, constraints, teamId?)` — Union merge for round-robin. Calls `getAvailableSlots` for **every** active team member in parallel (`Promise.all`), then merges into a `Map<slotStart, memberIds[]>`. A slot appears if **at least one** member is free. Each slot includes `available_member_ids` so the booking API knows which members can accept that time.

**Gotcha:** Slots are keyed by start time string, so all members must produce the same 15-min boundary times. The 15-min step size is hardcoded (`slotBoundary = 15`).

### `src/lib/google-calendar.ts` — 3-Tier Calendar Fallback

**Auth pattern:** `getCalendarClient(impersonateEmail?)` creates a JWT-authenticated client. When `impersonateEmail` is passed, sets `subject` on the JWT for domain-wide delegation (Workspace only).

**3-Tier fallback** (used identically for create, update, and delete):

| Tier | Strategy | When it works |
|------|----------|--------------|
| 1 | **Impersonation** — `getCalendarClient(calendarId)`, insert to `"primary"` | Google Workspace org with domain-wide delegation enabled for the service account |
| 2 | **Shared calendar** — `getCalendarClient()`, insert to `calendarId` directly | Team member shared their calendar with the service account (editor role) |
| 3 | **Service account own calendar** — `getCalendarClient()`, insert to `"primary"`, add both team member and invitee as attendees | Always works (service account's own calendar), but event lives on the SA calendar not the team member's |

Each tier tries silently and catches errors to fall through. The 3rd tier is the guaranteed fallback.

**Google Meet auto-creation:** Every `createCalendarEvent` and `updateCalendarEvent` call includes `conferenceData.createRequest` with `type: "hangoutsMeet"` and `conferenceDataVersion: 1`. The response is parsed by `extractMeetDetails()` which pulls `meetLink`, `meetPhone`, and `meetPin` from the conference entry points.

**Gotcha:** `calendarId` in this codebase means the team member's email address (used as both the calendar identifier and the impersonation subject). This is a Google Calendar convention — a user's primary calendar ID equals their email.

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

## Reference Docs (in `docs/` folder)

- **Slotly Build Timeline v4.0.docx** — full development history across all build sessions
- **Slotly Release Notes v1.4.docx** — release notes for shipped features
- **Calendly vs Slotly - UX Audit.docx** — feature comparison and implementation roadmap
- **Slotly Enrichment Services to Explore.docx** — AI Meeting Prep enrichment pipeline research
- **slotly-onboarding-flow.mermaid** — team member onboarding flow diagram
