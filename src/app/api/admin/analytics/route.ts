import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, serverError } from "@/lib/api-errors";
import { getSmartSchedulingSummary } from "@/lib/smart-scheduling";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  // Default: last 30 days
  const daysParam = url.searchParams.get("days");
  const days = Math.min(Math.max(parseInt(daysParam || "30") || 30, 7), 90);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  try {
    // 1. All bookings in period
    const { data: bookings, error: bookErr } = await supabaseAdmin
      .from("bookings")
      .select("id, event_type_id, team_member_id, start_time, status, created_at")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: true });

    if (bookErr) {
      return serverError("Failed to load analytics data.", bookErr, "Analytics bookings query");
    }

    const allBookings = bookings || [];

    // 2. Event types for labeling
    const { data: eventTypes, error: etError } = await supabaseAdmin
      .from("event_types")
      .select("id, title, color, slug");

    if (etError) {
      console.error("[Analytics] Event types query failed:", etError.message);
      // Non-fatal — continue with empty labels
    }

    // 3. Team members for labeling
    const { data: teamMembers, error: tmError } = await supabaseAdmin
      .from("team_members")
      .select("id, name");

    if (tmError) {
      console.error("[Analytics] Team members query failed:", tmError.message);
      // Non-fatal — continue with empty labels
    }

    // --- Compute analytics ---

    // Total counts
    const totalBookings = allBookings.length;
    const confirmed = allBookings.filter((b) => b.status === "confirmed").length;
    const cancelled = allBookings.filter((b) => b.status === "cancelled").length;
    const completed = allBookings.filter((b) => b.status === "completed").length;

    // Booking volume by day
    const volumeByDay: Record<string, number> = {};
    for (const b of allBookings) {
      const day = b.created_at.slice(0, 10); // YYYY-MM-DD
      volumeByDay[day] = (volumeByDay[day] || 0) + 1;
    }

    // Fill in missing days with 0
    const volumeTimeline: { date: string; count: number }[] = [];
    const cursor = new Date(since);
    const today = new Date();
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      volumeTimeline.push({ date: key, count: volumeByDay[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Bookings by event type
    const byEventType: Record<string, number> = {};
    for (const b of allBookings) {
      byEventType[b.event_type_id] = (byEventType[b.event_type_id] || 0) + 1;
    }
    const eventTypeBreakdown = Object.entries(byEventType)
      .map(([etId, count]) => {
        const et = (eventTypes || []).find((e: any) => e.id === etId);
        return {
          event_type_id: etId,
          title: et?.title || "Unknown",
          color: et?.color || "#6b7280",
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Team utilization
    const byTeamMember: Record<string, number> = {};
    for (const b of allBookings) {
      if (b.status !== "cancelled") {
        byTeamMember[b.team_member_id] = (byTeamMember[b.team_member_id] || 0) + 1;
      }
    }
    const teamUtilization = Object.entries(byTeamMember)
      .map(([tmId, count]) => {
        const tm = (teamMembers || []).find((m: any) => m.id === tmId);
        return {
          team_member_id: tmId,
          name: tm?.name || "Unknown",
          bookings: count,
        };
      })
      .sort((a, b) => b.bookings - a.bookings);

    // Peak days of week (0=Sun, 6=Sat)
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const b of allBookings) {
      const d = new Date(b.start_time).getDay();
      dayOfWeekCounts[d]++;
    }
    const peakDays = dayNames.map((name, i) => ({ day: name, count: dayOfWeekCounts[i] }));

    // Peak hours (0-23)
    const hourCounts = new Array(24).fill(0);
    for (const b of allBookings) {
      const h = new Date(b.start_time).getUTCHours();
      hourCounts[h]++;
    }
    const peakHours = hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      count,
    }));

    // Cancellation rate
    const cancellationRate = totalBookings > 0 ? Math.round((cancelled / totalBookings) * 100) : 0;

    // No-show stats
    const noShows = allBookings.filter((b) => b.status === "no_show").length;
    const noShowRate = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;

    // Smart scheduling summary
    const smartScheduling = await getSmartSchedulingSummary();

    return NextResponse.json({
      period_days: days,
      summary: {
        total_bookings: totalBookings,
        confirmed,
        cancelled,
        completed,
        no_shows: noShows,
        cancellation_rate: cancellationRate,
        no_show_rate: noShowRate,
      },
      volume_timeline: volumeTimeline,
      event_type_breakdown: eventTypeBreakdown,
      team_utilization: teamUtilization,
      peak_days: peakDays,
      peak_hours: peakHours,
      smart_scheduling: smartScheduling,
    });
  } catch (err: unknown) {
    return serverError("Analytics query failed. Please try again.", err, "Analytics GET");
  }
}
