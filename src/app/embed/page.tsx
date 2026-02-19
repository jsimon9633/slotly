"use client";

import { useEffect, useState } from "react";
import { Zap, Code2, Copy, Check, ArrowLeft, ChevronDown, ChevronRight, Users } from "lucide-react";
import Link from "next/link";

interface TeamData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface EventTypeData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  team_ids: string[];
}

const TEAM_COLORS = [
  { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
  { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
  { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-xs font-medium flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-500" />
          <span className="text-emerald-500">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label || "Copy snippet"}
        </>
      )}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto whitespace-pre">
      {code}
    </div>
  );
}

export default function EmbedPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/event-types").then((r) => r.json()),
    ])
      .then(([teamsData, etData]) => {
        setTeams(teamsData || []);
        setEventTypes(etData || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const hasTeams = teams.length > 0;

  // Group event types by team using team_ids array (many-to-many)
  const teamEventTypes = (teamId: string) =>
    eventTypes.filter((et) => (et.team_ids || []).includes(teamId));

  // Unassigned event types (not in any team)
  const unassigned = eventTypes.filter(
    (et) => !et.team_ids || et.team_ids.length === 0
  );

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Header */}
      <header className="max-w-[680px] mx-auto flex items-center justify-between px-4 sm:px-5 pt-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg grid place-items-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">Slotly</span>
        </Link>
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
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-4 h-4 text-indigo-500" />
            <h1 className="text-lg font-bold text-gray-900">Embed Slotly</h1>
          </div>
          <p className="text-sm text-gray-400">
            Add scheduling to any website with two lines of code.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        ) : hasTeams ? (
          /* ===== TEAM-GROUPED VIEW ===== */
          <div className="space-y-5">
            {teams.map((team, ti) => {
              const colors = TEAM_COLORS[ti % TEAM_COLORS.length];
              const ets = teamEventTypes(team.id);
              const isExpanded = expandedTeam === team.id;
              const teamEmbedCode = `<div id="slotly-widget" data-team="${team.slug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;

              return (
                <div
                  key={team.id}
                  className={`bg-white rounded-xl border-[1.5px] ${colors.border} animate-fade-in-up stagger-${ti + 1}`}
                >
                  {/* Team header */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 ${colors.bg} rounded-xl grid place-items-center`}>
                        <Users className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-gray-900">{team.name}</h2>
                        {team.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{team.description}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full`}>
                        {ets.length} event{ets.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Full-team embed code */}
                    <div className="mb-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">
                        Embed all {team.name} events
                      </div>
                      <CodeBlock code={teamEmbedCode} />
                      <div className="mt-2">
                        <CopyButton text={teamEmbedCode} />
                      </div>
                    </div>

                    {/* Expand for individual event types */}
                    {ets.length > 0 && (
                      <button
                        onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                        className="mt-3 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {isExpanded ? "Hide" : "Show"} individual event embeds ({ets.length})
                      </button>
                    )}
                  </div>

                  {/* Expanded individual event types */}
                  {isExpanded && ets.length > 0 && (
                    <div className="border-t border-gray-100 px-4 sm:px-5 py-3 space-y-4">
                      {ets.map((et) => {
                        const etCode = `<div id="slotly-widget" data-team="${team.slug}" data-slug="${et.slug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;
                        return (
                          <div key={et.id}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: et.color }}
                              />
                              <span className="text-sm font-medium text-gray-700">{et.title}</span>
                              <span className="text-xs text-gray-400">{et.duration_minutes}m</span>
                            </div>
                            <CodeBlock code={etCode} />
                            <div className="mt-1.5">
                              <CopyButton text={etCode} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned event types */}
            {unassigned.length > 0 && (
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-4 sm:p-5 animate-fade-in-up">
                <h2 className="text-base font-bold text-gray-900 mb-3">Other Events</h2>
                <div className="space-y-4">
                  {unassigned.map((et) => {
                    const code = `<div id="slotly-widget" data-slug="${et.slug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;
                    return (
                      <div key={et.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: et.color }}
                          />
                          <span className="text-sm font-medium text-gray-700">{et.title}</span>
                          <span className="text-xs text-gray-400">{et.duration_minutes}m</span>
                        </div>
                        <CodeBlock code={code} />
                        <div className="mt-1.5">
                          <CopyButton text={code} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===== FLAT VIEW (no teams) ===== */
          <div className="space-y-4">
            {eventTypes.map((et, i) => {
              const code = `<div id="slotly-widget" data-slug="${et.slug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;
              return (
                <div
                  key={et.id}
                  className={`bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up stagger-${i + 1}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-1.5 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: et.color }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{et.title}</div>
                      <div className="text-xs text-gray-400">{et.duration_minutes} min</div>
                    </div>
                  </div>
                  <CodeBlock code={code} />
                  <div className="mt-2">
                    <CopyButton text={code} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Options reference */}
        <div className="mt-8 bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Options</h2>
          <div className="font-mono text-[11px] text-gray-500 space-y-1">
            <div><span className="text-purple-500">data-team</span> — team slug <span className="text-gray-400">(shows all team events)</span></div>
            <div><span className="text-purple-500">data-slug</span> — event type slug <span className="text-gray-400">(specific event)</span></div>
            <div><span className="text-purple-500">data-width</span> — widget width <span className="text-gray-400">(default: &quot;100%&quot;)</span></div>
            <div><span className="text-purple-500">data-height</span> — widget height <span className="text-gray-400">(default: &quot;620px&quot;)</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}
