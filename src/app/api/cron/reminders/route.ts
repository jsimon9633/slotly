import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendReminderEmail } from "@/lib/email";
import { RISK_THRESHOLDS } from "@/lib/no-show-score";
import { executeTimedWorkflows } from "@/lib/workflows";

/**
 * GET /api/cron/reminders — Send 2-hour reminder emails for high-risk bookings.
 *
 * Should be called every 15 minutes by a cron job (Netlify scheduled function,
 * GitHub Action, or external service like cron-job.org).
 *
 * Protected by CRON_SECRET header to prevent unauthorized calls.
 *
 * Logic:
 * 1. Find confirmed bookings starting in 1.5–2.5 hours
 * 2. Filter to high-risk (no_show_score >= 65) OR medium-risk with no topic
 * 3. Skip any with reminder_sent_at already set
 * 4. Send reminder email + mark as sent
 */

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  // Auth: verify cron secret (skip in dev if not set)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 90 * 60 * 1000); // 1.5 hours from now
  const windowEnd = new Date(now.getTime() + 150 * 60 * 1000); // 2.5 hours from now

  try {
    // Find bookings starting in the 1.5–2.5 hour window that haven't been reminded
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        invitee_name,
        invitee_email,
        start_time,
        end_time,
        timezone,
        manage_token,
        no_show_score,
        risk_tier,
        reminder_sent_at,
        google_event_id,
        event_types ( title, duration_minutes ),
        team_members ( name, email, google_calendar_id )
      `)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .gte("no_show_score", RISK_THRESHOLDS.MEDIUM); // medium + high risk

    if (error) {
      console.error("[Cron/Reminders] Query failed:", error.message);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0, message: "No reminders needed" });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      const eventType = booking.event_types as any;
      const teamMember = booking.team_members as any;

      if (!booking.manage_token || !eventType || !teamMember) {
        continue;
      }

      try {
        const success = await sendReminderEmail({
          inviteeName: booking.invitee_name,
          inviteeEmail: booking.invitee_email,
          teamMemberName: teamMember.name,
          eventTitle: eventType.title,
          durationMinutes: eventType.duration_minutes,
          startTime: booking.start_time,
          endTime: booking.end_time,
          timezone: booking.timezone,
          manageToken: booking.manage_token,
        });

        if (success) {
          // Mark reminder as sent
          await supabaseAdmin
            .from("bookings")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          sent++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Booking ${booking.id}: ${msg}`);
        console.error(`[Cron/Reminders] Failed for booking ${booking.id}:`, msg);
      }
    }

    // Also execute time-based workflows (before_meeting / after_meeting)
    let workflowsExecuted = 0;
    try {
      workflowsExecuted = await executeTimedWorkflows();
    } catch (wfErr) {
      console.error("[Cron/Reminders] Workflow execution error:", wfErr instanceof Error ? wfErr.message : wfErr);
    }

    return NextResponse.json({
      sent,
      checked: bookings.length,
      workflows_executed: workflowsExecuted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[Cron/Reminders] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
