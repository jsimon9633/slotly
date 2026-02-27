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
  AlertTriangle,
  Pencil,
  RefreshCw,
  Copy,
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
  avatar_url: string | null;
  connection_status: "connected" | "revoked" | "service_account";
}

interface EventTypeData {
  id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  team_ids: string[];
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
  const [allEventTypes, setAllEventTypes] = useState<EventTypeData[]>([]);
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
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [newTeamId, setNewTeamId] = useState<string | null>(null);
  const [selectedCreateMembers, setSelectedCreateMembers] = useState<string[]>([]);
  const [addingCreateMembers, setAddingCreateMembers] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Re-auth state
  const [reauthLoading, setReauthLoading] = useState<string | null>(null);
  const [reauthLink, setReauthLink] = useState<{ memberId: string; url: string } | null>(null);
  const [copiedReauth, setCopiedReauth] = useState<string | null>(null);

  // Inline event type rename state
  const [editingEventTypeId, setEditingEventTypeId] = useState<string | null>(null);
  const [editingEventTypeTitle, setEditingEventTypeTitle] = useState("");

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
      }
    } catch {
      setError("Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAllMembers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/team-members?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllMembers(data);
      }
    } catch {
      setAllMembers([]);
    }
  }, [token]);

  const fetchAllEventTypes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllEventTypes(data);
      }
    } catch {
      setAllEventTypes([]);
    }
  }, [token]);

  useEffect(() => {
    if (authenticated) {
      fetchTeams();
      fetchAllMembers();
      fetchAllEventTypes();
    }
  }, [authenticated, fetchTeams, fetchAllMembers, fetchAllEventTypes]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  // Expand a team → load members + event types for that team
  const expandTeam = async (team: TeamData) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(team.id);
    setEditName(team.name);
    setEditSlug(team.slug);
    setEditDescription(team.description || "");
    setConfirmDeleteId(null);
    setLoadingDetail(true);

    try {
      const [membersRes, eventTypesRes] = await Promise.all([
        fetch(`/api/admin/teams/${team.id}/members?token=${encodeURIComponent(token)}`),
        fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}&teamId=${team.id}`),
      ]);

      const members = await membersRes.json();
      const eventTypes = await eventTypesRes.json();

      if (Array.isArray(members)) setTeamMembers(members);
      if (Array.isArray(eventTypes)) setTeamEventTypes(eventTypes);
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

  // Create new team — step 1: name + description, step 2: add members
  // Auto-assigns all event types to the new team via join table
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
        const team = await res.json();
        setNewTeamId(team.id);

        // Auto-assign all event types to the new team via join table
        for (const et of allEventTypes) {
          await fetch(`/api/admin/team-event-links?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_id: team.id, event_type_id: et.id }),
          });
        }

        setCreateStep(2);
        fetchTeams();
        fetchAllEventTypes();
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

  // Add selected members to newly created team
  const handleAddCreateMembers = async () => {
    if (!newTeamId || selectedCreateMembers.length === 0) {
      resetCreateForm();
      return;
    }
    setAddingCreateMembers(true);
    setError(null);
    try {
      for (const memberId of selectedCreateMembers) {
        await fetch(`/api/admin/teams/${newTeamId}/members?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team_member_id: memberId }),
        });
      }
      fetchTeams();
      resetCreateForm();
    } catch {
      setError("Failed to add some members.");
    } finally {
      setAddingCreateMembers(false);
    }
  };

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewName("");
    setNewDescription("");
    setCreateStep(1);
    setNewTeamId(null);
    setSelectedCreateMembers([]);
  };

  const toggleCreateMember = (memberId: string) => {
    setSelectedCreateMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  // Delete team
  const handleDeleteTeam = async (teamId: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId }),
      });
      if (res.ok) {
        setExpandedTeamId(null);
        setConfirmDeleteId(null);
        fetchTeams();
        fetchAllEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete team.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(false);
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

  // Generate re-auth link for a member
  const handleGenerateReauth = async (memberId: string) => {
    setReauthLoading(memberId);
    setReauthLink(null);
    try {
      const res = await fetch(`/api/auth/status?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (res.ok && data.reauth_url) {
        setReauthLink({ memberId, url: data.reauth_url });
      } else {
        setError(data.error || "Failed to generate re-auth link.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setReauthLoading(null);
    }
  };

  const copyReauthLink = (memberId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedReauth(memberId);
    setTimeout(() => setCopiedReauth(null), 2000);
  };

  // Add event type to team via join table
  const handleLinkEventType = async (eventTypeId: string, teamId: string) => {
    setActionLoading(`link-${eventTypeId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team-event-links?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, event_type_id: eventTypeId }),
      });
      if (res.ok) {
        // Refresh event types for current team
        const etRes = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}&teamId=${expandedTeamId}`);
        const eventTypes = await etRes.json();
        if (Array.isArray(eventTypes)) setTeamEventTypes(eventTypes);
        fetchTeams();
        fetchAllEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add event type.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  // Remove event type from team via join table
  const handleUnlinkEventType = async (eventTypeId: string, teamId: string) => {
    setActionLoading(`unlink-${eventTypeId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team-event-links?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, event_type_id: eventTypeId }),
      });
      if (res.ok) {
        setTeamEventTypes((prev) => prev.filter((et) => et.id !== eventTypeId));
        fetchTeams();
        fetchAllEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove event type.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  };

  // Rename event type title
  const handleRenameEventType = async (eventTypeId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setActionLoading(`rename-${eventTypeId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventTypeId, title: newTitle.trim() }),
      });
      if (res.ok) {
        const etRes = await fetch(`/api/admin/event-types?token=${encodeURIComponent(token)}&teamId=${expandedTeamId}`);
        const eventTypes = await etRes.json();
        if (Array.isArray(eventTypes)) setTeamEventTypes(eventTypes);
        fetchAllEventTypes();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to rename.");
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

  // Event types not yet assigned to this team (but may be in other teams)
  const unlinkedEventTypes = allEventTypes.filter(
    (et) => !teamEventTypes.some((tet) => tet.id === et.id)
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
            People
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
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Teams</h1>
              </div>
              <p className="text-base sm:text-lg text-gray-400">
                Manage teams, assign members, and organize event types.
              </p>
            </div>
            <button
              onClick={() => { setShowCreate(!showCreate); setCreateStep(1); setNewTeamId(null); setSelectedCreateMembers([]); }}
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
            {createStep === 1 ? (
              <>
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
                        <>Next: Add Members</>
                      )}
                    </button>
                    <button
                      onClick={resetCreateForm}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Add Members to {newName}</h3>
                <p className="text-sm text-gray-400 mb-4">Select team members to add, or skip this step.</p>

                {allMembers.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3">No team members found. You can add members later from the team detail view.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {allMembers.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                          selectedCreateMembers.includes(m.id) ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50 border border-transparent hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCreateMembers.includes(m.id)}
                          onChange={() => toggleCreateMember(m.id)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="w-7 h-7 bg-indigo-100 rounded-full grid place-items-center text-xs font-bold text-indigo-600 flex-shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{m.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{m.email}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAddCreateMembers}
                    disabled={addingCreateMembers}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {addingCreateMembers ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                    ) : selectedCreateMembers.length > 0 ? (
                      <><UserPlus className="w-4 h-4" /> Add {selectedCreateMembers.length} Member{selectedCreateMembers.length !== 1 ? "s" : ""} &amp; Finish</>
                    ) : (
                      <>Skip &amp; Finish</>
                    )}
                  </button>
                  <button
                    onClick={resetCreateForm}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
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
                                <div key={m.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                                  <div className="flex items-center gap-3">
                                    {/* Avatar or initial */}
                                    <div className="relative flex-shrink-0">
                                      {m.avatar_url ? (
                                        <img
                                          src={m.avatar_url}
                                          alt=""
                                          className="w-7 h-7 rounded-full"
                                        />
                                      ) : (
                                        <div className="w-7 h-7 bg-indigo-100 rounded-full grid place-items-center text-xs font-bold text-indigo-600">
                                          {m.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      {/* Connection status dot */}
                                      <div
                                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-50 ${
                                          m.connection_status === "connected"
                                            ? "bg-emerald-400"
                                            : m.connection_status === "revoked"
                                            ? "bg-red-400"
                                            : "bg-amber-400"
                                        }`}
                                        title={
                                          m.connection_status === "connected"
                                            ? "Calendar connected via OAuth"
                                            : m.connection_status === "revoked"
                                            ? "Calendar disconnected — needs re-auth"
                                            : "Using service account (not OAuth)"
                                        }
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-medium text-gray-900">{m.name}</span>
                                      <span className="text-xs text-gray-400 ml-2">{m.email}</span>
                                    </div>
                                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                                      {m.role}
                                    </span>
                                    {/* Re-auth button for non-connected members */}
                                    {m.connection_status !== "connected" && (
                                      <button
                                        onClick={() => handleGenerateReauth(m.id)}
                                        disabled={reauthLoading === m.id}
                                        className="text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                                        title="Generate OAuth re-auth link"
                                      >
                                        {reauthLoading === m.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
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
                                  {/* Re-auth link display */}
                                  {reauthLink?.memberId === m.id && (
                                    <div className="mt-2 flex items-center gap-2 animate-fade-in">
                                      <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1.5 text-indigo-600 break-all">
                                        {reauthLink.url}
                                      </code>
                                      <button
                                        onClick={() => copyReauthLink(m.id, reauthLink.url)}
                                        className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 transition-colors"
                                        title="Copy link"
                                      >
                                        {copiedReauth === m.id ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

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
                          {availableMembers.length === 0 && allMembers.length === 0 && (
                            <p className="text-xs text-gray-400 mt-2">
                              No team members exist yet. Add people in the People tab first, or approve join requests.
                            </p>
                          )}
                        </div>

                        {/* Event Types section */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Event Types ({teamEventTypes.length})
                          </h4>
                          <p className="text-xs text-gray-400 mb-2">
                            Event types can belong to multiple teams.
                          </p>
                          {teamEventTypes.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No event types assigned to this team.</p>
                          ) : (
                            <div className="space-y-2">
                              {teamEventTypes.map((et) => {
                                // Show which other teams this event type belongs to
                                const otherTeams = (et.team_ids || [])
                                  .filter((tid: string) => tid !== team.id)
                                  .map((tid: string) => teams.find((t) => t.id === tid))
                                  .filter(Boolean);

                                return (
                                  <div
                                    key={et.id}
                                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5"
                                  >
                                    <div
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: et.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      {editingEventTypeId === et.id ? (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={editingEventTypeTitle}
                                            onChange={(e) => setEditingEventTypeTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                handleRenameEventType(et.id, editingEventTypeTitle);
                                                setEditingEventTypeId(null);
                                              }
                                              if (e.key === "Escape") setEditingEventTypeId(null);
                                            }}
                                            autoFocus
                                            className="text-sm font-medium text-gray-900 bg-white border border-indigo-300 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100 w-full"
                                          />
                                          <button
                                            onClick={() => {
                                              handleRenameEventType(et.id, editingEventTypeTitle);
                                              setEditingEventTypeId(null);
                                            }}
                                            className="text-indigo-500 hover:text-indigo-700"
                                            title="Save"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => setEditingEventTypeId(null)}
                                            className="text-gray-400 hover:text-gray-600"
                                            title="Cancel"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-gray-900">{et.title}</span>
                                            <button
                                              onClick={() => {
                                                setEditingEventTypeId(et.id);
                                                setEditingEventTypeTitle(et.title);
                                              }}
                                              className="text-gray-300 hover:text-indigo-500 transition-colors"
                                              title="Rename event type"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs text-gray-400 ml-1">{et.duration_minutes} min</span>
                                          </div>
                                          {otherTeams.length > 0 && (
                                            <span className="text-[10px] text-gray-400">
                                              Also in: {otherTeams.map((t: any) => t.name).join(", ")}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleUnlinkEventType(et.id, team.id)}
                                      disabled={actionLoading === `unlink-${et.id}`}
                                      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                      title="Remove from this team"
                                    >
                                      {actionLoading === `unlink-${et.id}` ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <X className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add event type dropdown — shows event types not yet in this team */}
                          {unlinkedEventTypes.length > 0 && (
                            <div className="mt-3">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleLinkEventType(e.target.value, team.id);
                                    e.target.value = "";
                                  }
                                }}
                                className="w-full px-3 py-2.5 text-sm bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-gray-500"
                                defaultValue=""
                              >
                                <option value="" disabled>+ Add an event type to this team...</option>
                                {unlinkedEventTypes.map((et) => {
                                  const inTeams = (et.team_ids || [])
                                    .map((tid: string) => teams.find((t) => t.id === tid))
                                    .filter(Boolean)
                                    .map((t: any) => t.name);
                                  return (
                                    <option key={et.id} value={et.id}>
                                      {et.title} ({et.duration_minutes} min){inTeams.length > 0 ? ` — in ${inTeams.join(", ")}` : " — unassigned"}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Delete team */}
                        <div className="pt-2 border-t border-gray-100">
                          {confirmDeleteId === team.id ? (
                            <div className="flex items-center gap-3 bg-red-50 rounded-lg px-4 py-3">
                              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                              <span className="text-sm text-red-700 flex-1">
                                Delete <strong>{team.name}</strong>? This removes all memberships and event type associations.
                              </span>
                              <button
                                onClick={() => handleDeleteTeam(team.id)}
                                disabled={deleting}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
                              >
                                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(team.id)}
                              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete team
                            </button>
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
