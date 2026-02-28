import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMeetingPrepEmail } from "@/lib/enrichment-email";
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

const INVESTMENT_KEYWORDS = [
  "invest", "portfolio", "diversif", "allocat", "accredit",
  "net worth", "capital", "wealth", "financial advisor", "tax",
  "estate", "trust", "hedge", "private equity", "alternative",
  "asset", "roi", "returns", "yield", "equity",
];

const NEGATIVE_KEYWORDS = [
  "free", "student", "school project", "just curious", "homework",
  "class assignment", "research paper",
];

// ─── Signal Analysis Functions ──────────────────────────

export function analyzeEmail(email: string): EmailAnalysis {
  const [localPart, domain] = email.toLowerCase().split("@");
  const isPersonal = PERSONAL_EMAIL_DOMAINS.has(domain);
  let professionalScore = 0;
  let companyInference: string | null = null;

  // Corporate email bonus
  if (!isPersonal && domain) {
    professionalScore += 15;
    // Infer company name from domain (strip TLD)
    const parts = domain.split(".");
    if (parts.length >= 2) {
      companyInference = parts.slice(0, -1).join(".");
    }
  }

  // High-value finance domain bonus
  if (HIGH_VALUE_DOMAINS.has(domain)) {
    professionalScore += 10;
  }

  // Handle pattern analysis
  let handlePattern: EmailAnalysis["handle_pattern"] = "other";
  if (/^[a-z]+\.[a-z]+$/.test(localPart)) {
    handlePattern = "firstname.lastname";
    professionalScore += 5;
  } else if (/^[a-z]+_[a-z]+$/.test(localPart)) {
    handlePattern = "firstname.lastname"; // underscore variant
    professionalScore += 5;
  } else if (/^[a-z]{2,}$/.test(localPart) && localPart.length <= 15) {
    handlePattern = "firstname";
    professionalScore += 2;
  } else if (/^[a-z]{1,3}\d*$/.test(localPart)) {
    handlePattern = "initials";
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

export function analyzeKeywords(notes: string | null): KeywordSignals {
  if (!notes || notes.trim().length === 0) {
    return { investment_keywords: [], negative_keywords: [], keyword_score: 0 };
  }

  const lower = notes.toLowerCase();
  let score = 0;

  const foundInvestment = INVESTMENT_KEYWORDS.filter((kw) => lower.includes(kw));
  score += Math.min(foundInvestment.length * 3, 12);

  const foundNegative = NEGATIVE_KEYWORDS.filter((kw) => lower.includes(kw));
  score -= foundNegative.length * 5;

  return {
    investment_keywords: foundInvestment,
    negative_keywords: foundNegative,
    keyword_score: Math.max(score, -10),
  };
}

// ─── Claude AI Synthesis ────────────────────────────────

const SYSTEM_PROMPT = `You are a sales intelligence analyst for Masterworks, a platform for fractional art investing ($10k minimum, targeting accredited investors and high-net-worth individuals).

A potential investor has booked a meeting. Your job is to analyze all available data and provide a concise meeting prep for the salesperson doing a 15-30 minute qualification call.

Respond ONLY with valid JSON in this exact format:
{
  "qualification_score": <number 0-100>,
  "summary": "<2-3 sentences summarizing who this person likely is and their investment readiness>",
  "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
  "risk_flags": ["<flag if any>"],
  "recommended_approach": "<one of: consultative, direct, educational, cautious>"
}

Scoring guide:
- 80-100: Strong lead. Corporate email, high-wealth area, investment keywords, professional signals.
- 60-79: Promising. Some positive signals, worth a thorough conversation.
- 40-59: Moderate. Mixed signals, needs qualification during the call.
- 20-39: Weak. Few positive signals, likely needs education on minimums.
- 0-19: Very unlikely qualified. May be curious/research only.

Approach guide:
- "direct": High confidence lead. Get to specifics quickly — available offerings, minimums, timeline.
- "consultative": Promising but needs discovery. Ask about portfolio, goals, timeline.
- "educational": Moderate lead. Start with "how Masterworks works" before qualifying.
- "cautious": Weak signals. Be friendly but efficiently qualify budget/accreditation early.

Be realistic and honest. Do not inflate scores. A personal Gmail with no other signals is a 30-40 at best.`;

interface ClaudeResult {
  qualification_score: number;
  summary: string;
  talking_points: string[];
  risk_flags: string[];
  recommended_approach: string;
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
): Promise<ClaudeResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[Enrichment] ANTHROPIC_API_KEY not set, skipping Claude synthesis");
    return null;
  }

  const client = new Anthropic({ apiKey });

  const userMessage = `Meeting booked for: ${input.eventTitle}
Scheduled: ${input.startTime}
Lead time: ${behaviorSignals.lead_time_hours} hours from now

INVITEE DATA:
Name: ${input.inviteeName}
Email: ${input.inviteeEmail}
Phone: ${input.inviteePhone || "Not provided"}

SIGNAL ANALYSIS:
- Email domain: ${emailAnalysis.domain} (${emailAnalysis.is_personal ? "personal" : "corporate"})${emailAnalysis.company_inference ? `, likely company: ${emailAnalysis.company_inference}` : ""}
- Email pattern: ${emailAnalysis.handle_pattern}
- Phone: ${phoneAnalysis.area_code ? `area code ${phoneAnalysis.area_code}` : phoneAnalysis.country_code} (${phoneAnalysis.geo_inference || "unknown location"})
- Wealth indicator: ${phoneAnalysis.wealth_indicator}
- Booked at: ${behaviorSignals.booking_hour_local}:00 on ${behaviorSignals.booking_day}, ${behaviorSignals.lead_time_hours}h ahead
- Repeat booker: ${behaviorSignals.is_repeat_booker ? `Yes (${behaviorSignals.prior_bookings_count} prior bookings)` : "No (first booking)"}
${keywordSignals.investment_keywords.length > 0 ? `- Investment keywords found: ${keywordSignals.investment_keywords.join(", ")}` : "- No investment keywords in notes"}
${keywordSignals.negative_keywords.length > 0 ? `- Negative signals: ${keywordSignals.negative_keywords.join(", ")}` : ""}

NOTES/TOPIC: ${input.inviteeNotes || "None provided"}
${input.customAnswers ? `\nCUSTOM FORM ANSWERS: ${JSON.stringify(input.customAnswers)}` : ""}

PRE-COMPUTED SIGNAL SCORE: ${tier1Score}/100`;

  try {
    const model = "claude-haiku-4-5-20251001";
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
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
        model,
        tokens_used: tokensUsed,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      qualification_score: Math.min(100, Math.max(0, parsed.qualification_score || 0)),
      summary: parsed.summary || "",
      talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points : [],
      risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
      recommended_approach: parsed.recommended_approach || "consultative",
      model,
      tokens_used: tokensUsed,
    };
  } catch (err) {
    console.error("[Enrichment] Claude API call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Pipeline Orchestrator ──────────────────────────────

export async function runEnrichmentPipeline(input: EnrichmentInput): Promise<void> {
  const startedAt = Date.now();

  // Create enrichment row
  const { data: enrichment, error: insertErr } = await supabaseAdmin
    .from("booking_enrichments")
    .insert({
      booking_id: input.bookingId,
      enrichment_status: "processing",
    })
    .select("id")
    .single();

  if (insertErr || !enrichment) {
    console.error("[Enrichment] Failed to create enrichment row:", insertErr?.message);
    return;
  }

  const enrichmentId = enrichment.id;

  try {
    // Step 1: Signal analysis (parallel, free)
    const [emailAnalysis, phoneAnalysis, behaviorSignals, keywordSignals] = await Promise.all([
      Promise.resolve(analyzeEmail(input.inviteeEmail)),
      Promise.resolve(analyzePhone(input.inviteePhone)),
      analyzeBehavior(input.inviteeEmail, input.startTime, input.timezone),
      Promise.resolve(analyzeKeywords(input.inviteeNotes)),
    ]);

    // Compute tier 1 composite score (normalized to 0-100)
    const rawScore =
      emailAnalysis.professional_score +
      phoneAnalysis.wealth_score +
      behaviorSignals.behavior_score +
      keywordSignals.keyword_score;
    // Max possible: 30 + 12 + 16 + 12 = 70
    const tier1Score = Math.min(100, Math.max(0, Math.round((rawScore / 70) * 100)));

    // Check time budget before Claude call
    const elapsed = Date.now() - startedAt;
    let claudeResult: ClaudeResult | null = null;
    let totalCostCents = 0;

    if (elapsed < 6000) {
      // Step 2: Claude synthesis
      claudeResult = await synthesizeWithClaude(
        input, emailAnalysis, phoneAnalysis, behaviorSignals, keywordSignals, tier1Score,
      );

      if (claudeResult) {
        // Estimate cost: Haiku ~$0.25/MTok input, ~$1.25/MTok output
        // Rough: 1000 tokens * $0.25/1M = $0.00025, round up
        totalCostCents = Math.max(1, Math.round((claudeResult.tokens_used / 1000) * 0.15));
      }
    } else {
      console.warn(`[Enrichment] Skipping Claude — ${elapsed}ms elapsed, approaching timeout`);
    }

    // Save results
    const { error: updateErr } = await supabaseAdmin
      .from("booking_enrichments")
      .update({
        email_analysis: emailAnalysis,
        phone_analysis: phoneAnalysis,
        behavior_signals: behaviorSignals,
        keyword_signals: keywordSignals,
        tier1_score: tier1Score,
        ai_summary: claudeResult?.summary || null,
        ai_qualification_score: claudeResult?.qualification_score || null,
        ai_talking_points: claudeResult?.talking_points || null,
        ai_risk_flags: claudeResult?.risk_flags || null,
        ai_recommended_approach: claudeResult?.recommended_approach || null,
        ai_model: claudeResult?.model || null,
        ai_tokens_used: claudeResult?.tokens_used || null,
        enrichment_status: "completed",
        total_cost_cents: totalCostCents,
        completed_at: new Date().toISOString(),
      })
      .eq("id", enrichmentId);

    if (updateErr) {
      console.error("[Enrichment] Failed to update enrichment row:", updateErr.message);
    }

    // Update booking status
    await supabaseAdmin
      .from("bookings")
      .update({ enrichment_status: "completed" })
      .eq("id", input.bookingId);

    // Send meeting prep email
    try {
      await sendMeetingPrepEmail({
        input,
        emailAnalysis,
        phoneAnalysis,
        behaviorSignals,
        keywordSignals,
        tier1Score,
        claudeResult,
      });

      // Mark email as sent
      await supabaseAdmin
        .from("booking_enrichments")
        .update({ prep_email_sent_at: new Date().toISOString() })
        .eq("id", enrichmentId);
    } catch (emailErr) {
      console.error("[Enrichment] Prep email failed:", emailErr instanceof Error ? emailErr.message : emailErr);
    }

    console.log(
      `[Enrichment] Completed for booking ${input.bookingId} — ` +
      `tier1=${tier1Score}, ai=${claudeResult?.qualification_score ?? "skipped"}, ` +
      `cost=${totalCostCents}¢, ${Date.now() - startedAt}ms`
    );
  } catch (err) {
    // Mark as failed
    await supabaseAdmin
      .from("booking_enrichments")
      .update({
        enrichment_status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", enrichmentId);

    await supabaseAdmin
      .from("bookings")
      .update({ enrichment_status: "failed" })
      .eq("id", input.bookingId);

    console.error("[Enrichment] Pipeline failed for booking", input.bookingId, ":", err);
  }
}
