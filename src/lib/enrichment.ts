import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMeetingPrepEmail, sendAIUpdateEmail } from "@/lib/enrichment-email";
import type {
  EnrichmentInput,
  EmailAnalysis,
  PhoneAnalysis,
  BehaviorSignals,
  KeywordSignals,
} from "@/lib/types";

// ─── Constants ──────────────────────────────────────────

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "protonmail.com", "me.com", "live.com", "msn.com",
  "ymail.com", "mail.com", "zoho.com", "fastmail.com", "tutanota.com",
  "gmx.com", "gmx.net", "inbox.com", "att.net", "sbcglobal.net",
  "verizon.net", "comcast.net", "cox.net", "charter.net",
]);

const HIGH_VALUE_DOMAINS = new Set([
  "goldmansachs.com", "gs.com", "jpmorgan.com", "jpmorganchase.com",
  "morganstanley.com", "blackrock.com", "blackstone.com", "kkr.com",
  "carlyle.com", "apollo.com", "citadel.com", "bridgewater.com",
  "deshaw.com", "twosigma.com", "ares.com", "bain.com", "bcg.com",
  "mckinsey.com", "ubs.com", "credit-suisse.com", "barclays.com",
  "citi.com", "citigroup.com", "bofa.com", "bankofamerica.com",
  "wellsfargo.com", "fidelity.com", "schwab.com", "vanguard.com",
  "statestreet.com", "pimco.com", "wellington.com", "troweprice.com",
]);

// US area codes associated with high-income areas
const HIGH_WEALTH_AREA_CODES = new Set([
  "212", // Manhattan
  "646", // Manhattan
  "917", // NYC mobile
  "310", // Beverly Hills / Westside LA
  "424", // Beverly Hills overlay
  "415", // San Francisco
  "650", // Palo Alto / Peninsula
  "408", // Silicon Valley
  "203", // Fairfield County CT (Greenwich)
  "561", // Palm Beach FL
  "305", // Miami
  "786", // Miami overlay
  "617", // Boston
  "858", // La Jolla / San Diego
  "914", // Westchester NY
  "202", // Washington DC
  "312", // Chicago Loop
  "713", // Houston (energy wealth)
  "214", // Dallas
  "302", // Delaware (corporate)
]);

const MAJOR_METRO_AREA_CODES = new Set([
  "404", "770", // Atlanta
  "303", "720", // Denver
  "215", "267", // Philadelphia
  "480", "602", // Phoenix / Scottsdale
  "206", // Seattle
  "512", // Austin
  "919", "984", // Raleigh-Durham
  "704", // Charlotte
  "615", // Nashville
  "314", // St. Louis
  "503", // Portland
]);

// International country codes associated with wealth
const AFFLUENT_COUNTRY_CODES: Record<string, { geo: string; score: number }> = {
  "+971": { geo: "UAE", score: 12 },
  "+65": { geo: "Singapore", score: 12 },
  "+41": { geo: "Switzerland", score: 12 },
  "+852": { geo: "Hong Kong", score: 12 },
  "+377": { geo: "Monaco", score: 12 },
  "+44": { geo: "United Kingdom", score: 8 },
  "+61": { geo: "Australia", score: 8 },
  "+49": { geo: "Germany", score: 8 },
  "+33": { geo: "France", score: 8 },
  "+81": { geo: "Japan", score: 8 },
  "+82": { geo: "South Korea", score: 8 },
  "+972": { geo: "Israel", score: 8 },
};

// ── Keyword Signal Groups ──
// Philosophy: booking a call is already a strong positive. These signals
// help us UNDERSTAND the person, not judge them. Bias toward positive.
// Research basis: behavioral finance, sales psychology, Masterworks investor profiles.

// Capital signals — language suggesting they have investable assets
// Research: wealthy people use "deploy", "allocate", "optimize" vs "spend", "afford"
const CAPITAL_SIGNALS = [
  "accredit", "net worth", "capital", "liquidity", "wealth",
  "financial advisor", "my advisor", "tax", "estate", "trust",
  "private equity", "hedge fund", "family office", "ira",
  "retirement", "401k", "brokerage", "assets under",
  "qualified purchaser", "deploy", "due diligence", "track record",
  "risk-adjusted", "sharpe", "risk adjusted",
];

// Action signals — ANY intent to do something = positive
// Research: "What are the next steps?" and "What's the minimum?" correlate with 2x close rates
// Most people have never heard of art investing; if they're asking, they're engaged
const ACTION_SIGNALS = [
  "available", "offerings", "current works", "which artists",
  "minimum", "get started", "how does it work", "how do i",
  "interested", "learn more", "sign up", "next steps",
  "what can i", "what do you have", "tell me about",
  "how much", "pricing", "fees", "ready to", "want to",
  "looking to", "considering", "thinking about", "open to",
  "schedule", "discuss", "options", "opportunity",
  "walk me through", "show me", "explain how", "invest in",
  "when can i start", "how do i start", "how does this work",
];

// Diversifier signals — already has a portfolio, exploring alternatives
// Research: "my 60/40 isn't performing", "overweight in equities" = ideal Masterworks customer
// These people already understand investing; they're adding art as an asset class
const DIVERSIFIER_SIGNALS = [
  "diversif", "portfolio", "allocat", "alternative", "asset class",
  "stocks", "bonds", "real estate", "s&p", "market",
  "uncorrelat", "inflation", "hedge", "non-traditional",
  "rebalance", "overweight", "exposure", "correlation",
  "60/40", "endowment", "tangible asset", "asset allocation",
  "my investments", "current holdings", "beyond stocks",
];

// Long-term mindset — art is a 3-7yr hold; patience = great fit
// Research: comfort with illiquidity is the #1 predictor of alt-investment success
const LONG_TERM_SIGNALS = [
  "long term", "long-term", "hold", "patient", "wealth preservation",
  "legacy", "estate planning", "generational", "store of value",
  "buy and hold", "time horizon", "illiquid", "patient capital",
  "hold period", "3 year", "5 year", "7 year", "decade",
  "wealth transfer", "pass on", "next generation",
];

// Red flags — ONLY genuine disqualifiers, not curiosity or unfamiliarity
// Research: get-rich-quick mindset is structurally wrong for 3-7yr illiquid art
const RED_FLAGS = [
  // Not a real prospect
  "student", "school project", "homework", "class assignment", "research paper",
  // Scam/trust concerns (flag for approach, not disqualifying on its own)
  "is this a scam", "is this legit", "pyramid", "ponzi",
  // Wrong mindset for illiquid 3-7yr art holdings
  "quick money", "fast returns", "guaranteed return", "get rich",
  "day trade", "flip it", "quick profit", "make money fast",
  "when can i sell", "how fast can i sell", "short term gain",
  "double my money", "risk free", "no downside",
  "get my money back anytime", "need money back",
];

// ─── Signal Analysis Functions ──────────────────────────

export function analyzeEmail(email: string): EmailAnalysis {
  const [localPart, domain] = email.toLowerCase().split("@");
  const isPersonal = PERSONAL_EMAIL_DOMAINS.has(domain);
  let professionalScore = 0;
  let companyInference: string | null = null;

  // Personal email = individual investor (majority of actual HNW investors use personal Gmail)
  if (isPersonal) {
    professionalScore += 10;
  } else if (domain) {
    // Corporate email — could be professional investor or just researching
    professionalScore += 6;
    // Infer company name from domain (strip TLD)
    const parts = domain.split(".");
    if (parts.length >= 2) {
      companyInference = parts.slice(0, -1).join(".");
    }
  }

  // High-value finance domain bonus (corporate only — strong signal)
  if (HIGH_VALUE_DOMAINS.has(domain)) {
    professionalScore += 10;
  }

  // Handle pattern analysis — matters more for personal emails
  // (clean personal handle = real person investing for themselves)
  let handlePattern: EmailAnalysis["handle_pattern"] = "other";
  if (/^[a-z]+\.[a-z]+$/.test(localPart)) {
    handlePattern = "firstname.lastname";
    professionalScore += isPersonal ? 7 : 3;
  } else if (/^[a-z]+_[a-z]+$/.test(localPart)) {
    handlePattern = "firstname.lastname"; // underscore variant
    professionalScore += isPersonal ? 7 : 3;
  } else if (/^[a-z]{2,}$/.test(localPart) && localPart.length <= 15) {
    handlePattern = "firstname";
    professionalScore += isPersonal ? 5 : 2;
  } else if (/^[a-z]{1,3}\d*$/.test(localPart)) {
    handlePattern = "initials";
    professionalScore += 2;
  } else {
    handlePattern = "username";
  }

  return {
    domain,
    is_personal: isPersonal,
    company_inference: companyInference,
    handle_pattern: handlePattern,
    professional_score: Math.min(professionalScore, 30),
  };
}

export function analyzePhone(phone: string | null): PhoneAnalysis {
  if (!phone) {
    return {
      country_code: "unknown",
      area_code: null,
      geo_inference: null,
      wealth_indicator: "neutral",
      wealth_score: 0,
    };
  }

  const digits = phone.replace(/\D/g, "");

  // Check international affluent country codes
  for (const [code, info] of Object.entries(AFFLUENT_COUNTRY_CODES)) {
    const codeDigits = code.replace("+", "");
    if (phone.startsWith(code) || digits.startsWith(codeDigits)) {
      return {
        country_code: code,
        area_code: null,
        geo_inference: info.geo,
        wealth_indicator: info.score >= 10 ? "high" : "moderate",
        wealth_score: info.score,
      };
    }
  }

  // US/Canada (+1) area code analysis
  if (phone.startsWith("+1") || (digits.length === 10 || digits.length === 11)) {
    const areaCode = digits.length === 11 ? digits.slice(1, 4) : digits.slice(0, 3);

    if (HIGH_WEALTH_AREA_CODES.has(areaCode)) {
      const geoMap: Record<string, string> = {
        "212": "Manhattan, NY", "646": "Manhattan, NY", "917": "NYC",
        "310": "Beverly Hills, LA", "424": "Beverly Hills, LA",
        "415": "San Francisco", "650": "Palo Alto, CA", "408": "Silicon Valley",
        "203": "Fairfield County, CT", "561": "Palm Beach, FL",
        "305": "Miami, FL", "786": "Miami, FL",
        "617": "Boston, MA", "858": "La Jolla, CA", "914": "Westchester, NY",
        "202": "Washington, DC", "312": "Chicago, IL",
        "713": "Houston, TX", "214": "Dallas, TX", "302": "Delaware",
      };
      return {
        country_code: "+1",
        area_code: areaCode,
        geo_inference: geoMap[areaCode] || `US (${areaCode})`,
        wealth_indicator: "high",
        wealth_score: 12,
      };
    }

    if (MAJOR_METRO_AREA_CODES.has(areaCode)) {
      return {
        country_code: "+1",
        area_code: areaCode,
        geo_inference: `US Metro (${areaCode})`,
        wealth_indicator: "moderate",
        wealth_score: 8,
      };
    }

    return {
      country_code: "+1",
      area_code: areaCode,
      geo_inference: `US (${areaCode})`,
      wealth_indicator: "neutral",
      wealth_score: 5,
    };
  }

  return {
    country_code: phone.startsWith("+") ? phone.split(/\d/)[0] + phone.match(/\d+/)?.[0] : "unknown",
    area_code: null,
    geo_inference: null,
    wealth_indicator: "neutral",
    wealth_score: 5,
  };
}

export async function analyzeBehavior(
  inviteeEmail: string,
  startTime: string,
  timezone: string,
): Promise<BehaviorSignals> {
  let behaviorScore = 0;

  // Check repeat booker status
  const { count } = await supabaseAdmin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("invitee_email", inviteeEmail.toLowerCase())
    .in("status", ["confirmed", "completed"]);

  const priorCount = count ?? 0;
  const isRepeat = priorCount > 0;
  if (isRepeat) behaviorScore += 8;

  // Booking time analysis
  const now = new Date();
  const meetingDate = new Date(startTime);
  const leadTimeHours = Math.max(0, (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60));

  // Lead time: 1-7 days ahead = organized, >14 days = very planned
  if (leadTimeHours >= 24 && leadTimeHours <= 168) behaviorScore += 5;
  else if (leadTimeHours > 336) behaviorScore += 5;

  // Booking hour in local timezone
  let localHour = now.getUTCHours();
  try {
    const localTime = now.toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    localHour = parseInt(localTime) || localHour;
  } catch { /* fallback to UTC */ }

  // Business hours booking = professional behavior
  const dayOfWeek = now.getDay();
  if (localHour >= 9 && localHour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    behaviorScore += 3;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    booking_hour_local: localHour,
    booking_day: dayNames[dayOfWeek],
    lead_time_hours: Math.round(leadTimeHours),
    is_repeat_booker: isRepeat,
    prior_bookings_count: priorCount,
    behavior_score: Math.min(behaviorScore, 16),
  };
}

export function analyzeKeywords(
  notes: string | null,
  customAnswers?: Record<string, any> | null,
): KeywordSignals {
  const empty: KeywordSignals = {
    capital_signals: [], action_signals: [], diversifier_signals: [],
    long_term_signals: [], red_flags: [], keyword_score: 0,
  };

  // Combine notes + custom form answers into one text blob
  const parts: string[] = [];
  if (notes?.trim()) parts.push(notes);
  if (customAnswers) {
    for (const val of Object.values(customAnswers)) {
      if (typeof val === "string" && val.trim()) parts.push(val);
    }
  }
  if (parts.length === 0) return empty;

  const text = parts.join(" ").toLowerCase();
  let score = 0;

  // Research: specificity in notes predicts quality
  // Detailed notes = engaged prospect who's thought about this
  if (text.length > 80) score += 3;

  const capital = CAPITAL_SIGNALS.filter((kw) => text.includes(kw));
  score += Math.min(capital.length * 4, 12); // strong: they have money

  const action = ACTION_SIGNALS.filter((kw) => text.includes(kw));
  score += Math.min(action.length * 3, 9); // positive: intent to act

  const diversifier = DIVERSIFIER_SIGNALS.filter((kw) => text.includes(kw));
  score += Math.min(diversifier.length * 4, 8); // ideal customer

  const longTerm = LONG_TERM_SIGNALS.filter((kw) => text.includes(kw));
  score += Math.min(longTerm.length * 3, 6); // great fit for art

  const flags = RED_FLAGS.filter((kw) => text.includes(kw));
  score -= flags.length * 4; // only genuine disqualifiers

  return {
    capital_signals: capital,
    action_signals: action,
    diversifier_signals: diversifier,
    long_term_signals: longTerm,
    red_flags: flags,
    keyword_score: Math.max(score, -10),
  };
}

// ─── Claude AI Synthesis ────────────────────────────────

// Meeting type descriptions for Claude context
const MEETING_TYPE_CONTEXT: Record<string, string> = {
  initial_consultation: "First-time prospect. Discovery call. Focus on: what's their portfolio, capital signals, what brought them here.",
  portfolio_review: "EXISTING INVESTOR. They own art through Masterworks. Focus on: satisfaction, upsell, new offerings. Don't explain basics.",
  follow_up: "Had a prior call, didn't invest yet. Rebooking = very strong signal. Focus on: what changed, what held them back.",
  missed_follow_up: "No-showed first call but rebooked. Still interested. Be empathetic. Slightly higher no-show risk.",
  event_follow_up: "Attended a Masterworks event. Have brand context. Reference event themes.",
};

const SYSTEM_PROMPT = `You are a meeting prep analyst for Masterworks, a platform for fractional art investing ($10k minimum, accredited investors, 3-7 year hold periods).

A potential investor has booked a meeting. The act of scheduling a call is ALREADY a strong positive signal — they took action. Your job is to help the salesperson UNDERSTAND this person and have a great conversation, not to judge or disqualify them.

IMPORTANT: You have access to a web_search tool. USE IT to research the person before writing your analysis. Search for their name combined with their company/email domain to find LinkedIn profiles, professional background, and any public info. This is critical — your analysis should combine what the person wrote on the form WITH what you find online about them.

Search strategy:
1. If corporate email: search for "{name}" "{company/email domain}"
2. If personal email with location data: search for "{name}" "{city}" plus any context clues from their notes
3. Try to find their LinkedIn profile, current role, and company
4. Assess your confidence in the match: "high" (LinkedIn confirmed), "medium" (likely match from professional results), "low" (uncertain/common name), "none" (nothing found)

After searching, respond ONLY with valid JSON in this exact format:
{
  "qualification_score": <number 0-100>,
  "summary": "<2-3 sentences about who this person likely is — their situation, what brought them here, what they might care about>",
  "talking_points": ["<conversation starter or angle 1>", "<point 2>", "<point 3>"],
  "risk_flags": ["<only genuine concerns, if any — leave empty array if none>"],
  "recommended_approach": "<one of: direct, consultative, educational, cautious>",
  "person_profile": "<what you found about them online — title, company, background. null if nothing found>",
  "person_confidence": "<high, medium, low, or none>",
  "search_queries_used": ["<query 1>", "<query 2 if used>"],
  "linkedin_url": "<LinkedIn URL if found, null otherwise>"
}

CRITICAL CONTEXT — what we know about real Masterworks investors:

1. PERSONAL EMAIL IS POSITIVE. The majority of actual HNW investors use personal Gmail because they are investing for themselves. A personal email with a high-wealth area code is a strong lead.

2. MOST INVESTORS WERE NEW TO ART INVESTING. They had never heard you could invest in art. Unfamiliarity is completely normal — "how does this work?" and "what's available?" are BUYING SIGNALS, not ignorance. Any action-oriented language is positive.

3. ART FANS ≠ ART INVESTORS (important for approach). Research shows:
   - Art FAN language: "beautiful", "culture", "love art", "support artists", "gallery", "creative process" → they have high cultural capital but often lack investable capital. Don't score them down, but recommend "educational" approach that frames art as a financial asset, not an aesthetic one.
   - Art INVESTOR language: "returns", "portfolio", "allocation", "asset class", "uncorrelated", "diversify" → they view art as a financial instrument. Masterworks CEO: "Our investors are really not art-world people. They're looking for returns."
   - The best leads use BOTH: they appreciate art AND understand asset allocation.

4. LONG-TERM MINDSET = GREAT FIT. Art is illiquid, 3-7 year holds. Research shows comfort with illiquidity is the #1 predictor of success in alternative investments.
   - Good: "long term", "patient", "wealth preservation", "estate planning", "time horizon"
   - Bad: "quick money", "fast returns", "guaranteed", "flip it", "when can I sell"

5. CAPITAL SIGNALS MATTER MOST. Wealthy people say "deploy", "allocate", "optimize" — not "spend" or "afford". Words like "accredited", "financial advisor", "trust", "estate", "net worth", "due diligence", "risk-adjusted" suggest real investable capital.

6. DIVERSIFIERS ARE THE BEST LEADS. Someone who already has stocks/bonds/real estate and mentions wanting to diversify or find alternatives is the ideal Masterworks customer. "My 60/40 isn't performing" or "overweight in equities" = ideal.

7. SOPHISTICATION MARKERS. Expert investors ask about downside before upside, use abstract/relational vocabulary ("correlation", "risk-adjusted returns" vs "is it safe?"), and think in portfolio context. These signals indicate someone who will invest larger amounts with more confidence.

Scoring baseline: Start at 55 (they booked a call — already above average). Add for positive signals, subtract only for genuine red flags.
- 75-100: Ready to invest. Capital signals + action intent + diversification language.
- 60-74: Strong prospect. Good signals, personalize the conversation.
- 45-59: Standard lead. Needs discovery — find out their situation during the call.
- 30-44: Early stage. May need education on the asset class first.
- Below 30: Only for genuine red flags (student, scam concern, get-rich-quick mindset).

Approach guide:
- "direct": Capital + diversification signals. Jump to available offerings, minimums, process. Ask "how much are you looking to allocate?"
- "consultative": Good signals but needs discovery. Ask about current portfolio, goals, what prompted their interest.
- "educational": New to art investing (most people are!) or art fan. Start with "how Masterworks works" and frame art as a financial asset class. Then qualify.
- "cautious": Genuine red flags present. Be friendly but qualify budget/intent early.

MEETING TYPE CONTEXT (adjust your analysis based on which type this is):
- "initial_consultation": First-time prospect. Discovery call. Focus on: what's their portfolio, capital signals, what brought them here.
- "portfolio_review": EXISTING INVESTOR. They own art through Masterworks. Focus on: satisfaction, upsell, new offerings. Don't explain basics.
- "follow_up": Had a prior call, didn't invest yet. Rebooking = very strong signal. Focus on: what changed, what held them back.
- "missed_follow_up": No-showed first call but rebooked. Still interested. Be empathetic. Slightly higher no-show risk.
- "event_follow_up": Attended a Masterworks event. Have brand context. Reference event themes.

Your goal is to make the salesperson feel PREPARED, not to gatekeep. Help them connect with this person. Give specific, actionable talking points based on what you know about them — ESPECIALLY from what you found online.`;

export interface WebSearchResult {
  person_profile: string | null;
  person_confidence: "high" | "medium" | "low" | "none";
  search_queries_used: string[];
  linkedin_url: string | null;
}

export interface ClaudeResult {
  qualification_score: number;
  summary: string;
  talking_points: string[];
  risk_flags: string[];
  recommended_approach: string;
  person_profile: string | null;
  person_confidence: "high" | "medium" | "low" | "none";
  web_search_result: WebSearchResult | null;
  model: string;
  tokens_used: number;
}

async function synthesizeWithClaude(
  input: EnrichmentInput,
  emailAnalysis: EmailAnalysis,
  phoneAnalysis: PhoneAnalysis,
  behaviorSignals: BehaviorSignals,
  keywordSignals: KeywordSignals,
  tier1Score: number,
  useWebSearch: boolean,
): Promise<ClaudeResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[Enrichment] ANTHROPIC_API_KEY not set, skipping Claude synthesis");
    return null;
  }

  const timeout = useWebSearch ? 25_000 : 8_000;
  const client = new Anthropic({ apiKey, timeout });

  const allPositiveSignals = [
    ...keywordSignals.capital_signals.map((s) => `[capital] ${s}`),
    ...keywordSignals.action_signals.map((s) => `[action] ${s}`),
    ...keywordSignals.diversifier_signals.map((s) => `[diversifier] ${s}`),
    ...keywordSignals.long_term_signals.map((s) => `[long-term] ${s}`),
  ];

  // Meeting type context
  const meetingTypeDesc = input.meetingType && MEETING_TYPE_CONTEXT[input.meetingType]
    ? `${input.meetingType} (${MEETING_TYPE_CONTEXT[input.meetingType]})`
    : "initial_consultation (First-time prospect — discovery call)";

  const searchInstructions = useWebSearch
    ? `\n\nIMPORTANT: Use web_search to research this person BEFORE writing your JSON response. Search for their name + company/domain to find their LinkedIn, role, and background. This info is critical for the salesperson.`
    : `\n\nNOTE: Web search is not available for this request. Base your analysis on the signal data and form answers provided. Set person_profile to null and person_confidence to "none".`;

  const userMessage = `Meeting booked for: ${input.eventTitle}
Meeting type: ${meetingTypeDesc}
Scheduled: ${input.startTime}
Lead time: ${behaviorSignals.lead_time_hours} hours from now

PERSON${useWebSearch ? " (search for them online before writing your analysis)" : ""}:
Name: ${input.inviteeName}
Email: ${input.inviteeEmail}
Phone: ${input.inviteePhone || "Not provided"}

WHAT WE KNOW FROM SIGNALS:
- Email: ${emailAnalysis.domain} (${emailAnalysis.is_personal ? "personal — investing for themselves" : "corporate"})${emailAnalysis.company_inference ? `, likely company: ${emailAnalysis.company_inference}` : ""}
- Email handle: ${emailAnalysis.handle_pattern}
- Location signal: ${phoneAnalysis.geo_inference || "unknown"} (${phoneAnalysis.wealth_indicator} wealth area)${phoneAnalysis.area_code ? `, area code ${phoneAnalysis.area_code}` : ""}
- Booking behavior: ${behaviorSignals.booking_hour_local}:00 on ${behaviorSignals.booking_day}, ${behaviorSignals.lead_time_hours}h lead time
- History: ${behaviorSignals.is_repeat_booker ? `Repeat booker (${behaviorSignals.prior_bookings_count} prior)` : "First booking"}
${allPositiveSignals.length > 0 ? `- Positive signals in notes: ${allPositiveSignals.join(", ")}` : "- No specific keyword signals (that's fine — most investors don't write essays)"}
${keywordSignals.red_flags.length > 0 ? `- Red flags: ${keywordSignals.red_flags.join(", ")}` : ""}

THEIR NOTES/TOPIC: ${input.inviteeNotes || "None provided"}
${input.customAnswers ? `\nFORM ANSWERS: ${JSON.stringify(input.customAnswers)}` : ""}

SIGNAL SCORE: ${tier1Score}/100${searchInstructions}`;

  try {
    const model = useWebSearch ? "claude-sonnet-4-5-20250514" : "claude-haiku-4-5-20241022";

    // Build tools array only when web search is enabled
    const tools = useWebSearch
      ? [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 3 }]
      : undefined;

    const response = await client.messages.create({
      model,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      ...(tools ? { tools: tools as any } : {}),
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Enrichment] Claude response was not valid JSON:", text.slice(0, 200));
      return {
        qualification_score: tier1Score,
        summary: text.slice(0, 500),
        talking_points: [],
        risk_flags: ["AI response parsing failed — using signal score only"],
        recommended_approach: "consultative",
        person_profile: null,
        person_confidence: "none",
        web_search_result: null,
        model,
        tokens_used: tokensUsed,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build web search result object
    const webSearchResult: WebSearchResult | null = parsed.person_profile || parsed.linkedin_url
      ? {
          person_profile: parsed.person_profile || null,
          person_confidence: (["high", "medium", "low", "none"].includes(parsed.person_confidence) ? parsed.person_confidence : "none") as WebSearchResult["person_confidence"],
          search_queries_used: Array.isArray(parsed.search_queries_used) ? parsed.search_queries_used : [],
          linkedin_url: parsed.linkedin_url || null,
        }
      : null;

    return {
      qualification_score: Math.min(100, Math.max(0, parsed.qualification_score || 0)),
      summary: parsed.summary || "",
      talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points : [],
      risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
      recommended_approach: parsed.recommended_approach || "consultative",
      person_profile: parsed.person_profile || null,
      person_confidence: (["high", "medium", "low", "none"].includes(parsed.person_confidence) ? parsed.person_confidence : "none") as ClaudeResult["person_confidence"],
      web_search_result: webSearchResult,
      model,
      tokens_used: tokensUsed,
    };
  } catch (err) {
    console.error("[Enrichment] Claude API call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Pipeline Orchestrator ──────────────────────────────

// 2-email architecture:
// Email 1 (signal-only): Sent within ~2s — guaranteed delivery with signal analysis
// Email 2 (AI update): Sent after Claude completes — talking points, person intel, approach
//
// Time budget: after() runs within the same Netlify function timeout.
// Booking handler uses ~2-3s, so the pipeline has the remaining time.
// Free tier (10s total): ~7s for pipeline → signal email + Haiku (no web search)
// Pro tier (26s total): ~23s for pipeline → signal email + Sonnet (with web search)

export async function runEnrichmentPipeline(
  input: EnrichmentInput,
  functionStartedAt?: number,
): Promise<void> {
  const pipelineStart = Date.now();
  // Calculate real remaining time from when the HTTP request started
  const requestAge = functionStartedAt ? pipelineStart - functionStartedAt : 3000;
  // Conservative: assume 10s total timeout, 1s buffer for cleanup
  const totalBudgetMs = 9000;
  const remainingFromRequest = Math.max(0, totalBudgetMs - requestAge);

  console.log(`[Enrichment] Pipeline start — requestAge=${requestAge}ms, remaining=${remainingFromRequest}ms`);

  // Upsert enrichment row
  const { data: enrichment, error: upsertErr } = await supabaseAdmin
    .from("booking_enrichments")
    .upsert(
      { booking_id: input.bookingId, enrichment_status: "processing" },
      { onConflict: "booking_id" },
    )
    .select("id")
    .single();

  if (upsertErr || !enrichment) {
    console.error("[Enrichment] Failed to upsert enrichment row:", upsertErr?.message);
    return;
  }
  const enrichmentId = enrichment.id;

  try {
    // ── Step 1: Signal analysis (parallel, free, ~200ms) ──
    const [emailAnalysis, phoneAnalysis, behaviorSignals, keywordSignals] = await Promise.all([
      Promise.resolve(analyzeEmail(input.inviteeEmail)),
      Promise.resolve(analyzePhone(input.inviteePhone)),
      analyzeBehavior(input.inviteeEmail, input.startTime, input.timezone),
      Promise.resolve(analyzeKeywords(input.inviteeNotes, input.customAnswers)),
    ]);

    // Compute tier 1 score
    const BASELINE = 45;
    const signalBoost =
      emailAnalysis.professional_score +
      phoneAnalysis.wealth_score +
      behaviorSignals.behavior_score +
      keywordSignals.keyword_score;
    const scaledBoost = Math.round((Math.max(0, signalBoost) / 96) * 45);
    const penalty = signalBoost < 0 ? Math.abs(signalBoost) * 3 : 0;
    const tier1Score = Math.min(100, Math.max(10, BASELINE + scaledBoost - penalty));

    // ── Step 2: Save signals + send Email 1 (signal-only prep) ──
    await supabaseAdmin
      .from("booking_enrichments")
      .update({
        email_analysis: emailAnalysis,
        phone_analysis: phoneAnalysis,
        behavior_signals: behaviorSignals,
        keyword_signals: keywordSignals,
        tier1_score: tier1Score,
        enrichment_status: "signals_complete",
      })
      .eq("id", enrichmentId);

    try {
      await sendMeetingPrepEmail({
        input,
        emailAnalysis,
        phoneAnalysis,
        behaviorSignals,
        keywordSignals,
        tier1Score,
        claudeResult: null,
      });
      await supabaseAdmin
        .from("booking_enrichments")
        .update({ prep_email_sent_at: new Date().toISOString() })
        .eq("id", enrichmentId);
      console.log(`[Enrichment] Email 1 (signals) sent — tier1=${tier1Score}, ${Date.now() - pipelineStart}ms`);
    } catch (emailErr) {
      console.error("[Enrichment] Email 1 failed:", emailErr instanceof Error ? emailErr.message : emailErr);
    }

    // ── Step 3: Claude AI synthesis + Email 2 (AI update) ──
    const elapsedSinceRequest = functionStartedAt ? Date.now() - functionStartedAt : Date.now() - pipelineStart + 3000;
    const remainingForClaude = Math.max(0, totalBudgetMs - elapsedSinceRequest - 1500); // 1.5s buffer for email + save
    // Use web_search only if 15+ seconds remain (Pro tier)
    const useWebSearch = remainingForClaude > 15000;
    let claudeResult: ClaudeResult | null = null;
    let totalCostCents = 0;

    if (remainingForClaude > 3000) {
      console.log(`[Enrichment] Claude call — ${remainingForClaude}ms budget, web_search=${useWebSearch}`);
      claudeResult = await synthesizeWithClaude(
        input, emailAnalysis, phoneAnalysis, behaviorSignals, keywordSignals, tier1Score, useWebSearch,
      );
      if (claudeResult) {
        totalCostCents = Math.max(1, Math.round((claudeResult.tokens_used / 1000) * 1.5));
      }
    } else {
      console.warn(`[Enrichment] Skipping Claude — only ${remainingForClaude}ms remaining`);
    }

    // Send Email 2 (AI update) if Claude produced results
    if (claudeResult && (claudeResult.summary || claudeResult.talking_points?.length)) {
      try {
        await sendAIUpdateEmail({ input, tier1Score, claudeResult });
        console.log(`[Enrichment] Email 2 (AI) sent — score=${claudeResult.qualification_score}, ${Date.now() - pipelineStart}ms`);
      } catch (emailErr) {
        console.error("[Enrichment] Email 2 failed:", emailErr instanceof Error ? emailErr.message : emailErr);
      }
    }

    // Save final results
    await supabaseAdmin
      .from("booking_enrichments")
      .update({
        ai_summary: claudeResult?.summary || null,
        ai_qualification_score: claudeResult?.qualification_score || null,
        ai_talking_points: claudeResult?.talking_points || null,
        ai_risk_flags: claudeResult?.risk_flags || null,
        ai_recommended_approach: claudeResult?.recommended_approach || null,
        ai_model: claudeResult?.model || null,
        ai_tokens_used: claudeResult?.tokens_used || null,
        web_search_result: claudeResult?.web_search_result || null,
        person_confidence: claudeResult?.person_confidence || null,
        enrichment_status: "completed",
        total_cost_cents: totalCostCents,
        completed_at: new Date().toISOString(),
      })
      .eq("id", enrichmentId);

    console.log(
      `[Enrichment] Done — booking=${input.bookingId}, tier1=${tier1Score}, ` +
      `ai=${claudeResult?.qualification_score ?? "skipped"}, ` +
      `web_search=${useWebSearch}, cost=${totalCostCents}¢, ${Date.now() - pipelineStart}ms total`
    );
  } catch (err) {
    await supabaseAdmin
      .from("booking_enrichments")
      .update({
        enrichment_status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", enrichmentId);

    console.error("[Enrichment] Pipeline failed for booking", input.bookingId, ":", err);
  }
}
