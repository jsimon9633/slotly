import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-admin-2024";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_TOKEN}`) return true;
  const token = req.nextUrl.searchParams.get("token");
  return token === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  const status = req.nextUrl.searchParams.get("status") || "pending";
  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) {
    return badRequest("Invalid status filter. Use: pending, approved, or rejected.");
  }

  const { data, error } = await supabaseAdmin
    .from("join_requests")
    .select("id, name, email, calendar_shared, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return serverError("Failed to fetch join requests.", error, "Admin join-requests GET");
  }

  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const { id, status } = body;
  if (typeof id !== "string" || !["approved", "rejected"].includes(status)) {
    return badRequest("Invalid input. Provide a valid id and status (approved or rejected).");
  }

  const { error } = await supabaseAdmin
    .from("join_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return serverError("Failed to update join request.", error, "Admin join-requests PATCH");
  }

  return NextResponse.json({ success: true });
}
