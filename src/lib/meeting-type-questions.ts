// ─── Meeting Type Question Configuration ────────────────
// Each meeting type gets its own set of topic chips and notes starters.
// These feed into the enrichment pipeline for keyword analysis.

export type MeetingType =
  | "initial_consultation"
  | "portfolio_review"
  | "follow_up"
  | "missed_follow_up"
  | "event_follow_up";

export interface MeetingTypeQuestionSet {
  label: string;
  description: string;
  topicLabel: string;
  topicChips: string[];
  notesLabel: string;
  notesStarters: string[];
}

export const MEETING_TYPE_CONFIG: Record<MeetingType, MeetingTypeQuestionSet> = {
  // First-time prospects. Booking = strong signal. Questions help us
  // understand: art fan or art investor? Capital? Portfolio context?
  initial_consultation: {
    label: "Initial Consultation",
    description: "First-time meeting with a new prospect",
    topicLabel: "What brings you here?",
    topicChips: [
      "Diversify my portfolio",
      "Learn about art investing",
      "See current offerings",
      "Explore alternatives to stocks",
      "Referred by someone",
      "Just curious",
    ],
    notesLabel: "Anything you'd like us to know?",
    notesStarters: [
      "I currently invest in stocks and bonds",
      "Looking for long-term investments",
      "My financial advisor suggested alternatives",
      "I have questions about the minimum",
      "Interested in how returns work",
    ],
  },

  // Existing investors reviewing their holdings. They already own shares.
  // Questions surface: satisfaction, upsell appetite, specific concerns.
  portfolio_review: {
    label: "Portfolio Review",
    description: "Existing investor reviewing their art holdings",
    topicLabel: "What would you like to focus on?",
    topicChips: [
      "Review my current holdings",
      "Learn about new offerings",
      "Discuss my allocation strategy",
      "Questions about a specific painting",
      "Consider adding to my position",
      "Understand recent performance",
    ],
    notesLabel: "Any specifics for this review?",
    notesStarters: [
      "I'd like to increase my art allocation",
      "Curious about secondary market activity",
      "Want to understand my portfolio's timeline",
      "Interested in a different price range",
      "My advisor wants to discuss my alternatives allocation",
    ],
  },

  // Had an initial call but haven't invested yet. Rebooking = extremely positive.
  // Questions uncover: what held them back, what's changed, what moves them forward.
  follow_up: {
    label: "Follow-Up Consultation",
    description: "Returning prospect who had a prior consultation",
    topicLabel: "What prompted you to reconnect?",
    topicChips: [
      "Ready to get started",
      "Have more questions",
      "Discussed with my advisor",
      "Saw something interesting",
      "Situation has changed",
      "Want to revisit options",
    ],
    notesLabel: "Anything new since we last spoke?",
    notesStarters: [
      "I've done more research since our last call",
      "My advisor is on board and I'd like next steps",
      "I have a specific budget in mind now",
      "I'd like to compare current vs. previous offerings",
      "Ready to move forward, need to understand the process",
    ],
  },

  // No-showed or cancelled first call but rebooked. Still interested.
  // Questions are empathetic — no guilt, re-establish intent, reduce friction.
  missed_follow_up: {
    label: "Missed Initial - Follow Up",
    description: "Rescheduled after missing their first consultation",
    topicLabel: "What brings you back?",
    topicChips: [
      "Still interested in art investing",
      "Schedule got in the way last time",
      "Ready to have the conversation now",
      "Have specific questions this time",
      "Want a quick overview",
      "Referred by someone new",
    ],
    notesLabel: "Anything you'd like us to know?",
    notesStarters: [
      "Apologies for missing last time, still very interested",
      "I've been doing my own research in the meantime",
      "Would prefer a shorter, focused conversation",
      "Main question is about minimums and process",
      "Best time for me is mornings",
    ],
  },

  // Attended a Masterworks event (webinar, art fair, dinner, etc.).
  // Questions reference the event, gauge what resonated, surface readiness.
  event_follow_up: {
    label: "Event Follow-Up",
    description: "Follow-up after attending a Masterworks event",
    topicLabel: "What caught your attention at the event?",
    topicChips: [
      "Interested in what was presented",
      "Want to learn more about a specific artist",
      "Curious about the investment process",
      "Spoke with someone at the event",
      "Want to see current offerings",
      "Ready to take next steps",
    ],
    notesLabel: "Anything specific from the event you'd like to discuss?",
    notesStarters: [
      "The returns data was compelling, want to dig deeper",
      "I'm interested in the specific piece that was discussed",
      "Want to understand how this fits my portfolio",
      "My partner/advisor also attended and we'd like to discuss",
      "Interested in attending more events while I learn",
    ],
  },
};

// Admin dropdown options (ordered)
export const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: "initial_consultation", label: "Initial Consultation" },
  { value: "portfolio_review", label: "Portfolio Review" },
  { value: "follow_up", label: "Follow-Up Consultation" },
  { value: "missed_follow_up", label: "Missed Initial - Follow Up" },
  { value: "event_follow_up", label: "Event Follow-Up" },
];

/**
 * Get topic chips and notes starters for a given meeting type.
 * Falls back to initial_consultation if meeting_type is null/unknown.
 */
export function getQuestionsForMeetingType(meetingType?: string | null): {
  topicChips: string[];
  notesStarters: string[];
  topicLabel: string;
  notesLabel: string;
} {
  if (meetingType && meetingType in MEETING_TYPE_CONFIG) {
    const config = MEETING_TYPE_CONFIG[meetingType as MeetingType];
    return {
      topicChips: config.topicChips,
      notesStarters: config.notesStarters,
      topicLabel: config.topicLabel,
      notesLabel: config.notesLabel,
    };
  }
  // Default to initial consultation
  const fallback = MEETING_TYPE_CONFIG.initial_consultation;
  return {
    topicChips: fallback.topicChips,
    notesStarters: fallback.notesStarters,
    topicLabel: fallback.topicLabel,
    notesLabel: fallback.notesLabel,
  };
}
