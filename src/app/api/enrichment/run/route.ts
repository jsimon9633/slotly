import { NextRequest, NextResponse } from "next/server";
import { runEnrichmentPipeline } from "@/lib/enrichment";
import type { EnrichmentInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for Claude API + web search

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(request: NextRequest) {
  // Auth: internal calls only (same secret as cron endpoints)
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    bookingId,
    inviteeName,
    inviteeEmail,
    inviteePhone,
    inviteeNotes,
    customAnswers,
    startTime,
    timezone,
    eventTitle,
    teamMemberName,
    teamMemberEmail,
    meetingType,
  } = body;

  if (!bookingId || !inviteeName || !inviteeEmail || !startTime || !timezone || !eventTitle) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const input: EnrichmentInput = {
    bookingId,
    inviteeName,
    inviteeEmail,
    inviteePhone: inviteePhone || null,
    inviteeNotes: inviteeNotes || null,
    customAnswers: customAnswers || null,
    startTime,
    timezone,
    eventTitle,
    teamMemberName: teamMemberName || "",
    teamMemberEmail: teamMemberEmail || "",
    meetingType: meetingType || null,
  };

  // Run pipeline (non-blocking — respond immediately, process in background)
  // Note: On Netlify, the response will hold until the pipeline completes
  // since we await. This is fine within the 10s function timeout.
  try {
    await runEnrichmentPipeline(input);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Enrichment API] Pipeline error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Enrichment pipeline failed", detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
