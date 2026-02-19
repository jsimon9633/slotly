/**
 * Smart Scheduling — surface "recommended" times based on booking history.
 *
 * Phase 1 (now): Industry best practices as defaults.
 * Phase 2 (once data accumulates): SQL aggregation of actual booking patterns.
 *
 * Returns a list of recommended hour ranges for a given day of week,
 * which the frontend can use to show a "Popular" badge on time slots.
 */

import { supabaseAdmin } from "@/lib/supabase";

export interface SmartTimeSlot {
  hour: number; // 0-23 UTC
  score: number; // 0-100, higher = more recommended
  label: "popular" | "recommended" | null;
}

// ── Industry defaults (Tue–Thu, 10am–2pm are peak booking/conversion) ──

const DEFAULT_RECOMMENDED_HOURS = new Set([10, 11, 13, 14]); // 10am-2pm (skip noon)
const DEFAULT_POPULAR_DAYS = new Set([2, 3, 4]); // Tue, Wed, Thu

/**
 * Get recommended time labels for a given date.
 *
 * If we have enough booking history (MIN_BOOKINGS_FOR_INTELLIGENCE),
 * we use actual data. Otherwise, fall back to industry defaults.
 */
export async function getSmartSchedulingData(
  date: string, // YYYY-MM-DD
  timezone: string,
  teamId?: string
): Promise<Map<number, SmartTimeSlot>> {
  const targetDay = new Date(date + "T12:00:00Z").getDay(); // 0=Sun
  const result = new Map<number, SmartTimeSlot>();

  // Try to pull real data (scoped to team if provided)
  const realData = await getBookingHeatmap(teamId);

  if (realData) {
    // We have enough data — use it
    const { hourCounts, dayHourCounts, totalBookings } = realData;

    // Find the top hours overall
    const maxHourCount = Math.max(...Object.values(hourCounts), 1);

    for (let h = 0; h < 24; h++) {
      const hourCount = hourCounts[h] || 0;
      const dayHourCount = dayHourCounts[`${targetDay}-${h}`] || 0;

      // Score: weighted combo of overall popularity + day-specific popularity
      const overallScore = (hourCount / maxHourCount) * 60;
      const dayScore = totalBookings > 0 ? (dayHourCount / (totalBookings / 7)) * 40 : 0;
      const score = Math.round(overallScore + dayScore);

      let label: SmartTimeSlot["label"] = null;
      if (score >= 70) label = "popular";
      else if (score >= 45) label = "recommended";

      result.set(h, { hour: h, score, label });
    }
  } else {
    // Not enough data — use industry defaults
    const isDayPopular = DEFAULT_POPULAR_DAYS.has(targetDay);

    for (let h = 0; h < 24; h++) {
      const isHourGood = DEFAULT_RECOMMENDED_HOURS.has(h);
      let score = 0;
      let label: SmartTimeSlot["label"] = null;

      if (isDayPopular && isHourGood) {
        score = 75;
        label = "popular";
      } else if (isHourGood) {
        score = 50;
        label = "recommended";
      } else if (isDayPopular) {
        score = 30;
      }

      result.set(h, { hour: h, score, label });
    }
  }

  return result;
}

// ── Data aggregation (used when we have enough history) ──

const MIN_BOOKINGS_FOR_INTELLIGENCE = 30;

interface BookingHeatmap {
  hourCounts: Record<number, number>; // hour -> total bookings at that hour
  dayHourCounts: Record<string, number>; // "dayOfWeek-hour" -> count
  totalBookings: number;
}

async function getBookingHeatmap(teamId?: string): Promise<BookingHeatmap | null> {
  try {
    // Pull last 90 days of completed/confirmed bookings
    const since = new Date();
    since.setDate(since.getDate() - 90);

    let query = supabaseAdmin
      .from("bookings")
      .select("start_time, status, event_type_id")
      .in("status", ["confirmed", "completed"])
      .gte("created_at", since.toISOString());

    // Scope to team's event types if teamId provided
    if (teamId) {
      const { data: teamEventTypes } = await supabaseAdmin
        .from("event_types")
        .select("id")
        .eq("team_id", teamId);

      if (teamEventTypes && teamEventTypes.length > 0) {
        query = query.in("event_type_id", teamEventTypes.map((et) => et.id));
      }
    }

    const { data: bookings, error } = await query;

    if (error || !bookings || bookings.length < MIN_BOOKINGS_FOR_INTELLIGENCE) {
      return null;
    }

    const hourCounts: Record<number, number> = {};
    const dayHourCounts: Record<string, number> = {};

    for (const b of bookings) {
      const dt = new Date(b.start_time);
      const hour = dt.getUTCHours();
      const day = dt.getUTCDay();

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      const key = `${day}-${hour}`;
      dayHourCounts[key] = (dayHourCounts[key] || 0) + 1;
    }

    return { hourCounts, dayHourCounts, totalBookings: bookings.length };
  } catch (err) {
    console.error("[SmartScheduling] Heatmap query failed:", err);
    return null;
  }
}

/**
 * Get the best time recommendations as a simple summary for the admin dashboard.
 */
export async function getSmartSchedulingSummary(teamId?: string): Promise<{
  bestDays: string[];
  bestHours: string[];
  dataSource: "real" | "defaults";
  bookingCount: number;
}> {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const heatmap = await getBookingHeatmap(teamId);

  if (!heatmap) {
    return {
      bestDays: ["Tue", "Wed", "Thu"],
      bestHours: ["10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM"],
      dataSource: "defaults",
      bookingCount: 0,
    };
  }

  // Best days: top 3 by total bookings
  const dayCounts: Record<number, number> = {};
  for (const [key, count] of Object.entries(heatmap.dayHourCounts)) {
    const day = parseInt(key.split("-")[0]);
    dayCounts[day] = (dayCounts[day] || 0) + count;
  }
  const bestDayNums = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => parseInt(d));

  // Best hours: top 4 by total bookings
  const bestHourNums = Object.entries(heatmap.hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([h]) => parseInt(h));

  return {
    bestDays: bestDayNums.map((d) => dayNames[d]),
    bestHours: bestHourNums.map((h) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:00 ${ampm}`;
    }),
    dataSource: "real",
    bookingCount: heatmap.totalBookings,
  };
}
