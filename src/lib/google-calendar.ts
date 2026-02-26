import { google, calendar_v3 } from "googleapis";
import { getOAuthCalendarClient, refreshAccessToken } from "./google-oauth";

/**
 * Create authenticated Google Calendar client using service account (legacy fallback).
 * If `impersonateEmail` is provided, the service account will act as that user
 * (requires domain-wide delegation in Google Workspace Admin).
 */
function getServiceAccountClient(impersonateEmail?: string): calendar_v3.Calendar {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonateEmail,
  });

  return google.calendar({ version: "v3", auth });
}

/**
 * Try to get an OAuth-authenticated calendar client for a member.
 * Returns null if no OAuth token or refresh fails.
 */
async function tryGetOAuthClient(oauthRefreshToken?: string): Promise<calendar_v3.Calendar | null> {
  if (!oauthRefreshToken) return null;

  try {
    const result = await refreshAccessToken(oauthRefreshToken);
    if (!result) return null;
    return getOAuthCalendarClient(result.access_token);
  } catch (err) {
    console.error("[Calendar] OAuth token refresh failed, falling back to service account:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get free/busy information for a team member's calendar.
 * Uses OAuth if available, falls back to service account.
 */
export async function getFreeBusy(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  oauthRefreshToken?: string
): Promise<{ start: string; end: string }[]> {
  // Tier 1: Try OAuth
  const oauthClient = await tryGetOAuthClient(oauthRefreshToken);
  if (oauthClient) {
    try {
      const res = await oauthClient.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: [{ id: "primary" }],
        },
      });
      const busy = res.data.calendars?.["primary"]?.busy || [];
      return busy.map((b) => ({ start: b.start!, end: b.end! }));
    } catch (err) {
      console.error("[Calendar] OAuth free/busy failed, falling back to service account:", err instanceof Error ? err.message : err);
    }
  }

  // Tier 2: Service account fallback
  const calendar = getServiceAccountClient();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    },
  });

  const busy = res.data.calendars?.[calendarId]?.busy || [];
  return busy.map((b) => ({
    start: b.start!,
    end: b.end!,
  }));
}

/**
 * Create a calendar event for a booking.
 * Tier 1: OAuth (user's own calendar)
 * Tier 2: Service account — impersonation → shared calendar → SA calendar
 */
export interface CalendarEventResult {
  eventId: string;
  meetLink?: string;
  meetPhone?: string;
  meetPin?: string;
}

export async function createCalendarEvent(params: {
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmail: string;
  timezone: string;
  oauthRefreshToken?: string;
}): Promise<CalendarEventResult> {
  const eventBody = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.startTime,
      timeZone: params.timezone,
    },
    end: {
      dateTime: params.endTime,
      timeZone: params.timezone,
    },
    attendees: [{ email: params.attendeeEmail }],
    conferenceData: {
      createRequest: {
        requestId: `slotly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 10 },
      ],
    },
  };

  function extractMeetDetails(data: any): CalendarEventResult {
    const result: CalendarEventResult = { eventId: data.id! };
    const ep = data.conferenceData?.entryPoints;
    if (ep) {
      const video = ep.find((e: any) => e.entryPointType === "video");
      const phone = ep.find((e: any) => e.entryPointType === "phone");
      if (video) result.meetLink = video.uri;
      if (phone) {
        result.meetPhone = phone.label || phone.uri?.replace("tel:", "");
        result.meetPin = phone.pin;
      }
    }
    return result;
  }

  // Tier 1: OAuth — create on user's primary calendar
  const oauthClient = await tryGetOAuthClient(params.oauthRefreshToken);
  if (oauthClient) {
    try {
      const res = await oauthClient.events.insert({
        calendarId: "primary",
        requestBody: eventBody,
        sendUpdates: "all",
        conferenceDataVersion: 1,
      });
      console.log("[Calendar] Event created via OAuth");
      return extractMeetDetails(res.data);
    } catch (err) {
      console.error("[Calendar] OAuth event creation failed, falling back to service account:", err instanceof Error ? err.message : err);
    }
  }

  // Tier 2a: Service account — impersonate the team member
  try {
    const calendar = getServiceAccountClient(params.calendarId);
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });
    return extractMeetDetails(res.data);
  } catch {
    // Impersonation not available
  }

  // Tier 2b: Service account — shared calendar
  try {
    const calendar = getServiceAccountClient();
    const res = await calendar.events.insert({
      calendarId: params.calendarId,
      requestBody: eventBody,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });
    return extractMeetDetails(res.data);
  } catch {
    // Shared calendar not available
  }

  // Tier 2c: Service account — own calendar with attendees
  const calendar = getServiceAccountClient();
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      ...eventBody,
      attendees: [
        { email: params.calendarId },
        { email: params.attendeeEmail },
      ],
    },
    sendUpdates: "all",
    conferenceDataVersion: 1,
  });
  return extractMeetDetails(res.data);
}

/**
 * Delete a calendar event (for cancellation).
 * Tier 1: OAuth, Tier 2: Service account 3-tier fallback.
 */
export async function deleteCalendarEvent(
  googleEventId: string,
  calendarId: string,
  oauthRefreshToken?: string
): Promise<boolean> {
  // Tier 1: OAuth
  const oauthClient = await tryGetOAuthClient(oauthRefreshToken);
  if (oauthClient) {
    try {
      await oauthClient.events.delete({
        calendarId: "primary",
        eventId: googleEventId,
        sendUpdates: "all",
      });
      return true;
    } catch (err) {
      console.error("[Calendar] OAuth event delete failed, falling back:", err instanceof Error ? err.message : err);
    }
  }

  // Tier 2a: Impersonate
  try {
    const calendar = getServiceAccountClient(calendarId);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
    });
    return true;
  } catch {
    // Impersonation not available
  }

  // Tier 2b: Shared calendar
  try {
    const calendar = getServiceAccountClient();
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: googleEventId,
      sendUpdates: "all",
    });
    return true;
  } catch {
    // Shared calendar not available
  }

  // Tier 2c: Service account calendar
  try {
    const calendar = getServiceAccountClient();
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
    });
    return true;
  } catch {
    console.error("Failed to delete calendar event", googleEventId);
    return false;
  }
}

/**
 * Update a calendar event (for rescheduling).
 * Tier 1: OAuth, Tier 2: Service account 3-tier fallback.
 */
export async function updateCalendarEvent(params: {
  googleEventId: string;
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmail: string;
  timezone: string;
  oauthRefreshToken?: string;
}): Promise<string> {
  const eventBody = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.startTime,
      timeZone: params.timezone,
    },
    end: {
      dateTime: params.endTime,
      timeZone: params.timezone,
    },
    attendees: [{ email: params.attendeeEmail }],
    conferenceData: {
      createRequest: {
        requestId: `slotly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email" as const, minutes: 60 },
        { method: "popup" as const, minutes: 10 },
      ],
    },
  };

  // Tier 1: OAuth
  const oauthClient = await tryGetOAuthClient(params.oauthRefreshToken);
  if (oauthClient) {
    try {
      const res = await oauthClient.events.update({
        calendarId: "primary",
        eventId: params.googleEventId,
        requestBody: eventBody,
        sendUpdates: "all",
        conferenceDataVersion: 1,
      });
      return res.data.id!;
    } catch (err) {
      console.error("[Calendar] OAuth event update failed, falling back:", err instanceof Error ? err.message : err);
    }
  }

  // Tier 2a: Impersonate
  try {
    const calendar = getServiceAccountClient(params.calendarId);
    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: params.googleEventId,
      requestBody: eventBody,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });
    return res.data.id!;
  } catch {
    // Impersonation not available
  }

  // Tier 2b: Shared calendar
  try {
    const calendar = getServiceAccountClient();
    const res = await calendar.events.update({
      calendarId: params.calendarId,
      eventId: params.googleEventId,
      requestBody: eventBody,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });
    return res.data.id!;
  } catch {
    // Shared calendar not available
  }

  // Tier 2c: Service account calendar
  const calendar = getServiceAccountClient();
  const res = await calendar.events.update({
    calendarId: "primary",
    eventId: params.googleEventId,
    requestBody: {
      ...eventBody,
      attendees: [
        { email: params.calendarId },
        { email: params.attendeeEmail },
      ],
    },
    sendUpdates: "all",
    conferenceDataVersion: 1,
  });
  return res.data.id!;
}
