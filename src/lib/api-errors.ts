import { NextResponse } from "next/server";

/**
 * Structured API error responses — user-friendly messages with internal logging.
 * Never expose raw Supabase/Google errors to clients.
 */

// Standard error response shape
interface ApiError {
  error: string;
  code?: string;
}

// ── User-facing error helpers ──

export function badRequest(message: string, code?: string) {
  const body: ApiError = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function notFound(resource = "Resource") {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function gone(message: string) {
  return NextResponse.json({ error: message }, { status: 410 });
}

export function tooManyRequests(message = "Too many requests. Please try again later.") {
  return NextResponse.json({ error: message }, { status: 429 });
}

export function serverError(
  userMessage: string,
  internalError?: unknown,
  context?: string
) {
  // Log full error internally, return safe message to user
  if (internalError) {
    const errMsg =
      internalError instanceof Error
        ? internalError.message
        : String(internalError);
    console.error(`[API Error] ${context || "Unknown"}: ${errMsg}`);
  }
  return NextResponse.json({ error: userMessage }, { status: 500 });
}

// ── Supabase error helper ──

/**
 * Safe Supabase error handler — never leaks raw PG errors to client.
 * Returns a user-friendly message and logs the real error.
 */
export function handleSupabaseError(
  error: { message: string; code?: string } | null,
  context: string,
  userMessage: string
): NextResponse | null {
  if (!error) return null;
  console.error(`[Supabase] ${context}: ${error.message} (code: ${error.code})`);
  return NextResponse.json({ error: userMessage }, { status: 500 });
}

// ── Partial failure tracking for multi-step operations ──

export interface OperationWarnings {
  calendar_synced: boolean;
  email_sent: boolean;
  webhook_fired: boolean;
}

/**
 * Build a success response that surfaces any partial failures as warnings.
 * e.g. "Booking created, but calendar sync failed"
 */
export function successWithWarnings(
  data: Record<string, unknown>,
  warnings: Partial<OperationWarnings>
) {
  const warningMessages: string[] = [];

  if (warnings.calendar_synced === false) {
    warningMessages.push("Calendar event could not be synced — please check your Google Calendar settings.");
  }
  if (warnings.email_sent === false) {
    warningMessages.push("Confirmation email could not be sent — the booking is still confirmed.");
  }
  if (warnings.webhook_fired === false) {
    warningMessages.push("Webhook notification failed.");
  }

  return NextResponse.json({
    ...data,
    ...(warningMessages.length > 0 ? { warnings: warningMessages } : {}),
  });
}

// ── Google Calendar specific errors ──

export function isGoogleAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("invalid_grant") ||
    msg.includes("token has been expired") ||
    msg.includes("access_denied") ||
    msg.includes("insufficient permission") ||
    msg.includes("forbidden")
  );
}

export function isGoogleRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("429") ||
    msg.includes("user rate limit exceeded")
  );
}

export function isGoogleNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("404") || err.message.toLowerCase().includes("not found");
}

/**
 * Classify a Google Calendar error into an actionable category.
 */
export function classifyGoogleError(err: unknown): {
  type: "auth" | "rate_limit" | "not_found" | "network" | "unknown";
  userMessage: string;
  shouldRetry: boolean;
} {
  if (isGoogleAuthError(err)) {
    return {
      type: "auth",
      userMessage: "Google Calendar access has expired. Please reconnect your calendar.",
      shouldRetry: false,
    };
  }
  if (isGoogleRateLimitError(err)) {
    return {
      type: "rate_limit",
      userMessage: "Google Calendar is temporarily busy. Please try again in a moment.",
      shouldRetry: true,
    };
  }
  if (isGoogleNotFoundError(err)) {
    return {
      type: "not_found",
      userMessage: "Calendar event not found — it may have been deleted directly in Google Calendar.",
      shouldRetry: false,
    };
  }

  // Network / timeout errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("econnrefused") || msg.includes("timeout") || msg.includes("enotfound") || msg.includes("network")) {
      return {
        type: "network",
        userMessage: "Could not reach Google Calendar. Please check your internet connection.",
        shouldRetry: true,
      };
    }
  }

  return {
    type: "unknown",
    userMessage: "Something went wrong with Google Calendar sync.",
    shouldRetry: false,
  };
}

// ── Input validation helpers ──

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTimezone(tz: string): boolean {
  // Must look like IANA timezone format (e.g., America/New_York, Europe/London)
  if (!/^[A-Za-z_]+\/[A-Za-z_]+/.test(tz) && !["UTC", "GMT"].includes(tz)) {
    return false;
  }
  // Verify it's actually resolvable
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function sanitizeString(str: string, maxLen: number): string {
  return str.trim().slice(0, maxLen);
}
