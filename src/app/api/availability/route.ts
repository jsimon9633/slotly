import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCombinedAvailability } from "@/lib/availability";

// Basic input validation
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_REGEX = /^[A-Za-z_/]+$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const eventTypeSlug = searchParams.get("eventType");
  const timezone = searchParams.get("timezone") || "America/New_York";

  if (!date || !eventTypeSlug) {
    return NextResponse.json(
      { error: "Missing required params: date, eventType" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!DATE_REGEX.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Validate timezone (basic check — no special characters)
  if (!TIMEZONE_REGEX.test(timezone)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  // Validate slug (alphanumeric + hyphens only)
  if (!/^[a-z0-9-]+$/.test(eventTypeSlug)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  // Look up event type — only fetch needed fields
  const { data: eventType, error: etError } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, duration_minutes, color, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings")
    .eq("slug", eventTypeSlug)
    .eq("is_active", true)
    .single();

  if (etError || !eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  try {
    const rawSlots = await getCombinedAvailability(
      date,
      eventType.duration_minutes,
      timezone,
      {
        beforeBufferMins: eventType.before_buffer_mins || 0,
        afterBufferMins: eventType.after_buffer_mins || 0,
        minNoticeHours: eventType.min_notice_hours || 0,
      }
    );

    // Strip internal member IDs — clients don't need to know which team member is available
    const slots = rawSlots.map(({ start, end }) => ({ start, end }));

    return NextResponse.json({
      date,
      timezone,
      slots,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
