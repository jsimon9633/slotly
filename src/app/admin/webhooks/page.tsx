"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  Webhook,
  Lock,
  Loader2,
  Check,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

const EVENT_OPTIONS = [
  { value: "booking.created", label: "Booking Created" },
  { value: "booking.cancelled", label: "Booking Cancelled" },
  { value: "booking.rescheduled", label: "Booking Rescheduled" },
];

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string;
  created_at: string;
}

interface WebhookLogItem {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  created_at: string;
}

export default function AdminWebhooksPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [logs, setLogs] = useState<WebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New webhook form
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["booking.created"]);
  const [creating, setCreating] = useState(false);

  // Secret visibility per webhook
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  // Saving state
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/webhooks?token=${encodeURIComponent(token)}`);
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setError("Invalid token.");
        return;
      }
      const data = await res.json();
      if (data.webhooks) setWebhooks(data.webhooks);
      if (data.logs) setLogs(data.logs);
    } catch {
      setError("Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) fetchWebhooks();
  }, [authenticated, fetchWebhooks]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  const handleCreate = async () => {
    if (!newUrl.trim() || newEvents.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/webhooks?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), events: newEvents }),
      });
      if (res.ok) {
        setNewUrl("");
        setNewEvents(["booking.created"]);
        setShowForm(false);
        fetchWebhooks();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create webhook.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (wh: WebhookItem) => {
    setSavingId(wh.id);
    try {
      await fetch(`/api/admin/webhooks?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wh.id, is_active: !wh.is_active }),
      });
      fetchWebhooks();
    } catch {
      setError("Failed to toggle webhook.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    setSavingId(id);
    try {
      await fetch(`/api/admin/webhooks?token=${encodeURIComponent(token)}&id=${id}`, {
        method: "DELETE",
      });
      fetchWebhooks();
    } catch {
      setError("Failed to delete webhook.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleEventSelection = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getLogsForWebhook = (webhookId: string) =>
    logs.filter((l) => l.webhook_id === webhookId).slice(0, 5);

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
            Webhooks
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Webhook className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Webhooks</h1>
              </div>
              <p className="text-base sm:text-lg text-gray-400">
                Send real-time POST notifications when bookings are created, cancelled, or rescheduled.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Webhook</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600 animate-fade-in">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              dismiss
            </button>
          </div>
        )}

        {/* New webhook form */}
        {showForm && (
          <div className="bg-white rounded-xl border-[1.5px] border-indigo-100 p-5 sm:p-6 mb-6 animate-fade-in-up">
            <h3 className="text-base font-semibold text-gray-900 mb-4">New Webhook</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-4 py-3 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Events
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleEventSelection(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                        newEvents.includes(opt.value)
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newUrl.trim() || newEvents.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Check className="w-4 h-4" /> Create Webhook</>
                  )}
                </button>
                <button
                  onClick={() => setShowForm(false)}
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
        ) : webhooks.length === 0 ? (
          <div className="text-center py-14">
            <Webhook className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-base">No webhooks configured yet.</p>
            <p className="text-gray-300 text-sm mt-1">
              Add one to get real-time notifications when bookings happen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((wh, i) => {
              const whLogs = getLogsForWebhook(wh.id);
              return (
                <div
                  key={wh.id}
                  className={`bg-white rounded-xl border-[1.5px] border-gray-100 overflow-hidden animate-fade-in-up stagger-${i + 1}`}
                >
                  {/* Webhook header */}
                  <div className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            wh.is_active ? "bg-emerald-400" : "bg-gray-300"
                          }`}
                        />
                        <code className="text-sm font-mono text-gray-700 truncate block">
                          {wh.url}
                        </code>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {wh.events.map((ev) => (
                          <span
                            key={ev}
                            className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full font-medium"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleActive(wh)}
                        disabled={savingId === wh.id}
                        title={wh.is_active ? "Disable" : "Enable"}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                      >
                        {wh.is_active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        disabled={savingId === wh.id}
                        title="Delete webhook"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Secret */}
                  <div className="px-5 sm:px-6 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Signing Secret
                      </span>
                      <button
                        onClick={() => toggleSecretVisibility(wh.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {visibleSecrets.has(wh.id) ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(wh.secret)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy secret"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <code className="text-xs text-gray-400 font-mono mt-1 block">
                      {visibleSecrets.has(wh.id)
                        ? wh.secret
                        : "••••••••••••••••••••••••••••••••"}
                    </code>
                  </div>

                  {/* Recent deliveries */}
                  {whLogs.length > 0 && (
                    <div className="px-5 sm:px-6 pb-5 border-t border-gray-50 pt-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                        Recent Deliveries
                      </span>
                      <div className="space-y-1">
                        {whLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center gap-2 text-xs text-gray-500"
                          >
                            {log.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            )}
                            <span className="font-medium">{log.event}</span>
                            <span className="text-gray-300">
                              {log.status_code ? `${log.status_code}` : "err"}
                            </span>
                            <span className="text-gray-300 ml-auto">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Help card */}
        <div
          className="mt-10 sm:mt-12 bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            How webhooks work
          </h2>
          <div className="text-sm sm:text-base text-gray-500 space-y-2.5 sm:space-y-3">
            <p>
              <strong>Delivery:</strong> Slotly sends a POST request to your endpoint with a JSON
              payload containing the event type and booking details.
            </p>
            <p>
              <strong>Signing:</strong> Each request includes an <code className="text-xs bg-gray-50 px-1 py-0.5 rounded">X-Slotly-Signature</code> header
              — an HMAC-SHA256 of the request body using your signing secret. Verify this to confirm the request came from Slotly.
            </p>
            <p>
              <strong>Retries:</strong> Failed deliveries (5xx or network errors) are retried up to 3 times with exponential backoff.
              Client errors (4xx except 429) are not retried.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
