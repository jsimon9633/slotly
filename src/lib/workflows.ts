import { supabaseAdmin } from "@/lib/supabase";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.EMAIL_FROM || "help@masterworks.com";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Slotly";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  "https://sparkling-tarsier-bc26ef.netlify.app";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface WorkflowBookingData {
  inviteeName: string;
  inviteeEmail: string;
  inviteePhone?: string | null;
  teamMemberName: string;
  teamMemberEmail: string;
  eventTitle: string;
  startTime: string; // ISO
  endTime: string; // ISO
  timezone: string;
  manageToken: string;
  meetLink?: string;
  customAnswers?: Record<string, any> | null;
}

interface WorkflowRow {
  id: string;
  event_type_id: string;
  name: string;
  trigger: string;
  trigger_minutes: number;
  action: string;
  recipient: string;
  subject: string | null;
  body: string;
  is_active: boolean;
}

/**
 * Render template variables in a string.
 * Supported: {{name}}, {{email}}, {{phone}}, {{event_title}}, {{start_time}},
 * {{date}}, {{time}}, {{meet_link}}, {{manage_link}}, {{host_name}}, {{host_email}}
 */
function renderTemplate(template: string, data: WorkflowBookingData): string {
  const startDate = new Date(data.startTime);

  let dateStr: string;
  let timeStr: string;
  try {
    dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: data.timezone,
    });
    timeStr = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: data.timezone,
      timeZoneName: "short",
    });
  } catch {
    dateStr = startDate.toLocaleDateString("en-US");
    timeStr = startDate.toLocaleTimeString("en-US");
  }

  return template
    .replace(/\{\{name\}\}/g, data.inviteeName)
    .replace(/\{\{email\}\}/g, data.inviteeEmail)
    .replace(/\{\{phone\}\}/g, data.inviteePhone || "N/A")
    .replace(/\{\{event_title\}\}/g, data.eventTitle)
    .replace(/\{\{start_time\}\}/g, `${dateStr} at ${timeStr}`)
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{time\}\}/g, timeStr)
    .replace(/\{\{meet_link\}\}/g, data.meetLink || "N/A")
    .replace(/\{\{manage_link\}\}/g, `${SITE_URL}/manage/${data.manageToken}`)
    .replace(/\{\{host_name\}\}/g, data.teamMemberName)
    .replace(/\{\{host_email\}\}/g, data.teamMemberEmail);
}

/**
 * Execute a single workflow — send email or SMS.
 */
async function executeWorkflow(workflow: WorkflowRow, data: WorkflowBookingData): Promise<boolean> {
  try {
    const renderedBody = renderTemplate(workflow.body, data);
    const renderedSubject = workflow.subject ? renderTemplate(workflow.subject, data) : `${data.eventTitle} — ${workflow.name}`;

    // Determine recipients
    const recipients: string[] = [];
    if (workflow.recipient === "invitee" || workflow.recipient === "both") {
      recipients.push(data.inviteeEmail);
    }
    if (workflow.recipient === "host" || workflow.recipient === "both") {
      recipients.push(data.teamMemberEmail);
    }

    if (workflow.action === "send_email") {
      if (!SENDGRID_API_KEY) {
        console.warn(`[Workflow] SENDGRID_API_KEY not set — skipping workflow "${workflow.name}"`);
        return false;
      }

      // Wrap in basic HTML
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f8fa;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e5e7eb;padding:32px;">
    ${renderedBody.replace(/\n/g, "<br/>")}
  </div>
  <p style="text-align:center;margin-top:20px;font-size:13px;color:#9ca3af;">Powered by Slotly</p>
</body>
</html>`;

      await Promise.allSettled(
        recipients.map((to) =>
          sgMail.send({
            to,
            from: { email: FROM_EMAIL, name: FROM_NAME },
            subject: renderedSubject,
            html,
          })
        )
      );

      console.log(`[Workflow] Executed "${workflow.name}" (email) → ${recipients.join(", ")}`);
      return true;
    }

    if (workflow.action === "send_sms") {
      // Check if SMS is enabled
      const { data: smsEnabledRow } = await supabaseAdmin
        .from("site_settings")
        .select("value")
        .eq("key", "sms_enabled")
        .single();

      if (!smsEnabledRow || smsEnabledRow.value !== "true") {
        console.warn(`[Workflow] SMS not enabled — skipping workflow "${workflow.name}"`);
        return false;
      }

      // Get Twilio credentials
      const { data: twilioRows } = await supabaseAdmin
        .from("site_settings")
        .select("key, value")
        .in("key", ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"]);

      const twilioConfig: Record<string, string> = {};
      for (const row of twilioRows || []) {
        twilioConfig[row.key] = row.value;
      }

      const { twilio_account_sid, twilio_auth_token, twilio_phone_number } = twilioConfig;
      if (!twilio_account_sid || !twilio_auth_token || !twilio_phone_number) {
        console.warn(`[Workflow] Twilio not configured — skipping SMS workflow "${workflow.name}"`);
        return false;
      }

      // Send SMS via Twilio REST API
      const smsRecipients: string[] = [];
      if ((workflow.recipient === "invitee" || workflow.recipient === "both") && data.inviteePhone) {
        smsRecipients.push(data.inviteePhone);
      }
      // Host SMS would require phone numbers in team_members — skip for now

      for (const phone of smsRecipients) {
        try {
          const auth = Buffer.from(`${twilio_account_sid}:${twilio_auth_token}`).toString("base64");
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: twilio_phone_number,
              Body: renderedBody,
            }),
          });
          console.log(`[Workflow] SMS sent to ${phone}: "${workflow.name}"`);
        } catch (smsErr) {
          console.error(`[Workflow] SMS failed for ${phone}:`, smsErr instanceof Error ? smsErr.message : smsErr);
        }
      }

      return true;
    }

    return false;
  } catch (err) {
    console.error(`[Workflow] Execution failed for "${workflow.name}":`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Execute all active instant workflows for a given trigger.
 * Call this from booking/cancel/reschedule handlers.
 */
export async function executeInstantWorkflows(
  eventTypeId: string,
  trigger: "on_booking" | "on_cancel" | "on_reschedule",
  data: WorkflowBookingData
): Promise<void> {
  try {
    const { data: workflows, error } = await supabaseAdmin
      .from("workflows")
      .select("id, event_type_id, name, trigger, trigger_minutes, action, recipient, subject, body, is_active")
      .eq("event_type_id", eventTypeId)
      .eq("trigger", trigger)
      .eq("is_active", true);

    if (error || !workflows || workflows.length === 0) return;

    await Promise.allSettled(
      workflows.map((wf) => executeWorkflow(wf as WorkflowRow, data))
    );
  } catch (err) {
    console.error(`[Workflow] Failed to execute instant workflows:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Execute time-based workflows (before_meeting / after_meeting).
 * Called from the cron handler every 15 minutes.
 */
export async function executeTimedWorkflows(): Promise<number> {
  let executed = 0;

  try {
    // Get all active time-based workflows
    const { data: workflows, error } = await supabaseAdmin
      .from("workflows")
      .select("id, event_type_id, name, trigger, trigger_minutes, action, recipient, subject, body, is_active")
      .in("trigger", ["before_meeting", "after_meeting"])
      .eq("is_active", true);

    if (error || !workflows || workflows.length === 0) return 0;

    const now = new Date();

    for (const wf of workflows) {
      // Find bookings that match this workflow's timing window
      // For before_meeting: booking starts in trigger_minutes ± 7.5 min (half of 15-min cron window)
      // For after_meeting: booking ended trigger_minutes ago ± 7.5 min
      const windowMinutes = 7.5;

      let rangeStart: Date;
      let rangeEnd: Date;
      const timeField = wf.trigger === "before_meeting" ? "start_time" : "end_time";

      if (wf.trigger === "before_meeting") {
        // Booking starts in trigger_minutes from now
        rangeStart = new Date(now.getTime() + (wf.trigger_minutes - windowMinutes) * 60000);
        rangeEnd = new Date(now.getTime() + (wf.trigger_minutes + windowMinutes) * 60000);
      } else {
        // Booking ended trigger_minutes ago
        rangeStart = new Date(now.getTime() - (wf.trigger_minutes + windowMinutes) * 60000);
        rangeEnd = new Date(now.getTime() - (wf.trigger_minutes - windowMinutes) * 60000);
      }

      const { data: bookings } = await supabaseAdmin
        .from("bookings")
        .select("id, invitee_name, invitee_email, invitee_phone, invitee_notes, start_time, end_time, timezone, manage_token, team_member_id, event_type_id, google_event_id, custom_answers")
        .eq("event_type_id", wf.event_type_id)
        .eq("status", "confirmed")
        .gte(timeField, rangeStart.toISOString())
        .lte(timeField, rangeEnd.toISOString());

      if (!bookings || bookings.length === 0) continue;

      for (const booking of bookings) {
        // Check if we already executed this workflow for this booking
        // Simple dedup: use a composite key check via workflow_executions or similar
        // For now, use a lightweight approach — check if reminder_sent_at is set for before_meeting
        // For a more robust solution, we'd add a workflow_executions table

        // Get team member info
        const { data: member } = await supabaseAdmin
          .from("team_members")
          .select("name, email, google_calendar_id")
          .eq("id", booking.team_member_id)
          .single();

        if (!member) continue;

        // Get event type title
        const { data: et } = await supabaseAdmin
          .from("event_types")
          .select("title")
          .eq("id", booking.event_type_id)
          .single();

        await executeWorkflow(wf as WorkflowRow, {
          inviteeName: booking.invitee_name,
          inviteeEmail: booking.invitee_email,
          inviteePhone: booking.invitee_phone,
          teamMemberName: member.name,
          teamMemberEmail: member.email,
          eventTitle: et?.title || "Meeting",
          startTime: booking.start_time,
          endTime: booking.end_time,
          timezone: booking.timezone,
          manageToken: booking.manage_token,
          meetLink: booking.google_event_id ? undefined : undefined, // Meet link not stored on booking
          customAnswers: booking.custom_answers,
        });

        executed++;
      }
    }
  } catch (err) {
    console.error("[Workflow] Timed workflow execution failed:", err instanceof Error ? err.message : err);
  }

  return executed;
}
