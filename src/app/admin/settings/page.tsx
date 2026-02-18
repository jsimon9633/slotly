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
} from "lucide-react";
import Link from "next/link";

interface EventTypeSettings {
  id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  is_locked: boolean;
  before_buffer_mins: number;
  after_buffer_mins: number;
  min_notice_hours: number;
  max_daily_bookings: number | null;
  max_advance_days: number;
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
            Team
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
            href="/admin/webhooks"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Webhooks
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
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Scheduling Settings</h1>
          </div>
          <p className="text-base sm:text-lg text-gray-400">
            Configure buffer times, minimum notice, and daily limits for each event type.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600 animate-fade-in">
            {error}
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
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{et.title}</h3>
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
              </div>
            ))}
          </div>
        )}

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
