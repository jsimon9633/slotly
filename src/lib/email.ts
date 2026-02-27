import sgMail from "@sendgrid/mail";
import { supabaseAdmin } from "@/lib/supabase";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.EMAIL_FROM || "help@masterworks.com";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Slotly";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL || // Netlify sets this automatically
  "https://sparkling-tarsier-bc26ef.netlify.app";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// ─── Custom Template Support ─────────────────────────────

type TemplateType = "booking_confirmation" | "team_member_alert" | "cancellation" | "reschedule" | "reminder";

interface CustomTemplate {
  subject: string | null;
  body_html: string;
}

// 60-second in-memory cache for custom templates
const templateCache: Map<TemplateType, { data: CustomTemplate | null; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000;

async function getCustomTemplate(templateType: TemplateType): Promise<CustomTemplate | null> {
  const cached = templateCache.get(templateType);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const { data } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body_html")
      .eq("template_type", templateType)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const result = data ? { subject: data.subject, body_html: data.body_html } : null;
    templateCache.set(templateType, { data: result, fetchedAt: Date.now() });
    return result;
  } catch {
    // On DB error, return null (fall back to default)
    return null;
  }
}

/**
 * Replace {{variable}} placeholders in a custom template with actual data.
 */
function renderTemplateVariables(
  html: string,
  vars: Record<string, string>
): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Build a standard variable map from booking email data.
 */
function buildVariableMap(data: {
  inviteeName?: string;
  inviteeEmail?: string;
  teamMemberName?: string;
  teamMemberEmail?: string;
  eventTitle?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  notes?: string | null;
  manageToken?: string;
  meetLink?: string;
}): Record<string, string> {
  const vars: Record<string, string> = {};
  if (data.inviteeName) vars.name = data.inviteeName;
  if (data.inviteeEmail) vars.email = data.inviteeEmail;
  if (data.teamMemberName) vars.host_name = data.teamMemberName;
  if (data.teamMemberEmail) vars.host_email = data.teamMemberEmail;
  if (data.eventTitle) vars.event_title = data.eventTitle;
  if (data.durationMinutes) vars.duration = `${data.durationMinutes} minutes`;
  if (data.startTime && data.timezone) {
    vars.start_time = formatDateTime(data.startTime, data.timezone);
    vars.date = new Date(data.startTime).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: data.timezone,
    });
    vars.time = new Date(data.startTime).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: data.timezone, timeZoneName: "short",
    });
  }
  if (data.meetLink) vars.meet_link = data.meetLink;
  if (data.manageToken) {
    vars.manage_link = manageUrl(data.manageToken);
    vars.reschedule_link = rescheduleUrl(data.manageToken);
    vars.cancel_link = cancelUrl(data.manageToken);
  }
  if (data.notes) vars.notes = data.notes;
  return vars;
}

// ─── Helpers ─────────────────────────────────────────────

function formatDateTime(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    });
  } catch {
    return new Date(isoString).toLocaleString("en-US");
  }
}

function formatTime(isoString: string, timezone: string): string {
  try {
    return new Date(isoString).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}

function manageUrl(token: string): string {
  return `${SITE_URL}/manage/${token}`;
}

function rescheduleUrl(token: string): string {
  return `${SITE_URL}/manage/${token}/reschedule`;
}

function cancelUrl(token: string): string {
  return `${SITE_URL}/manage/${token}/cancel`;
}

// ─── Shared layout ───────────────────────────────────────

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#4f46e5;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                    <span style="color:white;font-size:16px;font-weight:bold;">⚡</span>
                  </td>
                  <td style="padding-left:10px;font-size:20px;font-weight:700;color:#111827;">
                    Slotly
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:13px;color:#9ca3af;">
              Powered by Slotly · Fast team scheduling
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Manage buttons block (shared across emails) ─────────

function manageButtonsHtml(token: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:8px;">
                <a href="${rescheduleUrl(token)}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                  Reschedule
                </a>
              </td>
              <td style="padding-left:8px;">
                <a href="${cancelUrl(token)}" style="display:inline-block;padding:10px 20px;background:white;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                  Cancel
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// ─── Email Types ─────────────────────────────────────────

export interface BookingEmailData {
  inviteeName: string;
  inviteeEmail: string;
  teamMemberName: string;
  teamMemberEmail: string;
  eventTitle: string;
  durationMinutes: number;
  startTime: string; // ISO
  endTime: string; // ISO
  timezone: string;
  notes?: string | null;
  manageToken: string;
  meetLink?: string;
  meetPhone?: string;
  meetPin?: string;
}

// ─── Booking details block (reused across templates) ─────

function bookingDetailsHtml(data: {
  eventTitle: string;
  startTime: string;
  endTime: string;
  timezone: string;
  durationMinutes: number;
  withName?: string;
  inviteeName?: string;
  inviteeEmail?: string;
  notes?: string | null;
  meetLink?: string;
  meetPhone?: string;
  meetPin?: string;
}): string {
  const dateStr = formatDateTime(data.startTime, data.timezone);
  const endStr = formatTime(data.endTime, data.timezone);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0" width="100%">
            ${data.inviteeName ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;width:80px;vertical-align:top;">Who</td>
              <td style="padding:6px 0;font-size:15px;color:#111827;font-weight:600;">${data.inviteeName}</td>
            </tr>` : ""}
            ${data.inviteeEmail ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;vertical-align:top;">Email</td>
              <td style="padding:6px 0;font-size:15px;color:#111827;">
                <a href="mailto:${data.inviteeEmail}" style="color:#4f46e5;text-decoration:none;">${data.inviteeEmail}</a>
              </td>
            </tr>` : ""}
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;width:80px;vertical-align:top;">What</td>
              <td style="padding:6px 0;font-size:15px;color:#111827;font-weight:600;">${data.eventTitle}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;vertical-align:top;">When</td>
              <td style="padding:6px 0;font-size:15px;color:#111827;">${dateStr} – ${endStr}</td>
            </tr>
            ${data.withName ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;vertical-align:top;">With</td>
              <td style="padding:6px 0;font-size:15px;color:#111827;">${data.withName}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;vertical-align:top;">Duration</td>
              <td style="padding:6px 0;font-size:15px;color:#111827;">${data.durationMinutes} minutes</td>
            </tr>
            ${data.meetLink ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;vertical-align:top;">Join</td>
              <td style="padding:6px 0;">
                <a href="${data.meetLink}" style="display:inline-block;padding:6px 14px;background:#1a73e8;color:white;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
                  Join with Google Meet
                </a>
                ${data.meetPhone ? `<br/><span style="font-size:12px;color:#6b7280;margin-top:4px;display:inline-block;">Or dial: ${data.meetPhone}${data.meetPin ? ` PIN: ${data.meetPin}#` : ""}</span>` : ""}
              </td>
            </tr>` : ""}
            ${data.notes ? `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#9ca3af;vertical-align:top;">Notes</td>
              <td style="padding:6px 0;font-size:14px;color:#374151;">${data.notes.replace(/\n/g, "<br/>")}</td>
            </tr>` : ""}
          </table>
        </td>
      </tr>
    </table>`;
}

// ─── Booking Confirmation (to the person who booked) ─────

async function buildConfirmationEmail(data: BookingEmailData): Promise<{ subject: string; html: string }> {
  // Check for custom template first
  const custom = await getCustomTemplate("booking_confirmation");
  if (custom) {
    const vars = buildVariableMap(data);
    const renderedBody = renderTemplateVariables(custom.body_html, vars);
    const subject = custom.subject
      ? renderTemplateVariables(custom.subject, vars)
      : `Confirmed: ${data.eventTitle} on ${new Date(data.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: data.timezone })}`;
    return { subject, html: emailWrapper(renderedBody) };
  }

  const subject = `Confirmed: ${data.eventTitle} on ${new Date(data.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: data.timezone })}`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">You're booked! ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Your ${data.eventTitle.toLowerCase()} has been confirmed.
    </p>

    ${bookingDetailsHtml({
      eventTitle: data.eventTitle,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes,
      withName: data.teamMemberName,
      notes: data.notes,
      meetLink: data.meetLink,
      meetPhone: data.meetPhone,
      meetPin: data.meetPin,
    })}

    <p style="margin:0;font-size:14px;color:#6b7280;">
      A calendar invite has been sent to <strong>${data.inviteeEmail}</strong>. See you there!
    </p>

    ${manageButtonsHtml(data.manageToken)}
  `);

  return { subject, html };
}

// ─── New Booking Alert (to the team member) ──────────────

async function buildTeamMemberAlertEmail(data: BookingEmailData): Promise<{ subject: string; html: string }> {
  const custom = await getCustomTemplate("team_member_alert");
  if (custom) {
    const vars = buildVariableMap(data);
    const renderedBody = renderTemplateVariables(custom.body_html, vars);
    const subject = custom.subject
      ? renderTemplateVariables(custom.subject, vars)
      : `New booking: ${data.eventTitle} with ${data.inviteeName}`;
    return { subject, html: emailWrapper(renderedBody) };
  }

  const subject = `New booking: ${data.eventTitle} with ${data.inviteeName}`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">New booking 📅</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      ${data.inviteeName} just booked a ${data.eventTitle.toLowerCase()} with you.
    </p>

    ${bookingDetailsHtml({
      eventTitle: data.eventTitle,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes,
      inviteeName: data.inviteeName,
      inviteeEmail: data.inviteeEmail,
      notes: data.notes,
      meetLink: data.meetLink,
      meetPhone: data.meetPhone,
      meetPin: data.meetPin,
    })}

    <p style="margin:0;font-size:14px;color:#6b7280;">
      This meeting is on your calendar. Check Google Calendar for details.
    </p>

    ${manageButtonsHtml(data.manageToken)}
  `);

  return { subject, html };
}

// ─── Cancellation Email ──────────────────────────────────

export interface CancelEmailData {
  inviteeName: string;
  inviteeEmail: string;
  teamMemberName: string;
  teamMemberEmail: string;
  eventTitle: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  timezone: string;
  cancelledBy: "invitee" | "team";
}

async function buildCancellationEmail(data: CancelEmailData, recipient: "invitee" | "team"): Promise<{ subject: string; html: string }> {
  const custom = await getCustomTemplate("cancellation");
  if (custom) {
    const vars: Record<string, string> = {
      ...buildVariableMap({
        inviteeName: data.inviteeName,
        inviteeEmail: data.inviteeEmail,
        teamMemberName: data.teamMemberName,
        teamMemberEmail: data.teamMemberEmail,
        eventTitle: data.eventTitle,
        durationMinutes: data.durationMinutes,
        startTime: data.startTime,
        endTime: data.endTime,
        timezone: data.timezone,
      }),
      cancelled_by: data.cancelledBy,
    };
    const renderedBody = renderTemplateVariables(custom.body_html, vars);
    const subject = custom.subject
      ? renderTemplateVariables(custom.subject, vars)
      : `Cancelled: ${data.eventTitle} on ${new Date(data.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: data.timezone })}`;
    return { subject, html: emailWrapper(renderedBody) };
  }

  const subject = `Cancelled: ${data.eventTitle} on ${new Date(data.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: data.timezone })}`;

  const whoLabel = recipient === "invitee"
    ? "Your meeting has been cancelled."
    : `${data.inviteeName} cancelled their ${data.eventTitle.toLowerCase()}.`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#dc2626;">Booking Cancelled</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      ${whoLabel}
    </p>

    ${bookingDetailsHtml({
      eventTitle: data.eventTitle,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes,
      withName: recipient === "invitee" ? data.teamMemberName : undefined,
      inviteeName: recipient === "team" ? data.inviteeName : undefined,
      inviteeEmail: recipient === "team" ? data.inviteeEmail : undefined,
    })}

    <p style="margin:0;font-size:14px;color:#6b7280;">
      The calendar event has been removed.
    </p>
  `);

  return { subject, html };
}

// ─── Reschedule Email ────────────────────────────────────

export interface RescheduleEmailData {
  inviteeName: string;
  inviteeEmail: string;
  teamMemberName: string;
  teamMemberEmail: string;
  eventTitle: string;
  durationMinutes: number;
  oldStartTime: string;
  oldEndTime: string;
  newStartTime: string;
  newEndTime: string;
  timezone: string;
  manageToken: string;
}

async function buildRescheduleEmail(data: RescheduleEmailData, recipient: "invitee" | "team"): Promise<{ subject: string; html: string }> {
  const custom = await getCustomTemplate("reschedule");
  if (custom) {
    const vars: Record<string, string> = {
      ...buildVariableMap({
        inviteeName: data.inviteeName,
        inviteeEmail: data.inviteeEmail,
        teamMemberName: data.teamMemberName,
        teamMemberEmail: data.teamMemberEmail,
        eventTitle: data.eventTitle,
        durationMinutes: data.durationMinutes,
        startTime: data.newStartTime,
        endTime: data.newEndTime,
        timezone: data.timezone,
        manageToken: data.manageToken,
      }),
      old_start_time: formatDateTime(data.oldStartTime, data.timezone),
    };
    const renderedBody = renderTemplateVariables(custom.body_html, vars);
    const subject = custom.subject
      ? renderTemplateVariables(custom.subject, vars)
      : `Rescheduled: ${data.eventTitle} → ${new Date(data.newStartTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: data.timezone })}`;
    return { subject, html: emailWrapper(renderedBody) };
  }

  const newDateStr = formatDateTime(data.newStartTime, data.timezone);
  const subject = `Rescheduled: ${data.eventTitle} → ${new Date(data.newStartTime).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: data.timezone })}`;

  const oldDateStr = formatDateTime(data.oldStartTime, data.timezone);
  const oldEndStr = formatTime(data.oldEndTime, data.timezone);

  const whoLabel = recipient === "invitee"
    ? "Your meeting has been rescheduled."
    : `${data.inviteeName} rescheduled their ${data.eventTitle.toLowerCase()}.`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#4f46e5;">Meeting Rescheduled 🔄</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      ${whoLabel}
    </p>

    <!-- Old time (struck out) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;padding:12px 20px;margin-bottom:8px;">
      <tr>
        <td>
          <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Previous Time</span><br/>
          <span style="font-size:15px;color:#991b1b;text-decoration:line-through;">${oldDateStr} – ${oldEndStr}</span>
        </td>
      </tr>
    </table>

    <!-- New time -->
    ${bookingDetailsHtml({
      eventTitle: data.eventTitle,
      startTime: data.newStartTime,
      endTime: data.newEndTime,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes,
      withName: recipient === "invitee" ? data.teamMemberName : undefined,
      inviteeName: recipient === "team" ? data.inviteeName : undefined,
      inviteeEmail: recipient === "team" ? data.inviteeEmail : undefined,
    })}

    <p style="margin:0;font-size:14px;color:#6b7280;">
      Your calendar has been updated automatically.
    </p>

    ${manageButtonsHtml(data.manageToken)}
  `);

  return { subject, html };
}

// ─── Reminder Email (2hr before, high-risk bookings) ─────

export interface ReminderEmailData {
  inviteeName: string;
  inviteeEmail: string;
  teamMemberName: string;
  eventTitle: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  timezone: string;
  manageToken: string;
  meetLink?: string;
}

async function buildReminderEmail(data: ReminderEmailData): Promise<{ subject: string; html: string }> {
  const custom = await getCustomTemplate("reminder");
  if (custom) {
    const vars = buildVariableMap({
      inviteeName: data.inviteeName,
      inviteeEmail: data.inviteeEmail,
      teamMemberName: data.teamMemberName,
      eventTitle: data.eventTitle,
      durationMinutes: data.durationMinutes,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      manageToken: data.manageToken,
      meetLink: data.meetLink,
    });
    const renderedBody = renderTemplateVariables(custom.body_html, vars);
    const timeStr = new Date(data.startTime).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: data.timezone, timeZoneName: "short",
    });
    const subject = custom.subject
      ? renderTemplateVariables(custom.subject, vars)
      : `Reminder: ${data.eventTitle} today at ${timeStr}`;
    return { subject, html: emailWrapper(renderedBody) };
  }

  const timeStr = new Date(data.startTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: data.timezone,
    timeZoneName: "short",
  });

  const subject = `Reminder: ${data.eventTitle} today at ${timeStr}`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Quick reminder! ⏰</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
      Your ${data.eventTitle.toLowerCase()} is coming up in about 2 hours.
    </p>

    ${bookingDetailsHtml({
      eventTitle: data.eventTitle,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes,
      withName: data.teamMemberName,
      meetLink: data.meetLink,
    })}

    <p style="margin:0;font-size:14px;color:#6b7280;">
      Can't make it? No worries — you can reschedule or cancel below.
    </p>

    ${manageButtonsHtml(data.manageToken)}
  `);

  return { subject, html };
}

/**
 * Send reminder email to invitee (high-risk bookings, 2hrs before).
 */
export async function sendReminderEmail(data: ReminderEmailData): Promise<boolean> {
  const { subject, html } = await buildReminderEmail(data);
  return sendEmail(data.inviteeEmail, subject, html);
}

// ─── Send functions ──────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY not set — skipping email to", to);
    return false;
  }

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (err: any) {
    console.error(`Email failed to ${to}:`, err?.response?.body || err.message);
    return false;
  }
}

/**
 * Send booking confirmation to invitee + alert to team member.
 */
export async function sendBookingEmails(data: BookingEmailData): Promise<void> {
  const [confirmation, alert] = await Promise.all([
    buildConfirmationEmail(data),
    buildTeamMemberAlertEmail(data),
  ]);

  await Promise.allSettled([
    sendEmail(data.inviteeEmail, confirmation.subject, confirmation.html),
    sendEmail(data.teamMemberEmail, alert.subject, alert.html),
  ]);
}

/**
 * Send cancellation emails to both parties.
 */
export async function sendCancellationEmails(data: CancelEmailData): Promise<void> {
  const [inviteeEmail, teamEmail] = await Promise.all([
    buildCancellationEmail(data, "invitee"),
    buildCancellationEmail(data, "team"),
  ]);

  await Promise.allSettled([
    sendEmail(data.inviteeEmail, inviteeEmail.subject, inviteeEmail.html),
    sendEmail(data.teamMemberEmail, teamEmail.subject, teamEmail.html),
  ]);
}

/**
 * Send reschedule emails to both parties.
 */
export async function sendRescheduleEmails(data: RescheduleEmailData): Promise<void> {
  const [inviteeEmail, teamEmail] = await Promise.all([
    buildRescheduleEmail(data, "invitee"),
    buildRescheduleEmail(data, "team"),
  ]);

  await Promise.allSettled([
    sendEmail(data.inviteeEmail, inviteeEmail.subject, inviteeEmail.html),
    sendEmail(data.teamMemberEmail, teamEmail.subject, teamEmail.html),
  ]);
}
