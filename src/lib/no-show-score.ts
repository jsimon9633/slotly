/**
 * No-Show Risk Scoring — weighted heuristic model (v1).
 *
 * Scores each booking 0–100 based on observable risk factors.
 * Higher score = higher risk of no-show.
 *
 * Weights are hand-tuned starting points. Once we have enough outcome data
 * (200+ bookings with outcomes), these should be replaced with a logistic
 * regression trained on actual no-show rates.
 */

export interface NoShowFactors {
  /** Minutes between booking creation and the meeting start */
  leadTimeMinutes: number;
  /** 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat */
  dayOfWeek: number;
  /** Hour of meeting start in local timezone (0–23) */
  hourOfDay: number;
  /** Whether this email has booked before */
  isRepeatBooker: boolean;
  /** Whether the booker filled in a meeting topic */
  hasTopicFilled: boolean;
  /** Whether the booker added notes */
  hasNotes: boolean;
}

// ── Weight constants (tune over time) ──

const WEIGHTS = {
  // Lead time: very short notice = high risk
  LEAD_TIME_UNDER_2H: 30,
  LEAD_TIME_UNDER_6H: 20,
  LEAD_TIME_UNDER_24H: 10,
  LEAD_TIME_OVER_7D: 8,

  // Day of week
  FRIDAY_AFTERNOON: 15,
  MONDAY_MORNING: 5,

  // Time of day
  EARLY_MORNING: 10, // before 8am
  LATE_AFTERNOON: 8, // after 4pm

  // Engagement signals (negative = reduces risk)
  NO_TOPIC: 12,
  NO_NOTES: 5,
  REPEAT_BOOKER: -15,
};

export function calculateNoShowScore(factors: NoShowFactors): number {
  let score = 20; // baseline risk

  // ── Lead time ──
  const leadHours = factors.leadTimeMinutes / 60;
  if (leadHours < 2) {
    score += WEIGHTS.LEAD_TIME_UNDER_2H;
  } else if (leadHours < 6) {
    score += WEIGHTS.LEAD_TIME_UNDER_6H;
  } else if (leadHours < 24) {
    score += WEIGHTS.LEAD_TIME_UNDER_24H;
  } else if (leadHours > 168) {
    // >7 days — distance makes it easy to forget
    score += WEIGHTS.LEAD_TIME_OVER_7D;
  }

  // ── Day of week + time combos ──
  if (factors.dayOfWeek === 5 && factors.hourOfDay >= 14) {
    score += WEIGHTS.FRIDAY_AFTERNOON;
  }
  if (factors.dayOfWeek === 1 && factors.hourOfDay < 10) {
    score += WEIGHTS.MONDAY_MORNING;
  }

  // ── Time of day ──
  if (factors.hourOfDay < 8) {
    score += WEIGHTS.EARLY_MORNING;
  } else if (factors.hourOfDay >= 16) {
    score += WEIGHTS.LATE_AFTERNOON;
  }

  // ── Engagement signals ──
  if (!factors.hasTopicFilled) {
    score += WEIGHTS.NO_TOPIC;
  }
  if (!factors.hasNotes) {
    score += WEIGHTS.NO_NOTES;
  }
  if (factors.isRepeatBooker) {
    score += WEIGHTS.REPEAT_BOOKER;
  }

  // Clamp 0–100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Risk tier thresholds — used to decide actions.
 * HIGH_RISK triggers 2-hour reminder email.
 */
export const RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 50,
  HIGH: 65,
} as const;

export type RiskTier = "low" | "medium" | "high";

export function getRiskTier(score: number): RiskTier {
  if (score >= RISK_THRESHOLDS.HIGH) return "high";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}
