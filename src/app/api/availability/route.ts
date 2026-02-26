import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCombinedAvailability } from "@/lib/availability";
import {
  badRequest,
  notFound,
  serverError,
  validateTimezone,
} from "@/lib/api-errors";
import { getSmartSchedulingData } from "@/lib/smart-scheduling";

// Basic input validation
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const eventTypeSlug = searchParams.get("eventType");
  const teamSlug = searchParams.get("teamSlug"); // optional — scopes to team
  const timezone = searchParams.get("timezone") || "America/New_York";

  if (!date || !eventTypeSlug) {
    return badRequest("Missing required params: date, eventType");
  }

  // Validate date format
  if (!DATE_REGEX.test(date)) {
    return badRequest("Invalid date format. Expected YYYY-MM-DD.");
  }

  // Validate the date is actually real (e.g., reject 2026-02-30)
  const dateCheck = new Date(date + "T12:00:00Z");
  if (isNaN(dateCheck.getTime())) {
    return badRequest("Invalid date.");
  }

  // Validate timezone using IANA check
  if (!validateTimezone(timezone)) {
    return badRequest("Invalid timezone. Please select a valid timezone.");
  }

  // Validate slug (alphanumeric + hyphens only)
  if (!/^[a-z0-9-]+$/.test(eventTypeSlug)) {
    return badRequest("Invalid event type");
  }

  // Look up team if teamSlug provided
  let teamId: string | undefined;
  if (teamSlug) {
    if (!/^[a-z0-9-]+$/.test(teamSlug)) {
      return badRequest("Invalid team slug");
    }
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("slug", teamSlug)
      .eq("is_active", true)
      .single();

    if (!team) {
      return notFound("Team");
    }
    teamId = team.id;
  }

  // Look up event type — only fetch needed fields
  const { data: eventType, error: etError } = await supabaseAdmin
    .from("event_types")
    .select("id, slug, title, duration_minutes, color, before_buffer_mins, after_buffer_mins, min_notice_hours, max_daily_bookings, max_advance_days, team_id")
    .eq("slug", eventTypeSlug)
    .eq("is_active", true)
    .single();

  if (etError) {
    if (etError.code === "PGRST116") {
      return notFound("Event type");
    }
    return serverError("Unable to look up event type. Please try again.", etError, "Availability event type lookup");
  }

  if (!eventType) {
    return notFound("Event type");
  }

  // Verify event type belongs to this team (via direct team_id or join table)
  if (teamId && eventType.team_id !== teamId) {
    const { data: link } = await supabaseAdmin
      .from("team_event_types")
      .select("event_type_id")
      .eq("team_id", teamId)
      .eq("event_type_id", eventType.id)
      .limit(1)
      .maybeSingle();

    if (!link) {
      return notFound("Event type");
    }
  }

  // Use the event type's team_id for scoping (even if no teamSlug was provided)
  const resolvedTeamId = teamId || eventType.team_id;

  // Enforce max advance days — reject requests for dates too far out
  const maxAdvanceDays = eventType.max_advance_days || 10;
  const requestedDate = new Date(date + "T12:00:00Z");
  const maxDate = new Date();
  maxDate.setUTCDate(maxDate.getUTCDate() + maxAdvanceDays);
  if (requestedDate > maxDate) {
    return NextResponse.json({ slots: [], date, timezone });
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
      },
      resolvedTeamId
    );

    // Get smart scheduling recommendations for this date (scoped to team)
    const smartData = await getSmartSchedulingData(date, timezone, resolvedTeamId);

    // Strip internal member IDs + annotate with smart labels
    const slots = rawSlots.map(({ start, end }) => {
      const slotDate = new Date(start);
      // Get hour in the requested timezone
      let hour = slotDate.getUTCHours();
      try {
        const localHour = slotDate.toLocaleString("en-US", {
          timeZone: timezone,
          hour: "numeric",
          hour12: false,
        });
        hour = parseInt(localHour) || hour;
      } catch { /* fallback to UTC */ }

      const smart = smartData.get(hour);
      return {
        start,
        end,
        ...(smart?.label ? { label: smart.label } : {}),
      };
    });

    return NextResponse.json({
      date,
      timezone,
      slots,
    });
  } catch (err) {
    // Classify Google Calendar errors for better logging
    const errMsg = err instanceof Error ? err.message : String(err);
    const isCalendarIssue = errMsg.toLowerCase().includes("calendar") ||
      errMsg.toLowerCase().includes("google") ||
      errMsg.toLowerCase().includes("invalid_grant");

    if (isCalendarIssue) {
      console.error("[Availability] Google Calendar error:", errMsg);
      return serverError(
        "Unable to check calendar availability. Please try again in a moment.",
        err,
        "Availability Google Calendar"
      );
    }

    return serverError(
      "Unable to fetch available times. Please try again.",
      err,
      "Availability general"
    );
  }
}
