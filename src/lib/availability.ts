import { addMinutes, parseISO, isBefore, isAfter, setHours, setMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { getFreeBusy } from "./google-calendar";
import { supabaseAdmin } from "./supabase";

interface TimeSlot {
  start: string; // ISO string
  end: string;   // ISO string
}

interface AvailabilityRule {
  day_of_week: number;
  start_time: string; // "09:00"
  end_time: string;   // "17:00"
  is_available: boolean;
}

/**
 * Get the next team member in round-robin order
 */
export async function getNextTeamMember(): Promise<{
  id: string;
  name: string;
  email: string;
  google_calendar_id: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("*")
    .eq("is_active", true)
    .order("last_booked_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get all active team members (for showing combined availability)
 */
export async function getAllTeamMembers() {
  const { data } = await supabaseAdmin
    .from("team_members")
    .select("*")
    .eq("is_active", true)
    .order("last_booked_at", { ascending: true });

  return data || [];
}

/**
 * Get availability rules for a team member
 */
async function getAvailabilityRules(teamMemberId: string): Promise<AvailabilityRule[]> {
  const { data } = await supabaseAdmin
    .from("availability_rules")
    .select("*")
    .eq("team_member_id", teamMemberId)
    .eq("is_available", true);

  return data || [];
}

/**
 * Generate available time slots for a date range
 * Checks availability rules AND Google Calendar free/busy
 */
export async function getAvailableSlots(
  teamMemberId: string,
  calendarId: string,
  dateStr: string, // YYYY-MM-DD
  durationMinutes: number,
  timezone: string
): Promise<TimeSlot[]> {
  // Get the day's availability rules
  const rules = await getAvailabilityRules(teamMemberId);

  // Use noon UTC to safely determine day-of-week (avoids timezone boundary issues)
  const dateAtNoon = new Date(dateStr + "T12:00:00Z");
  const dayOfWeek = dateAtNoon.getUTCDay(); // 0=Sun
  const rule = rules.find((r) => r.day_of_week === dayOfWeek);

  // No rule or not available = no slots
  if (!rule) return [];

  // Parse working hours
  const [startH, startM] = rule.start_time.split(":").map(Number);
  const [endH, endM] = rule.end_time.split(":").map(Number);

  // Build working window: construct local times directly from the date string,
  // then convert from the user's timezone to UTC
  const workStartLocal = new Date(`${dateStr}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00`);
  const workEndLocal = new Date(`${dateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`);
  const workStart = fromZonedTime(workStartLocal, timezone);
  const workEnd = fromZonedTime(workEndLocal, timezone);

  // Don't show past slots
  const now = new Date();
  const effectiveStart = isAfter(now, workStart) ? now : workStart;

  // Round up to next slot boundary (e.g., next 15-min mark)
  const slotBoundary = 15; // minutes
  const mins = effectiveStart.getMinutes();
  const roundedMins = Math.ceil(mins / slotBoundary) * slotBoundary;
  const roundedStart = setMinutes(setHours(new Date(effectiveStart), effectiveStart.getHours()), roundedMins);
  const adjustedStart = isAfter(roundedStart, effectiveStart) ? roundedStart : addMinutes(effectiveStart, slotBoundary - (mins % slotBoundary));

  // Get busy times from Google Calendar
  const busySlots = await getFreeBusy(
    calendarId,
    workStart.toISOString(),
    workEnd.toISOString()
  );

  // Generate all possible slots
  const slots: TimeSlot[] = [];
  let cursor = adjustedStart;

  while (isBefore(addMinutes(cursor, durationMinutes), workEnd) ||
         addMinutes(cursor, durationMinutes).getTime() === workEnd.getTime()) {
    const slotEnd = addMinutes(cursor, durationMinutes);

    // Check if slot overlaps with any busy period
    const isConflict = busySlots.some((busy) => {
      const busyStart = parseISO(busy.start);
      const busyEnd = parseISO(busy.end);
      return isBefore(cursor, busyEnd) && isAfter(slotEnd, busyStart);
    });

    if (!isConflict && isAfter(cursor, now)) {
      slots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
      });
    }

    cursor = addMinutes(cursor, slotBoundary);
  }

  return slots;
}

/**
 * Get combined availability across ALL team members (for round-robin)
 * Returns slots where at least one team member is free
 */
export async function getCombinedAvailability(
  dateStr: string,
  durationMinutes: number,
  timezone: string
): Promise<(TimeSlot & { available_member_ids: string[] })[]> {
  const members = await getAllTeamMembers();
  if (members.length === 0) return [];

  // Get slots for each member
  const memberSlots = await Promise.all(
    members.map(async (member) => {
      const slots = await getAvailableSlots(
        member.id,
        member.google_calendar_id,
        dateStr,
        durationMinutes,
        timezone
      );
      return { memberId: member.id, slots };
    })
  );

  // Merge: find unique time slots and track which members are available
  const slotMap = new Map<string, string[]>();

  for (const { memberId, slots } of memberSlots) {
    for (const slot of slots) {
      const key = slot.start;
      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }
      slotMap.get(key)!.push(memberId);
    }
  }

  // Convert to array, sorted by time
  return Array.from(slotMap.entries())
    .map(([start, memberIds]) => {
      const end = addMinutes(parseISO(start), durationMinutes).toISOString();
      return { start, end, available_member_ids: memberIds };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
