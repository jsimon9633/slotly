import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export type WebhookEvent = "booking.created" | "booking.cancelled" | "booking.rescheduled";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Fire webhooks for a given event.
 * Fetches all active webhooks subscribed to this event, sends POST requests,
 * and logs the results. Retries failed deliveries with exponential backoff.
 */
export async function fireWebhooks(event: WebhookEvent, data: Record<string, any>) {
  try {
    // Fetch active webhooks that subscribe to this event
    const { data: webhooks, error } = await supabaseAdmin
      .from("webhooks")
      .select("id, url, secret, events")
      .eq("is_active", true);

    if (error || !webhooks || webhooks.length === 0) return;

    // Filter to webhooks subscribed to this event
    const matching = webhooks.filter(
      (w: any) => Array.isArray(w.events) && w.events.includes(event)
    );

    if (matching.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);

    // Fire all webhooks concurrently
    await Promise.allSettled(
      matching.map((webhook: any) => deliverWebhook(webhook, body, event))
    );
  } catch (err) {
    console.error("fireWebhooks error:", err);
  }
}

/**
 * Deliver a single webhook with retry logic (up to 3 attempts).
 * Retries use exponential backoff: 1s, 4s, 9s.
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  body: string,
  event: WebhookEvent,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const signature = createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Slotly-Signature": signature,
          "X-Slotly-Event": event,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await res.text().catch(() => null);
      const success = res.status >= 200 && res.status < 300;

      // Log this delivery attempt
      await logWebhookDelivery(webhook.id, event, res.status, responseBody, success);

      if (success) return; // Done — no retry needed

      // Non-2xx: retry unless it's a 4xx client error (except 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return; // Don't retry client errors
      }
    } catch (err: any) {
      // Network error or timeout — log and retry
      await logWebhookDelivery(
        webhook.id,
        event,
        null,
        err?.message || "Network error",
        false
      );
    }

    // Exponential backoff before retry
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, attempt * attempt * 1000));
    }
  }
}

async function logWebhookDelivery(
  webhookId: string,
  event: string,
  statusCode: number | null,
  responseBody: string | null,
  success: boolean
) {
  try {
    await supabaseAdmin.from("webhook_logs").insert({
      webhook_id: webhookId,
      event,
      status_code: statusCode,
      response_body: responseBody?.slice(0, 2000) || null, // Cap stored response
      success,
    });
  } catch (err) {
    console.error("Failed to log webhook delivery:", err);
  }
}
