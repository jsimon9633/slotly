/**
 * Slack notification helper for re-auth reminders.
 * Uses Slack incoming webhook or bot token for DMs.
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

interface SlackNotifyParams {
  teamMemberName: string;
  teamMemberEmail: string;
  reauthUrl: string;
  slackUserId?: string;
}

/**
 * Send a re-auth notification via Slack.
 * Tries DM first (if bot token + slack user ID available),
 * falls back to webhook channel post.
 */
export async function sendSlackReauthNotification(params: SlackNotifyParams): Promise<boolean> {
  const message = `:warning: *Calendar Disconnected*\n${params.teamMemberName}'s Google Calendar connection has expired or been revoked.\n\n<${params.reauthUrl}|Click here to reconnect>`;

  // Try DM via bot token if slack_user_id available
  if (SLACK_BOT_TOKEN && params.slackUserId) {
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({
          channel: params.slackUserId,
          text: message,
          unfurl_links: false,
        }),
      });

      const data = await res.json();
      if (data.ok) return true;
      console.error("[Slack] DM failed:", data.error);
    } catch (err) {
      console.error("[Slack] DM error:", err instanceof Error ? err.message : err);
    }
  }

  // Fallback: webhook channel post
  if (SLACK_WEBHOOK_URL) {
    try {
      const res = await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });

      return res.ok;
    } catch (err) {
      console.error("[Slack] Webhook error:", err instanceof Error ? err.message : err);
    }
  }

  console.warn("[Slack] No SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN configured. Skipping notification.");
  return false;
}
