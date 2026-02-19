import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serverError } from "@/lib/api-errors";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, description, duration_minutes, color, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings")
    .eq("is_active", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    return serverError("Unable to load event types. Please try again.", error, "Event types GET");
  }

  return NextResponse.json(data);
}
