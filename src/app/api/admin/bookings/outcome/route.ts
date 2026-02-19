import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

/**
 * POST /api/admin/bookings/outcome — Record booking outcome (completed or no_show).
 *
 * Body: { bookingId: string, outcome: "completed" | "no_show" }
 *
 * This feeds the no-show prediction model. Over time, the accumulated data
 * lets us validate and retrain the scoring weights.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const { bookingId, outcome } = body;

  if (!bookingId || typeof bookingId !== "string") {
    return badRequest("Missing bookingId");
  }

  if (!outcome || !["completed", "no_show"].includes(outcome)) {
    return badRequest('Outcome must be "completed" or "no_show"');
  }

  // Update booking
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .update({
      outcome,
      outcome_recorded_at: new Date().toISOString(),
      status: outcome === "no_show" ? "no_show" : "completed",
    })
    .eq("id", bookingId)
    .eq("status", "confirmed") // Only confirmed bookings can have outcomes recorded
    .select("id, invitee_name, no_show_score, risk_tier, outcome")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return notFound("Booking (must be confirmed)");
    }
    return serverError("Failed to record outcome.", error, "Booking outcome POST");
  }

  return NextResponse.json({
    success: true,
    booking: {
      id: booking.id,
      invitee_name: booking.invitee_name,
      outcome: booking.outcome,
      no_show_score: booking.no_show_score,
      risk_tier: booking.risk_tier,
    },
  });
}

/**
 * GET /api/admin/bookings/outcome — Get prediction accuracy stats.
 *
 * Returns how well the no-show score predicted actual outcomes.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  try {
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("no_show_score, risk_tier, outcome")
      .not("outcome", "is", null)
      .not("no_show_score", "is", null);

    if (error) {
      return serverError("Failed to load outcome data.", error, "Booking outcome GET");
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        total_outcomes: 0,
        message: "No outcomes recorded yet. Record outcomes to train the model.",
      });
    }

    // Accuracy analysis
    const total = bookings.length;
    const noShows = bookings.filter((b) => b.outcome === "no_show").length;
    const completed = bookings.filter((b) => b.outcome === "completed").length;

    // True positives: predicted high risk AND was a no-show
    const truePositives = bookings.filter(
      (b) => b.risk_tier === "high" && b.outcome === "no_show"
    ).length;

    // False positives: predicted high risk but completed
    const falsePositives = bookings.filter(
      (b) => b.risk_tier === "high" && b.outcome === "completed"
    ).length;

    // False negatives: predicted low risk but was a no-show
    const falseNegatives = bookings.filter(
      (b) => b.risk_tier === "low" && b.outcome === "no_show"
    ).length;

    // Average scores by outcome
    const avgScoreNoShow = noShows > 0
      ? Math.round(bookings.filter((b) => b.outcome === "no_show").reduce((sum, b) => sum + (b.no_show_score || 0), 0) / noShows)
      : null;

    const avgScoreCompleted = completed > 0
      ? Math.round(bookings.filter((b) => b.outcome === "completed").reduce((sum, b) => sum + (b.no_show_score || 0), 0) / completed)
      : null;

    return NextResponse.json({
      total_outcomes: total,
      no_shows: noShows,
      completed,
      no_show_rate: total > 0 ? Math.round((noShows / total) * 100) : 0,
      prediction_accuracy: {
        true_positives: truePositives,
        false_positives: falsePositives,
        false_negatives: falseNegatives,
        precision: truePositives + falsePositives > 0
          ? Math.round((truePositives / (truePositives + falsePositives)) * 100)
          : null,
      },
      avg_score_no_show: avgScoreNoShow,
      avg_score_completed: avgScoreCompleted,
    });
  } catch (err) {
    return serverError("Outcome stats query failed.", err, "Booking outcome stats GET");
  }
}
