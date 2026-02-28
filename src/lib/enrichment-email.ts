import sgMail from "@sendgrid/mail";
import type {
  EnrichmentInput,
  EmailAnalysis,
  PhoneAnalysis,
  BehaviorSignals,
  KeywordSignals,
} from "@/lib/types";
import type { ClaudeResult } from "@/lib/enrichment";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.EMAIL_FROM || "help@masterworks.com";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Slotly";
const ENRICHMENT_CC_EMAIL = process.env.ENRICHMENT_CC_EMAIL || "";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// ─── Types ──────────────────────────────────────────────

interface MeetingPrepEmailData {
  input: EnrichmentInput;
  emailAnalysis: EmailAnalysis;
  phoneAnalysis: PhoneAnalysis;
  behaviorSignals: BehaviorSignals;
  keywordSignals: KeywordSignals;
  tier1Score: number;
  claudeResult: ClaudeResult | null;
}

// ─── Helpers ────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(isoString: string, timezone: string): string {
  try {
    return new Date(isoString).toLocaleString("en-US", {
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

function getQualBadge(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 75) return { label: "Ready to Invest", color: "#065f46", bgColor: "#d1fae5" };
  if (score >= 60) return { label: "Strong Prospect", color: "#92400e", bgColor: "#fef3c7" };
  if (score >= 45) return { label: "Standard Lead", color: "#1e40af", bgColor: "#dbeafe" };
  return { label: "Early Stage", color: "#9a3412", bgColor: "#ffedd5" };
}

function getApproachDescription(approach: string): string {
  switch (approach) {
    case "direct":
      return "High confidence lead. Get to specifics quickly — available offerings, minimums, timeline.";
    case "consultative":
      return "Promising but needs discovery. Ask about portfolio, investment goals, and timeline.";
    case "educational":
      return "Start with how Masterworks works before qualifying budget and accreditation.";
    case "cautious":
      return "Be friendly but efficiently qualify budget and accreditation early in the call.";
    default:
      return "";
  }
}

function getConfidenceBadge(confidence: string): { label: string; color: string; bgColor: string } {
  switch (confidence) {
    case "high": return { label: "High confidence match", color: "#065f46", bgColor: "#d1fae5" };
    case "medium": return { label: "Possible match", color: "#92400e", bgColor: "#fef3c7" };
    case "low": return { label: "Uncertain match", color: "#6b7280", bgColor: "#f3f4f6" };
    default: return { label: "No results found", color: "#6b7280", bgColor: "#f3f4f6" };
  }
}

// ─── Email Builder ──────────────────────────────────────

function buildMeetingPrepEmail(data: MeetingPrepEmailData): { subject: string; html: string } {
  const { input, emailAnalysis, phoneAnalysis, behaviorSignals, keywordSignals, tier1Score, claudeResult } = data;

  const score = claudeResult?.qualification_score ?? tier1Score;
  const badge = getQualBadge(score);

  // Format the meeting date for subject
  let dateShort: string;
  try {
    dateShort = new Date(input.startTime).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: input.timezone,
    });
  } catch {
    dateShort = new Date(input.startTime).toLocaleDateString("en-US");
  }

  const subject = `Meeting Prep: ${input.inviteeName} — ${input.eventTitle} (${dateShort})`;

  // Build HTML
  const talkingPointsHtml = claudeResult?.talking_points?.length
    ? claudeResult.talking_points.map((tp) =>
        `<tr><td style="padding:4px 0;font-size:14px;color:#374151;">• ${escapeHtml(tp)}</td></tr>`
      ).join("")
    : `<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">No AI talking points available — use signal analysis below.</td></tr>`;

  const riskFlagsHtml = claudeResult?.risk_flags?.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:20px;">
        <tr>
          <td style="font-size:13px;font-weight:600;color:#991b1b;padding-bottom:8px;">Risk Flags</td>
        </tr>
        ${claudeResult.risk_flags.map((rf) =>
          `<tr><td style="font-size:13px;color:#991b1b;padding:2px 0;">⚠ ${escapeHtml(rf)}</td></tr>`
        ).join("")}
      </table>`
    : "";

  const approachHtml = claudeResult?.recommended_approach
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:8px;padding:16px;margin-bottom:20px;">
        <tr>
          <td>
            <span style="font-size:13px;font-weight:600;color:#1e40af;">Recommended Approach: </span>
            <span style="font-size:13px;font-weight:700;color:#1e40af;text-transform:capitalize;">${escapeHtml(claudeResult.recommended_approach)}</span>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#1e40af;padding-top:4px;">${escapeHtml(getApproachDescription(claudeResult.recommended_approach))}</td>
        </tr>
      </table>`
    : "";

  const content = `
    <!-- Qualification Badge -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:${badge.bgColor};border-radius:20px;padding:6px 14px;">
                <span style="font-size:13px;font-weight:700;color:${badge.color};">${badge.label}</span>
              </td>
              <td style="padding-left:12px;">
                <span style="font-size:24px;font-weight:700;color:#111827;">${score}</span>
                <span style="font-size:14px;color:#6b7280;">/100</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Meeting Info -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="font-size:18px;font-weight:700;color:#111827;padding-bottom:4px;">
          ${escapeHtml(input.eventTitle)}
        </td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#6b7280;">
          ${escapeHtml(formatDateTime(input.startTime, input.timezone))}
        </td>
      </tr>
    </table>

    ${claudeResult?.summary ? `
    <!-- AI Summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #4f46e5;">
      <tr>
        <td style="font-size:13px;font-weight:600;color:#4f46e5;padding-bottom:8px;">AI Summary</td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#374151;line-height:1.5;">${escapeHtml(claudeResult.summary)}</td>
      </tr>
    </table>
    ` : ""}

    ${claudeResult?.person_profile ? (() => {
      const confidence = claudeResult.person_confidence || "none";
      const confBadge = getConfidenceBadge(confidence);
      const linkedinUrl = claudeResult.web_search_result?.linkedin_url;
      return `
    <!-- Person Intel -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #059669;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:#059669;">Person Intel</td>
              <td style="padding-left:10px;">
                <span style="background:${confBadge.bgColor};border-radius:12px;padding:2px 10px;font-size:11px;font-weight:600;color:${confBadge.color};">${confBadge.label}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#374151;line-height:1.5;padding-top:8px;">${escapeHtml(claudeResult.person_profile)}</td>
      </tr>
      ${linkedinUrl ? `
      <tr>
        <td style="padding-top:8px;">
          <a href="${escapeHtml(linkedinUrl)}" style="font-size:13px;color:#0077b5;text-decoration:none;font-weight:600;">View LinkedIn Profile &rarr;</a>
        </td>
      </tr>` : ""}
    </table>
    `;
    })() : ""}

    <!-- Talking Points -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;font-weight:600;color:#374151;padding-bottom:8px;">Talking Points</td>
      </tr>
      ${talkingPointsHtml}
    </table>

    ${riskFlagsHtml}
    ${approachHtml}

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="border-top:1px solid #e5e7eb;"></td></tr>
    </table>

    <!-- Invitee Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="font-size:13px;font-weight:600;color:#374151;padding-bottom:12px;">Invitee Details</td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#374151;padding:3px 0;"><strong>Name:</strong> ${escapeHtml(input.inviteeName)}</td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#374151;padding:3px 0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(input.inviteeEmail)}" style="color:#4f46e5;">${escapeHtml(input.inviteeEmail)}</a></td>
      </tr>
      ${input.inviteePhone ? `
      <tr>
        <td style="font-size:14px;color:#374151;padding:3px 0;">
          <strong>Phone:</strong> <a href="tel:${escapeHtml(input.inviteePhone)}" style="color:#4f46e5;">${escapeHtml(input.inviteePhone)}</a>
          ${phoneAnalysis.geo_inference ? `<span style="color:#6b7280;"> (${escapeHtml(phoneAnalysis.geo_inference)})</span>` : ""}
        </td>
      </tr>` : ""}
      ${input.inviteeNotes ? `
      <tr>
        <td style="font-size:14px;color:#374151;padding:3px 0;"><strong>Notes:</strong> ${escapeHtml(input.inviteeNotes)}</td>
      </tr>` : ""}
    </table>

    <!-- Signal Analysis -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;">
      <tr>
        <td style="font-size:12px;font-weight:600;color:#6b7280;padding-bottom:8px;">SIGNAL ANALYSIS</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding:2px 0;">
          Email: ${escapeHtml(emailAnalysis.domain)} (${emailAnalysis.is_personal ? "personal" : "corporate"})${emailAnalysis.company_inference ? ` — ${escapeHtml(emailAnalysis.company_inference)}` : ""}
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding:2px 0;">
          Phone: ${phoneAnalysis.wealth_indicator === "high" ? "🟢" : phoneAnalysis.wealth_indicator === "moderate" ? "🟡" : "⚪"} ${escapeHtml(phoneAnalysis.geo_inference || "Unknown")} — ${phoneAnalysis.wealth_indicator} wealth indicator
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding:2px 0;">
          Behavior: Booked at ${behaviorSignals.booking_hour_local}:00 ${behaviorSignals.booking_day}, ${behaviorSignals.lead_time_hours}h ahead
          ${behaviorSignals.is_repeat_booker ? ` — Repeat booker (${behaviorSignals.prior_bookings_count} prior)` : " — First booking"}
        </td>
      </tr>
      ${keywordSignals.capital_signals.length > 0 ? `
      <tr>
        <td style="font-size:13px;color:#059669;padding:2px 0;">
          Capital signals: ${escapeHtml(keywordSignals.capital_signals.join(", "))}
        </td>
      </tr>` : ""}
      ${keywordSignals.diversifier_signals.length > 0 ? `
      <tr>
        <td style="font-size:13px;color:#059669;padding:2px 0;">
          Diversifier signals: ${escapeHtml(keywordSignals.diversifier_signals.join(", "))}
        </td>
      </tr>` : ""}
      ${keywordSignals.action_signals.length > 0 ? `
      <tr>
        <td style="font-size:13px;color:#2563eb;padding:2px 0;">
          Action intent: ${escapeHtml(keywordSignals.action_signals.join(", "))}
        </td>
      </tr>` : ""}
      ${keywordSignals.long_term_signals.length > 0 ? `
      <tr>
        <td style="font-size:13px;color:#059669;padding:2px 0;">
          Long-term mindset: ${escapeHtml(keywordSignals.long_term_signals.join(", "))}
        </td>
      </tr>` : ""}
      ${keywordSignals.red_flags.length > 0 ? `
      <tr>
        <td style="font-size:13px;color:#dc2626;padding:2px 0;">
          Red flags: ${escapeHtml(keywordSignals.red_flags.join(", "))}
        </td>
      </tr>` : ""}
      <tr>
        <td style="font-size:12px;color:#9ca3af;padding-top:8px;">
          Signal score: ${tier1Score}/100 · AI score: ${claudeResult?.qualification_score ?? "N/A"}/100
        </td>
      </tr>
    </table>`;

  const html = `
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
              AI Meeting Prep by Slotly · Powered by Claude
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ─── Send Function ──────────────────────────────────────

export async function sendMeetingPrepEmail(data: MeetingPrepEmailData): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn("[Enrichment Email] SENDGRID_API_KEY not set, skipping email");
    return;
  }

  const { subject, html } = buildMeetingPrepEmail(data);

  // Build recipient list: team member + CC
  const recipients: string[] = [data.input.teamMemberEmail];
  if (ENRICHMENT_CC_EMAIL && ENRICHMENT_CC_EMAIL !== data.input.teamMemberEmail) {
    recipients.push(ENRICHMENT_CC_EMAIL);
  }

  // Send to each recipient (SendGrid personalizations)
  try {
    await sgMail.send({
      to: recipients.map((email) => ({ email })),
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html,
    });
    console.log(`[Enrichment Email] Meeting prep sent to ${recipients.join(", ")}`);
  } catch (err) {
    console.error(
      "[Enrichment Email] Failed to send:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
}
