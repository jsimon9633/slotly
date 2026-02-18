import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, description, duration_minutes, color, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings")
    .eq("is_active", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load event types" }, { status: 500 });
  }

  return NextResponse.json(data);
}
