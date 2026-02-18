import sgMail from "@sendgrid/mail";

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

function buildConfirmationEmail(data: BookingEmailData): { subject: string; html: string } {
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
    })}

    <p style="margin:0;font-size:14px;color:#6b7280;">
      A calendar invite has been sent to <strong>${data.inviteeEmail}</strong>. See you there!
    </p>

    ${manageButtonsHtml(data.manageToken)}
  `);

  return { subject, html };
}

// ─── New Booking Alert (to the team member) ──────────────

function buildTeamMemberAlertEmail(data: BookingEmailData): { subject: string; html: string } {
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

function buildCancellationEmail(data: CancelEmailData, recipient: "invitee" | "team"): { subject: string; html: string } {
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

function buildRescheduleEmail(data: RescheduleEmailData, recipient: "invitee" | "team"): { subject: string; html: string } {
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
  const confirmation = buildConfirmationEmail(data);
  const alert = buildTeamMemberAlertEmail(data);

  await Promise.allSettled([
    sendEmail(data.inviteeEmail, confirmation.subject, confirmation.html),
    sendEmail(data.teamMemberEmail, alert.subject, alert.html),
  ]);
}

/**
 * Send cancellation emails to both parties.
 */
export async function sendCancellationEmails(data: CancelEmailData): Promise<void> {
  const inviteeEmail = buildCancellationEmail(data, "invitee");
  const teamEmail = buildCancellationEmail(data, "team");

  await Promise.allSettled([
    sendEmail(data.inviteeEmail, inviteeEmail.subject, inviteeEmail.html),
    sendEmail(data.teamMemberEmail, teamEmail.subject, teamEmail.html),
  ]);
}

/**
 * Send reschedule emails to both parties.
 */
export async function sendRescheduleEmails(data: RescheduleEmailData): Promise<void> {
  const inviteeEmail = buildRescheduleEmail(data, "invitee");
  const teamEmail = buildRescheduleEmail(data, "team");

  await Promise.allSettled([
    sendEmail(data.inviteeEmail, inviteeEmail.subject, inviteeEmail.html),
    sendEmail(data.teamMemberEmail, teamEmail.subject, teamEmail.html),
  ]);
}
