# Slotly — Fast AI Scheduling

A lightweight, open-source scheduling tool with round-robin team booking. Built with Next.js, Supabase, and Google Calendar.

## Quick Setup (30 minutes)

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick any region close to you)
3. Once created, go to **SQL Editor** and paste the contents of `supabase/schema.sql` — click Run
4. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Google Calendar (Service Account)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g., "Slotly")
3. Enable the **Google Calendar API** (search for it in the API Library)
4. Go to **IAM & Admin → Service Accounts** → Create Service Account
5. Give it a name like "slotly-calendar" and click Create
6. Skip the optional permissions steps
7. Click on the service account → **Keys** tab → Add Key → Create new key → JSON
8. Download the JSON file — you need two values from it:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`

**Important:** Each team member must share their Google Calendar with the service account email:
- Open Google Calendar → Settings → your calendar → "Share with specific people"
- Add the service account email (e.g., `slotly-calendar@your-project.iam.gserviceaccount.com`)
- Set permission to **"Make changes to events"**

### 3. Add Team Members

In the Supabase **Table Editor**, add rows to the `team_members` table:

| name | email | google_calendar_id |
|------|-------|-------------------|
| Alberto | alberto@example.com | alberto@example.com |
| Coworker | coworker@example.com | coworker@example.com |

Then add availability rules for each member in the `availability_rules` table:

| team_member_id | day_of_week | start_time | end_time | is_available |
|----------------|-------------|------------|----------|-------------|
| (Alberto's UUID) | 1 | 09:00 | 17:00 | true |
| (Alberto's UUID) | 2 | 09:00 | 17:00 | true |
| ... | ... | ... | ... | ... |

(day_of_week: 0=Sunday, 1=Monday, ... 6=Saturday)

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### 5. Run Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you should see the event type picker.

### 6. Deploy to Netlify

1. Push to GitHub: `git init && git add . && git commit -m "init" && git push`
2. In Netlify, click "Add new site" → "Import from Git" → select your repo
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Add your environment variables in **Site settings → Environment variables**
6. Deploy!

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing: event type picker
│   ├── book/[slug]/page.tsx  # Booking flow: date → time → form → confirmed
│   └── api/
│       ├── event-types/      # GET: list active event types
│       ├── availability/     # GET: available slots for a date
│       └── book/             # POST: create booking (round-robin)
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── google-calendar.ts    # Google Calendar API
│   ├── availability.ts       # Slot generation + round-robin logic
│   └── types.ts              # TypeScript types
└── supabase/
    └── schema.sql            # Database schema + seed data
```

## How Round-Robin Works

When someone books a meeting:
1. Query `team_members` sorted by `last_booked_at ASC` — the member who hasn't been booked in the longest time goes next
2. Check that member's availability (rules + Google Calendar free/busy)
3. Create the event on their calendar
4. Update their `last_booked_at` to now

For the availability page, we show **combined availability** — if ANY team member has a slot open, it appears as bookable.

## Tech Stack

- **Next.js 16** — React framework with API routes
- **Supabase** — PostgreSQL database (free tier)
- **Google Calendar API** — Real-time free/busy + event creation
- **Tailwind CSS v4** — Styling
- **Netlify** — Hosting with serverless functions
- **date-fns** — Date manipulation
