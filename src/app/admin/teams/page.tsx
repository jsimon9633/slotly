"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  Users,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  Lock,
  Trash2,
  UserPlus,
  Calendar,
  X,
  Save,
} from "lucide-react";
import Link from "next/link";

interface TeamData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  member_count: number;
  event_type_count: number;
}

interface TeamMember {
  membership_id: string;
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface EventTypeData {
  id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  team_id: string;
}

interface AllMember {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

export default function AdminTeamsPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Team detail state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamEventTypes, setTeamEventTypes] = useState<EventTypeData[]>([]);
  const [allMembers, setAllMembers] = useState<AllMember[]>([]);
  const [allTeamsForReassign, setAllTeamsForReassign] = useState<TeamData[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Create team state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teams?token=${encodeURIComponent(token)}`);
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setError("Invalid token.");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setTeams(data);
        setAllTeamsForReassign(data);
      }
    } catch {
      setError("Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) fetchTeams();
  }, [authenticated, fetchTeams]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  // Expand a team → load members + event types
  const expandTeam = async (team: TeamData) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(team.id);
    setEditName(team.name);
    setEditSlug(team.slug);
    setEditDescription(team.description || "");
    setLoadingDetail(true);

    try {
      const [membersRes, eventTypesRes, allMembersRes] = await Promise.all([
        fetch(`/api/admin/teams/${team.id}/members?token=${encodeURIComponent(token)}`),
        fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}&teamId=${team.id}`),
        fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`).then(() =>
          // Fetch all team members (not team-specific)
          fetch(`/api/admin/join-requests?token=${encodeURIComponent(token)}&status=approved`)
        ),
      ]);

      const members = await membersRes.json();
      const eventTypes = await eventTypesRes.json();

      if (Array.isArray(members)) setTeamMembers(members);
      if (Array.isArray(eventTypes)) setTeamEventTypes(eventTypes);

      // Get all team members from join-requests approved list or fallback
      // Actually, let's just query team_members directly via a simpler approach
      // We'll fetch all members by getting all teams' members
      try {
        const allMembersData = await allMembersRes.json();
        // join-requests returns approved members with {id, name, email}
        if (Array.isArray(allMembersData)) {
          setAllMembers(allMembersData.map((m: any) => ({
            id: m.team_member_id || m.id,
            name: m.name,
            email: m.email,
            is_active: true,
          })));
        }
      } catch {
        setAllMembers([]);
      }
    } catch {
      setError("Failed to load team details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Save team edits
  const handleSaveTeam = async () => {
    if (!expandedTeamId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expandedTeamId,
          name: editName,
          slug: editSlug,
          description: editDescription || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Create new team
  const handleCreateTeam = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewDescription("");
        setShowCreate(false);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create team.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  // Add member to team
  const handleAddMember = async (teamId: string, memberId: string) => {
    setActionLoading(`add-${memberId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_member_id: memberId }),
      });
      if (res.ok) {
        // Refresh detail
        const membersRes = await fetch(`/api/admin/teams/${teamId}/members?token=${encodeURIComponent(token)}`);
        const members = await membersRes.json();
        if (Array.isArray(members)) setTeamMembers(members);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add member.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  // Remove member from team
  const handleRemoveMember = async (teamId: string, memberId: string) => {
    setActionLoading(`rm-${memberId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_member_id: memberId }),
      });
      if (res.ok) {
        setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove member.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  // Reassign event type to another team
  const handleReassignEventType = async (eventTypeId: string, newTeamId: string) => {
    setActionLoading(`reassign-${eventTypeId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventTypeId, team_id: newTeamId }),
      });
      if (res.ok) {
        // Refresh event types for current team
        const etRes = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}&teamId=${expandedTeamId}`);
        const eventTypes = await etRes.json();
        if (Array.isArray(eventTypes)) setTeamEventTypes(eventTypes);
        fetchTeams();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to reassign.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  // Members not in current team
  const availableMembers = allMembers.filter(
    (m) => !teamMembers.some((tm) => tm.id === m.id)
  );

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
            Teams
          </div>
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Teams</h1>
              </div>
              <p className="text-base sm:text-lg text-gray-400">
                Manage teams, assign members, and organize event types.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Team
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

        {/* Create Team */}
        {showCreate && (
          <div className="bg-white rounded-xl border-[1.5px] border-indigo-200 p-5 sm:p-6 mb-6 animate-fade-in-up">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Create New Team</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sales, Engineering, Support"
                  className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                />
                {newName.trim() && (
                  <p className="text-xs text-gray-400 mt-1">
                    Slug: <span className="font-mono text-gray-500">{newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What does this team handle?"
                  className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleCreateTeam}
                  disabled={!newName.trim() || creating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create Team</>
                  )}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewName(""); setNewDescription(""); }}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-14 text-gray-300 text-base">
            No teams yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team, i) => (
              <div
                key={team.id}
                className={`bg-white rounded-xl border-[1.5px] overflow-hidden animate-fade-in-up stagger-${i + 1} ${
                  expandedTeamId === team.id ? "border-indigo-200" : "border-gray-100"
                }`}
              >
                {/* Team card header */}
                <button
                  onClick={() => expandTeam(team)}
                  className="w-full flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-5 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg grid place-items-center flex-shrink-0">
                    <Users className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{team.name}</h3>
                      {!team.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                      <span className="font-mono text-xs">/{team.slug}</span>
                      <span>{team.member_count} member{team.member_count !== 1 ? "s" : ""}</span>
                      <span>{team.event_type_count} event type{team.event_type_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {expandedTeamId === team.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded detail panel */}
                {expandedTeamId === team.id && (
                  <div className="border-t border-gray-100 px-5 sm:px-6 pb-5 animate-fade-in">
                    {loadingDetail ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <div className="space-y-6 pt-5">
                        {/* Edit team info */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Team Info</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Slug</label>
                              <input
                                type="text"
                                value={editSlug}
                                onChange={(e) => setEditSlug(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono"
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-1">Description</label>
                            <input
                              type="text"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="What does this team handle?"
                              className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>
                          {(editName !== team.name || editSlug !== team.slug || editDescription !== (team.description || "")) && (
                            <button
                              onClick={handleSaveTeam}
                              disabled={saving}
                              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                              {saving ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                              ) : saved ? (
                                <><Check className="w-3.5 h-3.5" /> Saved!</>
                              ) : (
                                <><Save className="w-3.5 h-3.5" /> Save Changes</>
                              )}
                            </button>
                          )}
                          {saved && editName === team.name && editSlug === team.slug && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 mt-3">
                              <Check className="w-4 h-4" /> Saved
                            </span>
                          )}
                        </div>

                        {/* Members section */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <UserPlus className="w-3.5 h-3.5" />
                            Members ({teamMembers.length})
                          </h4>
                          {teamMembers.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No members in this team yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {teamMembers.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5"
                                >
                                  <div className="w-7 h-7 bg-indigo-100 rounded-full grid place-items-center text-xs font-bold text-indigo-600 flex-shrink-0">
                                    {m.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-900">{m.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">{m.email}</span>
                                  </div>
                                  <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                                    {m.role}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveMember(team.id, m.id)}
                                    disabled={actionLoading === `rm-${m.id}`}
                                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                    title="Remove from team"
                                  >
                                    {actionLoading === `rm-${m.id}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add member */}
                          {availableMembers.length > 0 && (
                            <div className="mt-3">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddMember(team.id, e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                                className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-gray-500"
                                defaultValue=""
                              >
                                <option value="" disabled>+ Add a member to this team...</option>
                                {availableMembers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.email})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Event Types section */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Event Types ({teamEventTypes.length})
                          </h4>
                          {teamEventTypes.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No event types assigned to this team.</p>
                          ) : (
                            <div className="space-y-2">
                              {teamEventTypes.map((et) => (
                                <div
                                  key={et.id}
                                  className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5"
                                >
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: et.color }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-900">{et.title}</span>
                                    <span className="text-xs text-gray-400 ml-2">{et.duration_minutes} min</span>
                                  </div>
                                  {/* Reassign dropdown */}
                                  {allTeamsForReassign.length > 1 && (
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value && e.target.value !== team.id) {
                                          handleReassignEventType(et.id, e.target.value);
                                          e.target.value = team.id;
                                        }
                                      }}
                                      defaultValue={team.id}
                                      disabled={actionLoading === `reassign-${et.id}`}
                                      className="text-xs bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-500 focus:border-indigo-400 outline-none disabled:opacity-50"
                                      title="Move to another team"
                                    >
                                      {allTeamsForReassign.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.id === team.id ? `${t.name} (current)` : t.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
