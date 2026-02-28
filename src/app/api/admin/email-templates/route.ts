import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { unauthorized, badRequest, serverError, sanitizeString } from "@/lib/api-errors";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "slotly-jsimon9633-2026";

const VALID_TEMPLATE_TYPES = [
  "booking_confirmation",
  "team_member_alert",
  "cancellation",
  "reschedule",
  "reminder",
] as const;

type TemplateType = (typeof VALID_TEMPLATE_TYPES)[number];

/**
 * GET /api/admin/email-templates — List all custom email templates.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== ADMIN_TOKEN) {
    return unauthorized();
  }

  try {
    const { data: templates, error } = await supabaseAdmin
      .from("email_templates")
      .select("id, template_type, subject, body_html, is_active, created_at, updated_at")
      .order("template_type", { ascending: true });

    if (error) {
      return serverError("Failed to load email templates.", error, "Admin email-templates GET");
    }

    return NextResponse.json(templates || []);
  } catch (err) {
    return serverError("Email templates query failed.", err, "Admin email-templates GET");
  }
}

/**
 * POST /api/admin/email-templates — Upsert a custom email template.
 *
 * Body: { template_type: string, subject?: string, body_html: string }
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

  const { template_type, subject, body_html } = body;

  if (!template_type || !VALID_TEMPLATE_TYPES.includes(template_type as TemplateType)) {
    return badRequest(
      `template_type must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}`
    );
  }

  if (!body_html || typeof body_html !== "string" || body_html.trim().length < 10) {
    return badRequest("body_html is required (min 10 characters)");
  }

  const cleanSubject = subject ? sanitizeString(String(subject), 200) : null;
  const cleanBody = body_html.trim().slice(0, 50000); // 50KB limit

  try {
    // Upsert by template_type (unique constraint)
    const { data: template, error } = await supabaseAdmin
      .from("email_templates")
      .upsert(
        {
          template_type,
          subject: cleanSubject,
          body_html: cleanBody,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "template_type" }
      )
      .select("id, template_type, subject, body_html, is_active, created_at, updated_at")
      .single();

    if (error) {
      return serverError("Failed to save email template.", error, "Admin email-templates POST");
    }

    return NextResponse.json(template, { status: 200 });
  } catch (err) {
    return serverError("Email template save failed.", err, "Admin email-templates POST");
  }
}

/**
 * DELETE /api/admin/email-templates — Delete a custom template (reverts to default).
 *
 * Body: { template_type: string }
 */
export async function DELETE(request: NextRequest) {
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

  const { template_type } = body;

  if (!template_type || !VALID_TEMPLATE_TYPES.includes(template_type as TemplateType)) {
    return badRequest(
      `template_type must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}`
    );
  }

  try {
    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("template_type", template_type);

    if (error) {
      return serverError("Failed to delete email template.", error, "Admin email-templates DELETE");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError("Email template delete failed.", err, "Admin email-templates DELETE");
  }
}
