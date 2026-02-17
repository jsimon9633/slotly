import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCombinedAvailability } from "@/lib/availability";

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

  // Look up event type to get duration
  const { data: eventType, error: etError } = await supabaseAdmin
    .from("event_types")
    .select("*")
    .eq("slug", eventTypeSlug)
    .single();

  if (etError || !eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  try {
    const slots = await getCombinedAvailability(
      date,
      eventType.duration_minutes,
      timezone
    );

    return NextResponse.json({
      date,
      timezone,
      event_type: eventType,
      slots,
    });
  } catch (err) {
    console.error("Availability error:", err);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
