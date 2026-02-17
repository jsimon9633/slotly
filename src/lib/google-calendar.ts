import { google, calendar_v3 } from "googleapis";

// Create authenticated Google Calendar client using service account
function getCalendarClient(): calendar_v3.Calendar {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
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
 * Create a calendar event for a booking
 */
export async function createCalendarEvent(params: {
  calendarId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmail: string;
  timezone: string;
}): Promise<string> {
  const calendar = getCalendarClient();

  const res = await calendar.events.insert({
    calendarId: params.calendarId,
    requestBody: {
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
      attendees: [
        { email: params.calendarId }, // the team member
        { email: params.attendeeEmail }, // the invitee
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 10 },
        ],
      },
    },
    sendUpdates: "all", // Send invites to attendees
  });

  return res.data.id!;
}
