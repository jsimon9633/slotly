"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  User,
  Mail,
  Calendar,
  Lock,
  LinkIcon,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface JoinRequest {
  id: string;
  name: string;
  email: string;
  calendar_shared: boolean;
  status: string;
  created_at: string;
}

interface InviteToken {
  id: string;
  token: string;
  is_used: boolean;
  used_by_email: string | null;
  expires_at: string;
  created_at: string;
}

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

export default function AdminJoinRequestsPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [tab, setTab] = useState<"requests" | "invites">("requests");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showUsedInvites, setShowUsedInvites] = useState(false);

  // Check saved token on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/join-requests?token=${encodeURIComponent(token)}&status=${filter}`);
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setError("Invalid token.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch {
      setError("Failed to fetch requests.");
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  const fetchInvites = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/invite?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setInvites(data);
      }
    } catch {
      // Silent fail for invites list
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) {
      fetchRequests();
      fetchInvites();
    }
  }, [authenticated, filter, fetchRequests, fetchInvites]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    setNewInviteLink(null);
    try {
      const res = await fetch(`/api/admin/invite?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      const data = await res.json();
      if (res.ok && data.link) {
        const fullLink = `${window.location.origin}${data.link}`;
        setNewInviteLink(fullLink);
        fetchInvites();
      }
    } catch {
      setError("Failed to generate invite.");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteLink = (link: string, id?: string) => {
    navigator.clipboard.writeText(link);
    if (id) {
      setCopiedInvite(id);
      setTimeout(() => setCopiedInvite(null), 2000);
    } else {
      setCopiedInvite("new");
      setTimeout(() => setCopiedInvite(null), 2000);
    }
  };

  const cancelInvite = async (id: string) => {
    if (!confirm("Cancel this invite? The link will stop working immediately.")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/invite?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchInvites();
      } else {
        setError("Failed to cancel invite.");
      }
    } catch {
      setError("Failed to cancel invite.");
    } finally {
      setCancellingId(null);
    }
  };

  const updateStatus = async (id: string, newStatus: "approved" | "rejected") => {
    setUpdatingId(id);
    try {
      await fetch(`/api/admin/join-requests?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchRequests();
    } catch {
      setError("Failed to update.");
    } finally {
      setUpdatingId(null);
    }
  };

  const generateSQL = (req: JoinRequest) => {
    const firstName = req.name.split(" ")[0];
    return `-- Add ${firstName} to the round-robin
-- Step 1: Insert team member
INSERT INTO team_members (name, email, google_calendar_id, is_active, last_booked_at)
VALUES ('${req.name}', '${req.email}', '${req.email}', true, now());

-- Step 2: Add default availability (Mon-Fri 9am-5pm)
INSERT INTO availability_rules (team_member_id, day_of_week, start_time, end_time)
SELECT id, d.day, '09:00', '17:00'
FROM team_members, unnest(ARRAY[1,2,3,4,5]) AS d(day)
WHERE email = '${req.email}';`;
  };

  const copySQL = (req: JoinRequest) => {
    navigator.clipboard.writeText(generateSQL(req));
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isExpired = (iso: string) => new Date(iso) < new Date();

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
                autoComplete="username"
                className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
              />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Password"
                autoComplete="current-password"
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
      {/* Header — logo not clickable in admin */}
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
          <div className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center bg-white text-gray-900 shadow-sm whitespace-nowrap px-2">
            People
          </div>
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
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team Management</h1>
          </div>
          <p className="text-base sm:text-lg text-gray-400">
            Generate invite links and manage join requests.
          </p>
        </div>

        {/* Generate invite card */}
        <div className="bg-white rounded-xl border-[1.5px] border-indigo-100 p-5 sm:p-6 mb-6 sm:mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Send className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Invite a new team member</h2>
            </div>
            <button
              onClick={generateInvite}
              disabled={generatingInvite}
              className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg text-sm sm:text-base font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {generatingInvite ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              Generate link
            </button>
          </div>

          {newInviteLink && (
            <div className="mt-3 animate-fade-in">
              <p className="text-sm sm:text-base text-gray-400 mb-2">
                Share this link (expires in 7 days):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm sm:text-base bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-indigo-600 break-all">
                  {newInviteLink}
                </code>
                <button
                  onClick={() => copyInviteLink(newInviteLink)}
                  className="flex-shrink-0 p-2.5 sm:p-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {copiedInvite === "new" ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab toggle: Requests vs Invites */}
        <div className="flex items-center gap-1 mb-5 sm:mb-6 bg-gray-100 rounded-lg p-1 sm:p-1.5 animate-fade-in">
          <button
            onClick={() => setTab("requests")}
            className={`flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md transition-all ${
              tab === "requests" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Join Requests
          </button>
          <button
            onClick={() => setTab("invites")}
            className={`flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md transition-all ${
              tab === "invites" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Invite Links ({invites.filter((i) => !i.is_used && !isExpired(i.expires_at)).length} active)
          </button>
        </div>

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <>
            {/* Filter tabs + refresh */}
            <div className="flex items-center gap-2 mb-5 sm:mb-6 animate-fade-in">
              {(["pending", "approved", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-sm sm:text-base font-semibold px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all capitalize ${
                    filter === f
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={fetchRequests}
                className="ml-auto p-2 sm:p-2.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Request cards */}
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton h-52 rounded-xl" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-14 text-gray-300 text-base animate-fade-in">
                  No {filter} requests.
                </div>
              ) : (
                requests.map((req, i) => (
                  <div
                    key={req.id}
                    className={`bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up stagger-${i + 1}`}
                  >
                    {/* Person info */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                          {req.name}
                        </div>
                        <div className="text-sm sm:text-base text-gray-400 flex items-center gap-2 mt-1">
                          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {req.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm sm:text-base">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
                        <span className="text-gray-400">{formatDate(req.created_at)}</span>
                      </div>
                    </div>

                    {/* Calendar status */}
                    <div className="flex items-center gap-2 text-sm sm:text-base mb-4">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      <span className="text-gray-500">Calendar shared:</span>
                      {req.calendar_shared ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> Yes
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium flex items-center gap-1">
                          <XCircle className="w-4 h-4 sm:w-5 sm:h-5" /> No
                        </span>
                      )}
                    </div>

                    {/* SQL block (only for pending) */}
                    {filter === "pending" && (
                      <>
                        <div className="text-xs sm:text-sm uppercase tracking-wide text-gray-400 font-semibold mb-2">
                          SQL to run after approving
                        </div>
                        <div className="bg-gray-900 rounded-lg p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed text-gray-300 overflow-x-auto whitespace-pre max-h-[200px] sm:max-h-[260px]">
                          {generateSQL(req)}
                        </div>
                        <button
                          onClick={() => copySQL(req)}
                          className="mt-3 text-sm sm:text-base font-medium flex items-center gap-1.5 text-indigo-500 hover:text-indigo-700 transition-colors"
                        >
                          {copiedId === req.id ? (
                            <>
                              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                              <span className="text-emerald-500">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                              Copy SQL
                            </>
                          )}
                        </button>
                      </>
                    )}

                    {/* Action buttons (only for pending) */}
                    {filter === "pending" && (
                      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => updateStatus(req.id, "approved")}
                          disabled={updatingId === req.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all disabled:opacity-50"
                        >
                          {updatingId === req.id ? (
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(req.id, "rejected")}
                          disabled={updatingId === req.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
                        >
                          {updatingId === req.id ? (
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* INVITES TAB */}
        {tab === "invites" && (
          <div className="space-y-3 animate-fade-in">
            {/* Show used toggle */}
            {invites.some((i) => i.is_used) && (
              <div className="flex items-center justify-end mb-1">
                <button
                  onClick={() => setShowUsedInvites(!showUsedInvites)}
                  className={`text-sm font-medium px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all ${
                    showUsedInvites
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {showUsedInvites ? "Hide" : "Show"} used invites
                  {!showUsedInvites && ` (${invites.filter((i) => i.is_used).length})`}
                </button>
              </div>
            )}
            {invites.filter((i) => showUsedInvites || !i.is_used).length === 0 ? (
              <div className="text-center py-14 text-gray-300 text-base sm:text-lg">
                No invites generated yet.
              </div>
            ) : (
              invites.filter((i) => showUsedInvites || !i.is_used).map((inv) => {
                const expired = isExpired(inv.expires_at);
                const fullLink = `${typeof window !== "undefined" ? window.location.origin : ""}/join?invite=${inv.token}`;
                return (
                  <div
                    key={inv.id}
                    className={`bg-white rounded-xl border-[1.5px] p-4 sm:p-5 ${
                      inv.is_used
                        ? "border-emerald-100"
                        : expired
                        ? "border-red-100"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        <code className="text-sm sm:text-base text-gray-500">
                          ...{inv.token.slice(-12)}
                        </code>
                        {inv.is_used ? (
                          <span className="text-xs sm:text-sm bg-emerald-50 text-emerald-600 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-semibold">
                            Used by {inv.used_by_email}
                          </span>
                        ) : expired ? (
                          <span className="text-xs sm:text-sm bg-red-50 text-red-500 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-semibold">
                            Expired
                          </span>
                        ) : (
                          <span className="text-xs sm:text-sm bg-indigo-50 text-indigo-600 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span className="text-xs sm:text-sm text-gray-400">
                          Expires {formatDate(inv.expires_at)}
                        </span>
                        {!inv.is_used && !expired && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyInviteLink(fullLink, inv.id)}
                              className="p-1.5 sm:p-2 rounded hover:bg-gray-100 transition-colors"
                              title="Copy link"
                            >
                              {copiedInvite === inv.id ? (
                                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                              )}
                            </button>
                            <button
                              onClick={() => cancelInvite(inv.id)}
                              disabled={cancellingId === inv.id}
                              className="p-1.5 sm:p-2 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Cancel invite"
                            >
                              {cancellingId === inv.id ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 hover:text-red-500" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Instructions card */}
        <div className="mt-10 sm:mt-12 bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">How it works</h2>
          <div className="text-sm sm:text-base text-gray-500 space-y-2.5 sm:space-y-3">
            <p>
              <strong>1.</strong> Click &quot;Generate link&quot; to create a unique invite URL.
            </p>
            <p>
              <strong>2.</strong> Send the link to the new team member. It expires in 7 days and is single-use.
            </p>
            <p>
              <strong>3.</strong> They fill in their info and share their Google Calendar.
            </p>
            <p>
              <strong>4.</strong> Their request appears in &quot;Join Requests&quot; → copy the SQL, run it in Supabase, then Approve.
            </p>
            <p>
              <strong>5.</strong> They&apos;re live in the round-robin — Slotly reads their Google Calendar for availability.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
