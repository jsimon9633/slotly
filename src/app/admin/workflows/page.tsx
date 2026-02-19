"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  Lock,
  Loader2,
  Check,
  Trash2,
  Pencil,
  Plus,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import Link from "next/link";

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

interface EventType {
  id: string;
  slug: string;
  title: string;
}

interface Workflow {
  id: string;
  event_type_id: string;
  name: string;
  trigger: "on_booking" | "before_meeting" | "after_meeting" | "on_cancel" | "on_reschedule";
  trigger_minutes?: number;
  action: "email" | "sms";
  recipient: "invitee" | "host" | "both";
  subject?: string;
  body: string;
  is_active: boolean;
}

interface CreateWorkflowForm {
  event_type_id: string;
  name: string;
  trigger: "on_booking" | "before_meeting" | "after_meeting" | "on_cancel" | "on_reschedule";
  trigger_minutes: number;
  action: "email" | "sms";
  recipient: "invitee" | "host" | "both";
  subject: string;
  body: string;
}

export default function AdminWorkflowsPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create workflow state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateWorkflowForm>({
    event_type_id: "",
    name: "",
    trigger: "on_booking",
    trigger_minutes: 15,
    action: "email",
    recipient: "invitee",
    subject: "",
    body: "",
  });
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);

  // Expand workflow details
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);

  // Delete workflow state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toggle active state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [etRes, wfRes] = await Promise.all([
        fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`),
        fetch(`/api/admin/workflows?token=${encodeURIComponent(token)}`),
      ]);

      if (etRes.status === 401 || wfRes.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setError("Invalid token.");
        return;
      }

      const etData = await etRes.json();
      const wfData = await wfRes.json();

      if (Array.isArray(etData)) setEventTypes(etData);
      if (Array.isArray(wfData)) setWorkflows(wfData);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  const handleCreateWorkflow = async () => {
    if (!createForm.event_type_id || !createForm.name.trim() || !createForm.body.trim()) {
      setError("Please fill in required fields.");
      return;
    }

    setCreatingWorkflow(true);
    setError(null);
    try {
      const payload = {
        event_type_id: createForm.event_type_id,
        name: createForm.name,
        trigger: createForm.trigger,
        trigger_minutes: ["before_meeting", "after_meeting"].includes(createForm.trigger)
          ? createForm.trigger_minutes
          : undefined,
        action: createForm.action,
        recipient: createForm.recipient,
        subject: createForm.action === "email" ? createForm.subject : undefined,
        body: createForm.body,
        is_active: true,
      };

      const res = await fetch(`/api/admin/workflows?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCreateForm({
          event_type_id: "",
          name: "",
          trigger: "on_booking",
          trigger_minutes: 15,
          action: "email",
          recipient: "invitee",
          subject: "",
          body: "",
        });
        setShowCreateForm(false);
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create workflow.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreatingWorkflow(false);
    }
  };

  const handleToggleActive = async (workflowId: string, currentActive: boolean) => {
    setTogglingId(workflowId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update workflow.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    setDeletingId(workflowId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setConfirmDeleteId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete workflow.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  };

  const groupedWorkflows = workflows.reduce(
    (acc, wf) => {
      if (!acc[wf.event_type_id]) {
        acc[wf.event_type_id] = [];
      }
      acc[wf.event_type_id].push(wf);
      return acc;
    },
    {} as Record<string, Workflow[]>
  );

  const getTriggerLabel = (trigger: string, minutes?: number): string => {
    switch (trigger) {
      case "on_booking":
        return "On booking";
      case "before_meeting":
        return `${minutes || 0} min before`;
      case "after_meeting":
        return `${minutes || 0} min after`;
      case "on_cancel":
        return "On cancellation";
      case "on_reschedule":
        return "On reschedule";
      default:
        return trigger;
    }
  };

  // Auth gate
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          <div className="flex items-center gap-2.5 justify-center mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg grid place-items-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Slotly</span>
            <span className="text-sm text-gray-300 ml-1">Admin</span>
          </div>
          <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="w-5 h-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Admin sign in</h2>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Username"
                className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
              />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Password"
                className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <button
              onClick={handleLogin}
              className="mt-4 w-full px-4 py-3 rounded-xl text-base font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Header */}
      <header className="max-w-[720px] sm:max-w-[860px] mx-auto flex items-center justify-between px-5 sm:px-8 pt-5 sm:pt-7">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg grid place-items-center">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Slotly</span>
          <span className="text-xs sm:text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold ml-1">
            Admin
          </span>
        </div>
        <Link
          href="/"
          className="text-sm sm:text-base text-gray-400 hover:text-gray-600 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Back
        </Link>
      </header>

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
          <Link
            href="/admin/webhooks"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Webhooks
          </Link>
          <div className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center bg-white text-gray-900 shadow-sm whitespace-nowrap px-2">
            Workflows
          </div>
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
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Workflow Automations</h1>
          </div>
          <p className="text-base sm:text-lg text-gray-400">
            Automate emails and SMS around your bookings.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-[1.5px] border-red-200 rounded-xl text-sm text-red-600 animate-fade-in-up stagger-1">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Create workflow form */}
            <div className="animate-fade-in-up stagger-1">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="w-full p-4 bg-white rounded-xl border-[1.5px] border-gray-100 flex items-center justify-between hover:border-gray-200 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <span className="text-base font-semibold text-gray-900">Create Workflow</span>
                </div>
                {showCreateForm ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showCreateForm && (
                <div className="mt-4 p-6 bg-white rounded-xl border-[1.5px] border-gray-100 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                      Event Type
                    </label>
                    <select
                      value={createForm.event_type_id}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, event_type_id: e.target.value })
                      }
                      className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    >
                      <option value="">Select event type...</option>
                      {eventTypes.map((et) => (
                        <option key={et.id} value={et.id}>
                          {et.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="e.g., Welcome email"
                      className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                      Trigger
                    </label>
                    <select
                      value={createForm.trigger}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          trigger: e.target.value as CreateWorkflowForm["trigger"],
                        })
                      }
                      className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    >
                      <option value="on_booking">On booking</option>
                      <option value="before_meeting">Before meeting</option>
                      <option value="after_meeting">After meeting</option>
                      <option value="on_cancel">On cancellation</option>
                      <option value="on_reschedule">On reschedule</option>
                    </select>
                  </div>

                  {(createForm.trigger === "before_meeting" ||
                    createForm.trigger === "after_meeting") && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                        Minutes
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={createForm.trigger_minutes}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            trigger_minutes: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                      Action
                    </label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setCreateForm({ ...createForm, action: "email" })}
                        className={`w-full p-3 text-sm font-semibold rounded-xl border-[1.5px] transition-all ${
                          createForm.action === "email"
                            ? "bg-indigo-50 border-indigo-300 text-indigo-600"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        Email
                      </button>
                      <button
                        disabled
                        className="w-full p-3 text-sm font-semibold rounded-xl border-[1.5px] bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                      >
                        SMS (coming soon)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                      Recipient
                    </label>
                    <select
                      value={createForm.recipient}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          recipient: e.target.value as CreateWorkflowForm["recipient"],
                        })
                      }
                      className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    >
                      <option value="invitee">Invitee</option>
                      <option value="host">Host</option>
                      <option value="both">Both</option>
                    </select>
                  </div>

                  {createForm.action === "email" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={createForm.subject}
                        onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                        placeholder="Email subject"
                        className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                      Message Body
                    </label>
                    <textarea
                      value={createForm.body}
                      onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
                      placeholder="Write your message here..."
                      rows={6}
                      className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300 resize-none"
                    />
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border-[1.5px] border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Template variables:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}name{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}email{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}event_title{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}start_time{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}date{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}time{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}meet_link{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}manage_link{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}host_name{"}"}
                          {"}"}
                        </code>
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {"{"}
                          {"{"}host_email{"}"}
                          {"}"}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCreateWorkflow}
                      disabled={creatingWorkflow}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {creatingWorkflow ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Workflow
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setError(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Workflows grouped by event type */}
            {Object.entries(groupedWorkflows).length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border-[1.5px] border-gray-100 animate-fade-in-up stagger-2">
                <p className="text-base text-gray-400">No workflows yet. Create one to get started.</p>
              </div>
            ) : (
              Object.entries(groupedWorkflows).map(([eventTypeId, eventWorkflows], idx) => {
                const eventType = eventTypes.find((et) => et.id === eventTypeId);
                return (
                  <div key={eventTypeId} className={`animate-fade-in-up stagger-${idx + 2}`}>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {eventType?.title || "Unknown Event"}
                    </h2>
                    <div className="space-y-3">
                      {eventWorkflows.map((workflow) => (
                        <div
                          key={workflow.id}
                          className="p-4 bg-white rounded-xl border-[1.5px] border-gray-100 transition-all hover:border-gray-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <button
                                onClick={() =>
                                  setExpandedWorkflowId(
                                    expandedWorkflowId === workflow.id ? null : workflow.id
                                  )
                                }
                                className="flex items-center gap-2 w-full text-left"
                              >
                                <div className="flex-1">
                                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                    {workflow.name}
                                  </h3>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
                                      {getTriggerLabel(workflow.trigger, workflow.trigger_minutes)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-600">
                                      {workflow.action === "email" ? "Email" : "SMS"} →{" "}
                                      {workflow.recipient}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleToggleActive(workflow.id, workflow.is_active)}
                                disabled={togglingId === workflow.id}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                              >
                                {workflow.is_active ? (
                                  <ToggleRight className="w-5 h-5 text-indigo-600" />
                                ) : (
                                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  setExpandedWorkflowId(
                                    expandedWorkflowId === workflow.id ? null : workflow.id
                                  )
                                }
                                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                              >
                                {expandedWorkflowId === workflow.id ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded details */}
                          {expandedWorkflowId === workflow.id && (
                            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                              {workflow.subject && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                    Subject
                                  </p>
                                  <p className="text-sm text-gray-600">{workflow.subject}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                  Body
                                </p>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                  {workflow.body}
                                </p>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button
                                  disabled
                                  className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-50 text-gray-400 flex items-center justify-center gap-2 cursor-not-allowed"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(workflow.id)}
                                  className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-6 max-w-[400px] animate-fade-in-up">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Delete workflow?</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    This workflow will be permanently deleted. This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDeleteWorkflow(confirmDeleteId)}
                      disabled={deletingId === confirmDeleteId}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {deletingId === confirmDeleteId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
