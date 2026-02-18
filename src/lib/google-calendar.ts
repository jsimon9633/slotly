import { google, calendar_v3 } from "googleapis";

/**
 * Create authenticated Google Calendar client using service account.
 * If `impersonateEmail` is provided, the service account will act as that user
 * (requires domain-wide delegation in Google Workspace Admin).
 */
function getCalendarClient(impersonateEmail?: string): calendar_v3.Calendar {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonateEmail, // impersonate the team member
  });

  return google.calendar({ version: "v3", auth });
}

/**
 * Get free/busy information for a team member's calendar
 */
export async function getFreeBusy(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const calendar = getCalendarClient();

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
 * Tries impersonation first (Workspace with domain-wide delegation),
 * falls back to direct calendar insert (shared calendar),
 * falls back to service account calendar with attendee invites.
 */
export interface CalendarEventResult {
  eventId: string;
  meetLink?: string;
  meetPhone?: string; // dial-in number
  meetPin?: string;   // PIN for phone dial-in
}

export async function createCalendarEvent(params: {
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmail: string;
  timezone: string;
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

  // Attempt 1: Impersonate the team member (works with Workspace + domain-wide delegation)
  try {
    const calendar = getCalendarClient(params.calendarId);
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });
    return extractMeetDetails(res.data);
  } catch (err: any) {
    // Impersonation not available, trying shared calendar
  }

  // Attempt 2: Insert directly into the shared calendar
  try {
    const calendar = getCalendarClient();
    const res = await calendar.events.insert({
      calendarId: params.calendarId,
      requestBody: eventBody,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });
    return extractMeetDetails(res.data);
  } catch (err: any) {
    // Shared calendar not available, trying service account fallback
  }

  // Attempt 3: Create on service account's calendar, invite everyone
  const calendar = getCalendarClient();
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
 * Tries same 3-tier fallback: impersonation → shared calendar → service account.
 */
export async function deleteCalendarEvent(
  googleEventId: string,
  calendarId: string
): Promise<boolean> {
  // Attempt 1: Impersonate the team member
  try {
    const calendar = getCalendarClient(calendarId);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
    });
    return true;
  } catch {
    // Impersonation not available
  }

  // Attempt 2: Shared calendar
  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: googleEventId,
      sendUpdates: "all",
    });
    return true;
  } catch {
    // Shared calendar not available
  }

  // Attempt 3: Service account calendar
  try {
    const calendar = getCalendarClient();
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
 * Tries same 3-tier fallback: impersonation → shared calendar → service account.
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

  // Attempt 1: Impersonate
  try {
    const calendar = getCalendarClient(params.calendarId);
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

  // Attempt 2: Shared calendar
  try {
    const calendar = getCalendarClient();
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

  // Attempt 3: Service account calendar
  const calendar = getCalendarClient();
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
