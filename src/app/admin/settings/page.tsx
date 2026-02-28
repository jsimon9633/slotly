"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  Settings,
  Lock,
  Unlock,
  Loader2,
  Check,
  Clock,
  ShieldCheck,
  CalendarClock,
  Hash,
  Save,
  Pencil,
  X,
  Plus,
  Calendar,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ListChecks,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { MEETING_TYPE_OPTIONS } from "@/lib/meeting-type-questions";

interface BookingQuestion {
  id: string;
  type: "text" | "dropdown" | "checkbox";
  label: string;
  required: boolean;
  options?: string[];
}

interface EventTypeSettings {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  is_locked: boolean;
  before_buffer_mins: number;
  after_buffer_mins: number;
  min_notice_hours: number;
  max_daily_bookings: number | null;
  max_advance_days: number;
  booking_questions?: BookingQuestion[];
  meeting_type?: string | null;
}

// Track pending edits per event type
interface PendingEdit {
  before_buffer_mins?: string;
  after_buffer_mins?: string;
  min_notice_hours?: string;
  max_daily_bookings?: string;
  max_advance_days?: string;
}

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

export default function AdminSettingsPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventTypes, setEventTypes] = useState<EventTypeSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingEdits, setPendingEdits] = useState<Record<string, PendingEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Inline rename state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  // Description edit state
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDescValue, setEditingDescValue] = useState("");

  // Create event type state
  const [showCreateET, setShowCreateET] = useState(false);
  const [newETTitle, setNewETTitle] = useState("");
  const [newETDesc, setNewETDesc] = useState("");
  const [newETDuration, setNewETDuration] = useState("30");
  const [newETColor, setNewETColor] = useState("#6366f1");
  const [creatingET, setCreatingET] = useState(false);

  // Delete event type state
  const [confirmDeleteETId, setConfirmDeleteETId] = useState<string | null>(null);
  const [deletingET, setDeletingET] = useState(false);

  // Booking questions state
  const [expandedQuestionsETId, setExpandedQuestionsETId] = useState<string | null>(null);
  const [questionsEdits, setQuestionsEdits] = useState<Record<string, BookingQuestion[]>>({});
  const [savingQuestionsId, setSavingQuestionsId] = useState<string | null>(null);
  const [savedQuestionsId, setSavedQuestionsId] = useState<string | null>(null);

  // SMS Beta state
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [smsLoading, setSmsLoading] = useState(true);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsSaved, setSmsSaved] = useState(false);

  // Auth check
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchEventTypes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`);
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setError("Invalid token.");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setEventTypes(data);
    } catch {
      setError("Failed to load event types.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) fetchEventTypes();
  }, [authenticated, fetchEventTypes]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  const getEditValue = (etId: string, field: keyof PendingEdit, original: number | null): string => {
    const edit = pendingEdits[etId];
    if (edit && edit[field] !== undefined) return edit[field] as string;
    if (original === null) return "";
    return String(original);
  };

  const setEditValue = (etId: string, field: keyof PendingEdit, value: string) => {
    setPendingEdits((prev) => ({
      ...prev,
      [etId]: { ...prev[etId], [field]: value },
    }));
  };

  const hasChanges = (et: EventTypeSettings): boolean => {
    const edit = pendingEdits[et.id];
    if (!edit) return false;
    if (edit.before_buffer_mins !== undefined && edit.before_buffer_mins !== String(et.before_buffer_mins)) return true;
    if (edit.after_buffer_mins !== undefined && edit.after_buffer_mins !== String(et.after_buffer_mins)) return true;
    if (edit.min_notice_hours !== undefined && edit.min_notice_hours !== String(et.min_notice_hours)) return true;
    if (edit.max_daily_bookings !== undefined) {
      const origStr = et.max_daily_bookings === null ? "" : String(et.max_daily_bookings);
      if (edit.max_daily_bookings !== origStr) return true;
    }
    if (edit.max_advance_days !== undefined && edit.max_advance_days !== String(et.max_advance_days)) return true;
    return false;
  };

  const handleSave = async (et: EventTypeSettings) => {
    const edit = pendingEdits[et.id];
    if (!edit) return;

    setSavingId(et.id);
    setSavedId(null);
    setError(null);

    const body: Record<string, any> = { id: et.id };
    if (edit.before_buffer_mins !== undefined) body.before_buffer_mins = edit.before_buffer_mins;
    if (edit.after_buffer_mins !== undefined) body.after_buffer_mins = edit.after_buffer_mins;
    if (edit.min_notice_hours !== undefined) body.min_notice_hours = edit.min_notice_hours;
    if (edit.max_daily_bookings !== undefined) {
      body.max_daily_bookings = edit.max_daily_bookings === "" ? null : edit.max_daily_bookings;
    }
    if (edit.max_advance_days !== undefined) body.max_advance_days = edit.max_advance_days;

    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSavedId(et.id);
        setTimeout(() => setSavedId(null), 2500);
        // Clear pending edits for this event type
        setPendingEdits((prev) => {
          const next = { ...prev };
          delete next[et.id];
          return next;
        });
        // Refresh data
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleLock = async (et: EventTypeSettings) => {
    setSavingId(et.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: et.id, is_locked: !et.is_locked }),
      });
      if (res.ok) {
        setSavedId(et.id);
        setTimeout(() => setSavedId(null), 2500);
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to toggle lock.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateMeetingType = async (etId: string, meetingType: string | null) => {
    setSavingId(etId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: etId, meeting_type: meetingType }),
      });
      if (res.ok) {
        setSavedId(etId);
        setTimeout(() => setSavedId(null), 2500);
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update meeting type.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  };

  // Rename event type
  const handleRenameEventType = async (etId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setSavingId(etId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: etId, title: newTitle.trim() }),
      });
      if (res.ok) {
        setSavedId(etId);
        setTimeout(() => setSavedId(null), 2500);
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to rename.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  };

  // Save description
  const handleSaveDescription = async (etId: string, desc: string) => {
    setSavingId(etId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: etId, description: desc.trim() || null }),
      });
      if (res.ok) {
        setSavedId(etId);
        setTimeout(() => setSavedId(null), 2500);
        setEditingDescId(null);
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save description.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  };

  // Create custom event type
  const handleCreateEventType = async () => {
    if (!newETTitle.trim()) return;
    setCreatingET(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newETTitle.trim(),
          description: newETDesc.trim() || undefined,
          duration_minutes: parseInt(newETDuration) || 30,
          color: newETColor,
        }),
      });
      if (res.ok) {
        setNewETTitle("");
        setNewETDesc("");
        setNewETDuration("30");
        setNewETColor("#6366f1");
        setShowCreateET(false);
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create event type.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreatingET(false);
    }
  };

  // Delete event type
  const handleDeleteEventType = async (etId: string) => {
    setDeletingET(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: etId }),
      });
      if (res.ok) {
        setConfirmDeleteETId(null);
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete event type.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeletingET(false);
    }
  };

  // Booking questions helpers
  const getQuestions = (etId: string): BookingQuestion[] => {
    if (questionsEdits[etId]) return questionsEdits[etId];
    const et = eventTypes.find((e) => e.id === etId);
    return et?.booking_questions || [];
  };

  const setQuestions = (etId: string, qs: BookingQuestion[]) => {
    setQuestionsEdits((prev) => ({ ...prev, [etId]: qs }));
  };

  const addQuestion = (etId: string, type: "text" | "dropdown" | "checkbox") => {
    const qs = [...getQuestions(etId)];
    qs.push({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: "",
      required: false,
      options: type === "dropdown" ? ["Option 1"] : undefined,
    });
    setQuestions(etId, qs);
  };

  const updateQuestion = (etId: string, qId: string, updates: Partial<BookingQuestion>) => {
    const qs = getQuestions(etId).map((q) => (q.id === qId ? { ...q, ...updates } : q));
    setQuestions(etId, qs);
  };

  const removeQuestion = (etId: string, qId: string) => {
    setQuestions(etId, getQuestions(etId).filter((q) => q.id !== qId));
  };

  const moveQuestion = (etId: string, qId: string, direction: "up" | "down") => {
    const qs = [...getQuestions(etId)];
    const idx = qs.findIndex((q) => q.id === qId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= qs.length) return;
    [qs[idx], qs[newIdx]] = [qs[newIdx], qs[idx]];
    setQuestions(etId, qs);
  };

  const handleSaveQuestions = async (etId: string) => {
    const qs = getQuestions(etId);
    // Validate labels
    for (const q of qs) {
      if (!q.label.trim()) {
        setError("All questions must have a label.");
        return;
      }
    }
    setSavingQuestionsId(etId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: etId, booking_questions: qs }),
      });
      if (res.ok) {
        setSavedQuestionsId(etId);
        setTimeout(() => setSavedQuestionsId(null), 2500);
        setQuestionsEdits((prev) => {
          const next = { ...prev };
          delete next[etId];
          return next;
        });
        fetchEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save questions.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingQuestionsId(null);
    }
  };

  const hasQuestionChanges = (etId: string): boolean => {
    return !!questionsEdits[etId];
  };

  // Fetch SMS settings
  const fetchSmsSettings = useCallback(async () => {
    if (!token) return;
    setSmsLoading(true);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}&_sms=1`);
      // We don't have a dedicated SMS endpoint — use site_settings via a small helper
      // For now, fetch from the settings directly
      const smsRes = await fetch(`/api/admin/sms-settings?token=${encodeURIComponent(token)}`);
      if (smsRes.ok) {
        const data = await smsRes.json();
        setSmsEnabled(data.sms_enabled === "true");
        setTwilioSid(data.twilio_account_sid || "");
        setTwilioToken(data.twilio_auth_token || "");
        setTwilioPhone(data.twilio_phone_number || "");
      }
    } catch {
      // Silently fail — SMS section just shows defaults
    } finally {
      setSmsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) fetchSmsSettings();
  }, [authenticated, fetchSmsSettings]);

  const handleSaveSms = async () => {
    setSmsSaving(true);
    setSmsSaved(false);
    try {
      const res = await fetch(`/api/admin/sms-settings?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sms_enabled: smsEnabled ? "true" : "false",
          twilio_account_sid: twilioSid.trim(),
          twilio_auth_token: twilioToken.trim(),
          twilio_phone_number: twilioPhone.trim(),
        }),
      });
      if (res.ok) {
        setSmsSaved(true);
        setTimeout(() => setSmsSaved(false), 2000);
      }
    } catch {
      setError("Failed to save SMS settings.");
    } finally {
      setSmsSaving(false);
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
          <div className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center bg-white text-gray-900 shadow-sm whitespace-nowrap px-2">
            Settings
          </div>
          <Link
            href="/admin/branding"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Branding
          </Link>
          <Link
            href="/admin/email-templates"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Emails
          </Link>
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Scheduling Settings</h1>
              </div>
              <p className="text-base sm:text-lg text-gray-400">
                Manage event types and configure scheduling rules.
              </p>
            </div>
            <button
              onClick={() => setShowCreateET(!showCreateET)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Event Type
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600 animate-fade-in flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Create Event Type Form */}
        {showCreateET && (
          <div className="bg-white rounded-xl border-[1.5px] border-indigo-200 p-5 sm:p-6 mb-6 animate-fade-in-up">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Create New Event Type</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newETTitle}
                    onChange={(e) => setNewETTitle(e.target.value)}
                    placeholder="e.g. Quick Chat, Portfolio Review"
                    className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Duration (min) *
                  </label>
                  <select
                    value={newETDuration}
                    onChange={(e) => setNewETDuration(e.target.value)}
                    className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  >
                    <option value="15">15 min</option>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                    <option value="120">120 min</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewETColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newETColor === c ? "border-gray-900 scale-110" : "border-transparent hover:border-gray-300"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={newETDesc}
                  onChange={(e) => setNewETDesc(e.target.value)}
                  placeholder="Shown to invitees on the booking page (optional)"
                  rows={2}
                  maxLength={1000}
                  className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300 resize-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreateEventType}
                  disabled={!newETTitle.trim() || creatingET}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {creatingET ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create Event Type</>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateET(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : eventTypes.length === 0 ? (
          <div className="text-center py-14 text-gray-300 text-base">
            No event types found.
          </div>
        ) : (
          <div className="space-y-6">
            {eventTypes.map((et, i) => (
              <div
                key={et.id}
                className={`bg-white rounded-xl border-[1.5px] border-gray-100 overflow-hidden animate-fade-in-up stagger-${i + 1}`}
              >
                {/* Event type header */}
                <div className="flex items-center gap-3 px-5 sm:px-6 pt-5 pb-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <div className="flex-1 min-w-0">
                    {editingTitleId === et.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameEventType(et.id, editingTitleValue);
                              setEditingTitleId(null);
                            }
                            if (e.key === "Escape") setEditingTitleId(null);
                          }}
                          autoFocus
                          className="text-base sm:text-lg font-semibold text-gray-900 bg-white border-[1.5px] border-indigo-300 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-100 w-full max-w-[280px]"
                        />
                        <button
                          onClick={() => {
                            handleRenameEventType(et.id, editingTitleValue);
                            setEditingTitleId(null);
                          }}
                          className="text-indigo-500 hover:text-indigo-700"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingTitleId(null)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{et.title}</h3>
                        <button
                          onClick={() => {
                            setEditingTitleId(et.id);
                            setEditingTitleValue(et.title);
                          }}
                          className="text-gray-300 hover:text-indigo-500 transition-colors"
                          title="Rename event type"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="text-sm text-gray-400">{et.duration_minutes} min · /{et.slug}</span>
                  </div>
                  {!et.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      Inactive
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleLock(et)}
                    disabled={savingId === et.id}
                    title={et.is_locked ? "Unlock event type (allow team edits)" : "Lock event type (admin only)"}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      et.is_locked
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {et.is_locked ? (
                      <><Lock className="w-3 h-3" /> Locked</>
                    ) : (
                      <><Unlock className="w-3 h-3" /> Unlocked</>
                    )}
                  </button>
                </div>

                {/* Description */}
                <div className="px-5 sm:px-6 pb-3">
                  {editingDescId === et.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingDescValue}
                        onChange={(e) => setEditingDescValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingDescId(null);
                        }}
                        autoFocus
                        rows={6}
                        maxLength={1000}
                        placeholder="Add a description shown to invitees on the booking page…"
                        className="w-full text-sm leading-relaxed text-gray-700 bg-white border-[1.5px] border-indigo-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-100 resize-y min-h-[140px]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveDescription(et.id, editingDescValue)}
                          disabled={savingId === et.id}
                          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {savingId === et.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingDescId(null)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <span className="text-[10px] text-gray-300 ml-auto">{editingDescValue.length}/1000</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingDescId(et.id);
                        setEditingDescValue(et.description || "");
                      }}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-500 transition-colors group"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {et.description ? (
                        <span className="text-gray-600 group-hover:text-indigo-500 line-clamp-1">{et.description}</span>
                      ) : (
                        <span className="italic">Add description…</span>
                      )}
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Meeting Type */}
                <div className="px-5 sm:px-6 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meeting Type</span>
                    </div>
                    <select
                      value={et.meeting_type || ""}
                      onChange={(e) => handleUpdateMeetingType(et.id, e.target.value || null)}
                      disabled={savingId === et.id}
                      className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    >
                      <option value="">None (default questions)</option>
                      {MEETING_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Settings grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 px-5 sm:px-6 pb-5">
                  {/* Before Buffer */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      Before
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={getEditValue(et.id, "before_buffer_mins", et.before_buffer_mins)}
                        onChange={(e) => setEditValue(et.id, "before_buffer_mins", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Gap before meeting</p>
                  </div>

                  {/* After Buffer */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      <CalendarClock className="w-3.5 h-3.5" />
                      After
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={getEditValue(et.id, "after_buffer_mins", et.after_buffer_mins)}
                        onChange={(e) => setEditValue(et.id, "after_buffer_mins", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Gap after meeting</p>
                  </div>

                  {/* Min Notice */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Notice
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="168"
                        value={getEditValue(et.id, "min_notice_hours", et.min_notice_hours)}
                        onChange={(e) => setEditValue(et.id, "min_notice_hours", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hrs</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Minimum lead time</p>
                  </div>

                  {/* Daily Limit */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      <Hash className="w-3.5 h-3.5" />
                      Daily max
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={getEditValue(et.id, "max_daily_bookings", et.max_daily_bookings)}
                        onChange={(e) => setEditValue(et.id, "max_daily_bookings", e.target.value)}
                        placeholder="No limit"
                        className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all pr-6 placeholder:text-gray-300"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Bookings/day (blank = none)</p>
                  </div>

                  {/* Max Advance Days */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Advance
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="2"
                        max="30"
                        value={getEditValue(et.id, "max_advance_days", et.max_advance_days)}
                        onChange={(e) => setEditValue(et.id, "max_advance_days", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">How far out (2–30)</p>
                  </div>
                </div>

                {/* Booking Questions Section */}
                <div className="px-5 sm:px-6 pb-4">
                  <button
                    onClick={() => setExpandedQuestionsETId(expandedQuestionsETId === et.id ? null : et.id)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors w-full"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Booking Questions
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      ({(getQuestions(et.id)).length})
                    </span>
                    <div className="flex-1" />
                    {expandedQuestionsETId === et.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expandedQuestionsETId === et.id && (
                    <div className="mt-3 space-y-3 animate-fade-in">
                      {getQuestions(et.id).length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">No custom questions yet. Add one below.</p>
                      ) : (
                        getQuestions(et.id).map((q, qi) => (
                          <div key={q.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              {/* Reorder arrows */}
                              <div className="flex flex-col gap-0.5 pt-1">
                                <button
                                  onClick={() => moveQuestion(et.id, q.id, "up")}
                                  disabled={qi === 0}
                                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => moveQuestion(et.id, q.id, "down")}
                                  disabled={qi === getQuestions(et.id).length - 1}
                                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Type badge */}
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-1.5 ${
                                q.type === "text" ? "bg-blue-100 text-blue-700" :
                                q.type === "dropdown" ? "bg-purple-100 text-purple-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                {q.type}
                              </span>

                              {/* Label input */}
                              <input
                                type="text"
                                value={q.label}
                                onChange={(e) => updateQuestion(et.id, q.id, { label: e.target.value })}
                                placeholder="Question label"
                                className="flex-1 text-sm px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                              />

                              {/* Required toggle */}
                              <button
                                onClick={() => updateQuestion(et.id, q.id, { required: !q.required })}
                                title={q.required ? "Required — click to make optional" : "Optional — click to make required"}
                                className={`flex-shrink-0 mt-1 ${q.required ? "text-amber-600" : "text-gray-300 hover:text-gray-500"} transition-colors`}
                              >
                                {q.required ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              </button>
                              <span className="text-[10px] mt-2 text-gray-400 flex-shrink-0 w-12">
                                {q.required ? "Required" : "Optional"}
                              </span>

                              {/* Delete */}
                              <button
                                onClick={() => removeQuestion(et.id, q.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Dropdown options editor */}
                            {q.type === "dropdown" && (
                              <div className="ml-8 space-y-1.5">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Options</span>
                                {(q.options || []).map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...(q.options || [])];
                                        newOpts[oi] = e.target.value;
                                        updateQuestion(et.id, q.id, { options: newOpts });
                                      }}
                                      className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:border-indigo-400 outline-none transition-all"
                                    />
                                    <button
                                      onClick={() => {
                                        const newOpts = (q.options || []).filter((_, j) => j !== oi);
                                        updateQuestion(et.id, q.id, { options: newOpts.length ? newOpts : ["Option 1"] });
                                      }}
                                      className="text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => {
                                    const newOpts = [...(q.options || []), `Option ${(q.options || []).length + 1}`];
                                    updateQuestion(et.id, q.id, { options: newOpts });
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                  + Add option
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {/* Add question buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500 font-medium">Add:</span>
                        <button
                          onClick={() => addQuestion(et.id, "text")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-medium transition-all"
                        >
                          Text
                        </button>
                        <button
                          onClick={() => addQuestion(et.id, "dropdown")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-medium transition-all"
                        >
                          Dropdown
                        </button>
                        <button
                          onClick={() => addQuestion(et.id, "checkbox")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 font-medium transition-all"
                        >
                          Checkbox
                        </button>
                      </div>

                      {/* Save questions button */}
                      {hasQuestionChanges(et.id) && (
                        <div className="pt-2 animate-fade-in">
                          <button
                            onClick={() => handleSaveQuestions(et.id)}
                            disabled={savingQuestionsId === et.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                          >
                            {savingQuestionsId === et.id ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                            ) : savedQuestionsId === et.id ? (
                              <><Check className="w-3.5 h-3.5" /> Saved!</>
                            ) : (
                              <><Save className="w-3.5 h-3.5" /> Save Questions</>
                            )}
                          </button>
                        </div>
                      )}
                      {savedQuestionsId === et.id && !hasQuestionChanges(et.id) && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 animate-fade-in">
                          <Check className="w-3.5 h-3.5" /> Questions saved
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Save button — only show when there are changes */}
                {hasChanges(et) && (
                  <div className="px-5 sm:px-6 pb-5 animate-fade-in">
                    <button
                      onClick={() => handleSave(et)}
                      disabled={savingId === et.id}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {savingId === et.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : savedId === et.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Just-saved confirmation */}
                {savedId === et.id && !hasChanges(et) && (
                  <div className="px-5 sm:px-6 pb-5 animate-fade-in">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <Check className="w-4 h-4" />
                      Saved
                    </span>
                  </div>
                )}

                {/* Delete event type */}
                <div className="px-5 sm:px-6 pb-4 border-t border-gray-100 pt-3">
                  {confirmDeleteETId === et.id ? (
                    <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-3">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-700 flex-1">
                        Delete <strong>{et.title}</strong>? This removes it from all teams and cancels future bookings.
                      </span>
                      <button
                        onClick={() => handleDeleteEventType(et.id)}
                        disabled={deletingET}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {deletingET ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteETId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteETId(et.id)}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete event type
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SMS Beta section */}
        <div className="mt-10 sm:mt-12 bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">SMS Notifications</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">Beta</span>
            </div>
            <button
              onClick={() => {
                setSmsEnabled(!smsEnabled);
              }}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
            >
              {smsEnabled ? (
                <ToggleRight className="w-8 h-8 text-indigo-600" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-300" />
              )}
            </button>
          </div>

          {!smsEnabled ? (
            <p className="text-sm text-gray-400">
              Enable SMS to send text message reminders and workflow notifications to invitees. Requires a Twilio account.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Connect your Twilio account to send SMS notifications. Your credentials are stored securely and only used for sending messages.
              </p>

              {smsLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading SMS settings...
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Account SID</label>
                    <input
                      type="text"
                      value={twilioSid}
                      onChange={(e) => setTwilioSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Auth Token</label>
                    <input
                      type="password"
                      value={twilioToken}
                      onChange={(e) => setTwilioToken(e.target.value)}
                      placeholder="Your Twilio auth token"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={twilioPhone}
                      onChange={(e) => setTwilioPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSaveSms}
                      disabled={smsSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {smsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save SMS Settings
                    </button>
                    {smsSaved && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 animate-fade-in">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help card */}
        <div className="mt-10 sm:mt-12 bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">What do these settings do?</h2>
          <div className="text-sm sm:text-base text-gray-500 space-y-2.5 sm:space-y-3">
            <p>
              <strong>Before/After buffer:</strong> Adds breathing room around each meeting. A 15-minute before buffer means if you have a meeting ending at 1:50 PM, the 2:00 PM slot won&apos;t be offered.
            </p>
            <p>
              <strong>Minimum notice:</strong> How far in advance someone must book. Set to 4 hours and nobody can grab a slot less than 4 hours from now.
            </p>
            <p>
              <strong>Daily max:</strong> Caps bookings per event type per day. Leave empty for no limit. Set to 3 and the 4th person that day will see &quot;no more bookings available.&quot;
            </p>
            <p>
              <strong>Advance:</strong> How many days into the future someone can book. Default is 10 days. Set to 5 and nobody can book more than 5 days out.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
