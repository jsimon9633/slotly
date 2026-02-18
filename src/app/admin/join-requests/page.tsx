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

export default function AdminJoinRequestsPage() {
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
    if (!token.trim()) return;
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
        <div className="w-full max-w-[360px] animate-fade-in-up">
          <div className="flex items-center gap-2 justify-center mb-6">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg grid place-items-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">Slotly</span>
            <span className="text-xs text-gray-300 ml-1">Admin</span>
          </div>

          <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Enter admin token</h2>
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Admin token"
              className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
            />
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <button
              onClick={handleLogin}
              className="mt-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
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
      <header className="max-w-[680px] mx-auto flex items-center justify-between px-4 sm:px-5 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg grid place-items-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">Slotly</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold ml-1">
            Admin
          </span>
        </div>
        <Link
          href="/"
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </Link>
      </header>

      <main className="max-w-[680px] mx-auto px-4 sm:px-5 pt-6 sm:pt-8 pb-12">
        {/* Title */}
        <div className="mb-5 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-indigo-500" />
            <h1 className="text-lg font-bold text-gray-900">Team Management</h1>
          </div>
          <p className="text-sm text-gray-400">
            Generate invite links and manage join requests.
          </p>
        </div>

        {/* Generate invite card */}
        <div className="bg-white rounded-xl border-[1.5px] border-indigo-100 p-4 mb-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-900">Invite a new team member</h2>
            </div>
            <button
              onClick={generateInvite}
              disabled={generatingInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {generatingInvite ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <LinkIcon className="w-3 h-3" />
              )}
              Generate link
            </button>
          </div>

          {newInviteLink && (
            <div className="mt-2 animate-fade-in">
              <p className="text-[11px] text-gray-400 mb-1.5">
                Share this link (expires in 7 days):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-indigo-600 break-all">
                  {newInviteLink}
                </code>
                <button
                  onClick={() => copyInviteLink(newInviteLink)}
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {copiedInvite === "new" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab toggle: Requests vs Invites */}
        <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-0.5 animate-fade-in">
          <button
            onClick={() => setTab("requests")}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
              tab === "requests" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Join Requests
          </button>
          <button
            onClick={() => setTab("invites")}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
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
            <div className="flex items-center gap-2 mb-4 animate-fade-in">
              {(["pending", "approved", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize ${
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
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Request cards */}
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton h-48 rounded-xl" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-12 text-gray-300 text-sm animate-fade-in">
                  No {filter} requests.
                </div>
              ) : (
                requests.map((req, i) => (
                  <div
                    key={req.id}
                    className={`bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up stagger-${i + 1}`}
                  >
                    {/* Person info */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {req.name}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {req.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className="w-3 h-3 text-gray-300" />
                        <span className="text-gray-400">{formatDate(req.created_at)}</span>
                      </div>
                    </div>

                    {/* Calendar status */}
                    <div className="flex items-center gap-1.5 text-xs mb-3">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-500">Calendar shared:</span>
                      {req.calendar_shared ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium flex items-center gap-0.5">
                          <XCircle className="w-3 h-3" /> No
                        </span>
                      )}
                    </div>

                    {/* SQL block (only for pending) */}
                    {filter === "pending" && (
                      <>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">
                          SQL to run after approving
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto whitespace-pre max-h-[180px]">
                          {generateSQL(req)}
                        </div>
                        <button
                          onClick={() => copySQL(req)}
                          className="mt-2 text-xs font-medium flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
                        >
                          {copiedId === req.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy SQL
                            </>
                          )}
                        </button>
                      </>
                    )}

                    {/* Action buttons (only for pending) */}
                    {filter === "pending" && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => updateStatus(req.id, "approved")}
                          disabled={updatingId === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all disabled:opacity-50"
                        >
                          {updatingId === req.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(req.id, "rejected")}
                          disabled={updatingId === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
                        >
                          {updatingId === req.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
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
          <div className="space-y-2 animate-fade-in">
            {invites.length === 0 ? (
              <div className="text-center py-12 text-gray-300 text-sm">
                No invites generated yet.
              </div>
            ) : (
              invites.map((inv) => {
                const expired = isExpired(inv.expires_at);
                const fullLink = `${typeof window !== "undefined" ? window.location.origin : ""}/join?invite=${inv.token}`;
                return (
                  <div
                    key={inv.id}
                    className={`bg-white rounded-xl border-[1.5px] p-3 ${
                      inv.is_used
                        ? "border-emerald-100"
                        : expired
                        ? "border-red-100"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
                        <code className="text-[11px] text-gray-500">
                          ...{inv.token.slice(-12)}
                        </code>
                        {inv.is_used ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">
                            Used by {inv.used_by_email}
                          </span>
                        ) : expired ? (
                          <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-semibold">
                            Expired
                          </span>
                        ) : (
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          Expires {formatDate(inv.expires_at)}
                        </span>
                        {!inv.is_used && !expired && (
                          <button
                            onClick={() => copyInviteLink(fullLink, inv.id)}
                            className="p-1 rounded hover:bg-gray-100 transition-colors"
                          >
                            {copiedInvite === inv.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
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
        <div className="mt-8 bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">How it works</h2>
          <div className="text-xs text-gray-500 space-y-2">
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
