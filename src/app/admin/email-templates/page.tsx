"use client";

import { useEffect, useState, useRef } from "react";
import {
  Zap,
  ArrowLeft,
  Loader2,
  Save,
  RotateCcw,
  Mail,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import Link from "next/link";

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string | null;
  body_html: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

const TEMPLATE_TYPES = [
  {
    type: "booking_confirmation",
    label: "Booking Confirmation",
    description: "Sent to the invitee when a booking is confirmed",
    defaultSubject: "Confirmed: {{event_title}} on {{date}}",
    defaultBody: `<h1 style="margin:0 0 8px;font-size:22px;color:#111827;">You're booked!</h1>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
  Your {{event_title}} has been confirmed.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
  <tr><td>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>What:</strong> {{event_title}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>When:</strong> {{start_time}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>With:</strong> {{host_name}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Duration:</strong> {{duration}}</p>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#6b7280;">
  A calendar invite has been sent to <strong>{{email}}</strong>. See you there!
</p>
<p style="margin:16px 0 0;font-size:14px;">
  <a href="{{reschedule_link}}" style="color:#4f46e5;text-decoration:none;font-weight:600;">Reschedule</a> &nbsp;|&nbsp;
  <a href="{{cancel_link}}" style="color:#dc2626;text-decoration:none;font-weight:600;">Cancel</a>
</p>`,
  },
  {
    type: "team_member_alert",
    label: "Team Member Alert",
    description: "Sent to the team member when they receive a new booking",
    defaultSubject: "New booking: {{event_title}} with {{name}}",
    defaultBody: `<h1 style="margin:0 0 8px;font-size:22px;color:#111827;">New booking</h1>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
  {{name}} just booked a {{event_title}} with you.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
  <tr><td>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Who:</strong> {{name}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Email:</strong> {{email}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>What:</strong> {{event_title}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>When:</strong> {{start_time}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Duration:</strong> {{duration}}</p>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#6b7280;">
  This meeting is on your calendar. Check Google Calendar for details.
</p>`,
  },
  {
    type: "cancellation",
    label: "Cancellation",
    description: "Sent to both parties when a booking is cancelled",
    defaultSubject: "Cancelled: {{event_title}} on {{date}}",
    defaultBody: `<h1 style="margin:0 0 8px;font-size:22px;color:#dc2626;">Booking Cancelled</h1>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
  The {{event_title}} booking has been cancelled.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
  <tr><td>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>What:</strong> {{event_title}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>When:</strong> {{start_time}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Duration:</strong> {{duration}}</p>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#6b7280;">
  The calendar event has been removed.
</p>`,
  },
  {
    type: "reschedule",
    label: "Reschedule",
    description: "Sent to both parties when a booking is rescheduled",
    defaultSubject: "Rescheduled: {{event_title}}",
    defaultBody: `<h1 style="margin:0 0 8px;font-size:22px;color:#4f46e5;">Meeting Rescheduled</h1>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
  The {{event_title}} booking has been rescheduled.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
  <tr><td>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>What:</strong> {{event_title}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>New time:</strong> {{start_time}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Duration:</strong> {{duration}}</p>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#6b7280;">
  Your calendar has been updated automatically.
</p>
<p style="margin:16px 0 0;font-size:14px;">
  <a href="{{reschedule_link}}" style="color:#4f46e5;text-decoration:none;font-weight:600;">Reschedule again</a> &nbsp;|&nbsp;
  <a href="{{cancel_link}}" style="color:#dc2626;text-decoration:none;font-weight:600;">Cancel</a>
</p>`,
  },
  {
    type: "reminder",
    label: "Reminder",
    description: "Sent to the invitee ~2 hours before the meeting",
    defaultSubject: "Reminder: {{event_title}} today at {{time}}",
    defaultBody: `<h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Quick reminder!</h1>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
  Your {{event_title}} is coming up in about 2 hours.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
  <tr><td>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>What:</strong> {{event_title}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>When:</strong> {{start_time}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>With:</strong> {{host_name}}</p>
    <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Duration:</strong> {{duration}}</p>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#6b7280;">
  Can't make it? No worries — you can reschedule or cancel below.
</p>
<p style="margin:16px 0 0;font-size:14px;">
  <a href="{{reschedule_link}}" style="color:#4f46e5;text-decoration:none;font-weight:600;">Reschedule</a> &nbsp;|&nbsp;
  <a href="{{cancel_link}}" style="color:#dc2626;text-decoration:none;font-weight:600;">Cancel</a>
</p>`,
  },
] as const;

const AVAILABLE_VARIABLES = [
  { key: "name", label: "Invitee Name" },
  { key: "email", label: "Invitee Email" },
  { key: "event_title", label: "Event Title" },
  { key: "start_time", label: "Full Date/Time" },
  { key: "date", label: "Date Only" },
  { key: "time", label: "Time Only" },
  { key: "duration", label: "Duration" },
  { key: "host_name", label: "Host Name" },
  { key: "host_email", label: "Host Email" },
  { key: "meet_link", label: "Meet Link" },
  { key: "manage_link", label: "Manage Link" },
  { key: "reschedule_link", label: "Reschedule Link" },
  { key: "cancel_link", label: "Cancel Link" },
  { key: "notes", label: "Notes" },
];

// Sample data for live preview
const SAMPLE_DATA: Record<string, string> = {
  name: "Jane Smith",
  email: "jane@example.com",
  event_title: "30-Minute Strategy Call",
  start_time: "Wednesday, March 5, 2026, 2:00 PM EST",
  date: "Wednesday, March 5, 2026",
  time: "2:00 PM EST",
  duration: "30 minutes",
  host_name: "Alberto Simon",
  host_email: "alberto@company.com",
  meet_link: "https://meet.google.com/abc-defg-hij",
  manage_link: "https://example.com/manage/abc123",
  reschedule_link: "https://example.com/manage/abc123/reschedule",
  cancel_link: "https://example.com/manage/abc123/cancel",
  notes: "Looking forward to discussing Q2 strategy.",
  old_start_time: "Monday, March 3, 2026, 10:00 AM EST",
  cancelled_by: "invitee",
};

function renderPreviewHtml(bodyHtml: string): string {
  // Replace variables with sample data
  let rendered = bodyHtml;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  // Wrap in the email layout
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#4f46e5;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                    <span style="color:white;font-size:16px;font-weight:bold;">&#9889;</span>
                  </td>
                  <td style="padding-left:10px;font-size:20px;font-weight:700;color:#111827;">Slotly</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:32px;">
              ${rendered}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:13px;color:#9ca3af;">
              Powered by Slotly &middot; Fast team scheduling
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default function AdminEmailTemplatesPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Auth
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  function handleLogin() {
    if (username === ADMIN_USERNAME && token.length >= 10) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      setAuthenticated(true);
      setError(null);
    } else {
      setError("Invalid credentials");
    }
  }

  // Fetch custom templates
  useEffect(() => {
    if (!authenticated) return;
    fetchTemplates();
  }, [authenticated]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-templates?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setCustomTemplates(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function getCustomTemplate(templateType: string): EmailTemplate | undefined {
    return customTemplates.find((t) => t.template_type === templateType);
  }

  function handleExpand(templateType: string) {
    if (expandedType === templateType) {
      setExpandedType(null);
      setShowPreview(false);
      return;
    }
    setExpandedType(templateType);
    setShowPreview(false);

    const custom = getCustomTemplate(templateType);
    const def = TEMPLATE_TYPES.find((t) => t.type === templateType);
    if (custom) {
      setEditSubject(custom.subject || "");
      setEditBody(custom.body_html);
    } else if (def) {
      setEditSubject(def.defaultSubject);
      setEditBody(def.defaultBody);
    }
  }

  function insertVariable(key: string) {
    const tag = `{{${key}}}`;
    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = editBody.substring(0, start);
      const after = editBody.substring(end);
      setEditBody(before + tag + after);
      // Reset cursor after the inserted variable
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      });
    } else {
      setEditBody(editBody + tag);
    }
  }

  async function handleSave(templateType: string) {
    setSaving(true);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/email-templates?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_type: templateType,
          subject: editSubject || null,
          body_html: editBody,
        }),
      });
      if (res.ok) {
        await fetchTemplates();
        setSaveSuccess(templateType);
        setTimeout(() => setSaveSuccess(null), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(templateType: string) {
    if (!confirm("Reset this template to the default? Your customizations will be removed.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates?token=${token}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_type: templateType }),
      });
      if (res.ok) {
        await fetchTemplates();
        // Load default content
        const def = TEMPLATE_TYPES.find((t) => t.type === templateType);
        if (def) {
          setEditSubject(def.defaultSubject);
          setEditBody(def.defaultBody);
        }
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Slotly Admin</span>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={handleLogin}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[720px] sm:max-w-[860px] mx-auto px-5 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin/settings" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">Slotly</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin nav */}
      <div className="max-w-[720px] sm:max-w-[860px] mx-auto px-5 sm:px-8 pt-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 sm:p-1.5 overflow-x-auto hide-scrollbar">
          <Link
            href="/admin/join-requests"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            People
          </Link>
          <Link
            href="/admin/teams"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Teams
          </Link>
          <Link
            href="/admin/settings"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Settings
          </Link>
          <Link
            href="/admin/branding"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Branding
          </Link>
          <div className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center bg-white text-gray-900 shadow-sm whitespace-nowrap px-2">
            Emails
          </div>
          <Link
            href="/admin/webhooks"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Webhooks
          </Link>
          <Link
            href="/admin/workflows"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Workflows
          </Link>
          <Link
            href="/admin/analytics"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Analytics
          </Link>
        </div>
      </div>

      <main className="max-w-[720px] sm:max-w-[860px] mx-auto px-5 sm:px-8 pt-7 sm:pt-9 pb-14">
        {/* Title */}
        <div className="mb-6 sm:mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2.5 mb-1">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Email Templates</h1>
          </div>
          <p className="text-sm text-gray-500">
            Customize the emails sent for bookings, cancellations, and reminders. Use variables like {"{{name}}"} to personalize content.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {TEMPLATE_TYPES.map((tmpl) => {
              const custom = getCustomTemplate(tmpl.type);
              const isExpanded = expandedType === tmpl.type;

              return (
                <div
                  key={tmpl.type}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all"
                >
                  {/* Card header */}
                  <button
                    onClick={() => handleExpand(tmpl.type)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{tmpl.label}</span>
                          {custom ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-700 uppercase">
                              Customized
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-500 uppercase">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{tmpl.description}</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-5">
                      {/* Subject */}
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Subject Line
                        </label>
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          placeholder={tmpl.defaultSubject}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>

                      {/* Body HTML */}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Body HTML
                        </label>
                        <textarea
                          ref={bodyRef}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                        />
                      </div>

                      {/* Variable chips */}
                      <div className="mb-5">
                        <p className="text-xs text-gray-500 mb-2">
                          Click a variable to insert at cursor position:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {AVAILABLE_VARIABLES.map((v) => (
                            <button
                              key={v.key}
                              onClick={() => insertVariable(v.key)}
                              className="px-2 py-1 text-[11px] font-mono bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
                              title={v.label}
                            >
                              {`{{${v.key}}}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Preview toggle */}
                      <div className="mb-5">
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          {showPreview ? "Hide Preview" : "Show Live Preview"}
                        </button>
                        {showPreview && (
                          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold">
                              Preview (with sample data)
                            </div>
                            <iframe
                              srcDoc={renderPreviewHtml(editBody)}
                              className="w-full border-0"
                              style={{ height: "480px" }}
                              sandbox="allow-same-origin"
                              title="Email preview"
                            />
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSave(tmpl.type)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : saveSuccess === tmpl.type ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          {saveSuccess === tmpl.type ? "Saved!" : "Save Template"}
                        </button>
                        {custom && (
                          <button
                            onClick={() => handleReset(tmpl.type)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
