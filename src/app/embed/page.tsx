"use client";

import { useEffect, useState } from "react";
import { Zap, Code2, Copy, Check, ArrowLeft, Users, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

interface EventType {
  id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  color: string;
  team_id: string | null;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

interface TeamWithEventTypes extends Team {
  event_types: EventType[];
}

export default function EmbedPage() {
  const [teams, setTeams] = useState<TeamWithEventTypes[]>([]);
  const [unassigned, setUnassigned] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()).catch(() => []),
      fetch("/api/event-types").then((r) => r.json()).catch(() => []),
    ]).then(([teamsData, eventTypesData]) => {
      const allTeams: Team[] = Array.isArray(teamsData) ? teamsData : [];
      const allEts: EventType[] = Array.isArray(eventTypesData) ? eventTypesData : [];

      // Build teams with event types
      const teamsWithEts: TeamWithEventTypes[] = allTeams.map((t) => ({
        ...t,
        event_types: allEts.filter((et) => et.team_id === t.id),
      }));

      // Unassigned event types
      const unassignedEts = allEts.filter((et) => !et.team_id);

      setTeams(teamsWithEts);
      setUnassigned(unassignedEts);
      setLoading(false);
    });
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getTeamEmbedCode = (teamSlug: string) =>
    `<div id="slotly-widget" data-team="${teamSlug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;

  const getEventEmbedCode = (teamSlug: string, eventSlug: string) =>
    `<div id="slotly-widget" data-team="${teamSlug}" data-slug="${eventSlug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;

  const getLegacyEmbedCode = (eventSlug: string) =>
    `<div id="slotly-widget" data-slug="${eventSlug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;

  const hasTeams = teams.length > 0;

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Header */}
      <header className="max-w-[720px] mx-auto flex items-center justify-between px-4 sm:px-5 pt-4">
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

      <main className="max-w-[720px] mx-auto px-4 sm:px-5 pt-6 sm:pt-8 pb-12">
        {/* Title */}
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-4 h-4 text-indigo-500" />
            <h1 className="text-lg font-bold text-gray-900">Embed Slotly</h1>
          </div>
          <p className="text-sm text-gray-400">
            {hasTeams
              ? "Add team scheduling or individual event types to any website."
              : "Add scheduling to any website with two lines of code."}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        ) : hasTeams ? (
          /* ===== TEAM-BASED EMBED VIEW ===== */
          <div className="space-y-6">
            {teams.map((team, i) => (
              <div
                key={team.id}
                className={`bg-white rounded-xl border-[1.5px] border-gray-100 overflow-hidden animate-fade-in-up stagger-${i + 1}`}
              >
                {/* Team header */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg grid place-items-center flex-shrink-0">
                      <Users className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-semibold text-gray-900">{team.name}</h2>
                      {team.description && (
                        <p className="text-xs text-gray-400">{team.description}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                      {team.event_types.length} event type{team.event_types.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Full team embed — embeds the team page with all event types */}
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                      Embed full team page
                    </div>
                    <CodeBlock code={getTeamEmbedCode(team.slug)} />
                    <CopyButton
                      copied={copiedKey === `team-${team.id}`}
                      onClick={() => copyCode(getTeamEmbedCode(team.slug), `team-${team.id}`)}
                    />
                  </div>

                  {/* Expandable: individual event type embeds */}
                  {team.event_types.length > 0 && (
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                      className="text-xs font-medium text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors mt-1"
                    >
                      {expandedTeam === team.id ? (
                        <><ChevronDown className="w-3 h-3" /> Hide individual event embeds</>
                      ) : (
                        <><ChevronRight className="w-3 h-3" /> Show individual event embeds ({team.event_types.length})</>
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded: per-event-type embed codes */}
                {expandedTeam === team.id && (
                  <div className="border-t border-gray-100 px-4 sm:px-5 pb-4 pt-3 space-y-4">
                    {team.event_types.map((et) => (
                      <div key={et.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-1.5 h-6 rounded-full flex-shrink-0"
                            style={{ backgroundColor: et.color }}
                          />
                          <span className="text-sm font-medium text-gray-900">{et.title}</span>
                          <span className="text-xs text-gray-400">{et.duration_minutes} min</span>
                        </div>
                        <CodeBlock code={getEventEmbedCode(team.slug, et.slug)} />
                        <CopyButton
                          copied={copiedKey === `et-${et.id}`}
                          onClick={() => copyCode(getEventEmbedCode(team.slug, et.slug), `et-${et.id}`)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Unassigned event types (not in any team) */}
            {unassigned.length > 0 && (
              <div className={`bg-white rounded-xl border-[1.5px] border-gray-100 p-4 sm:p-5 animate-fade-in-up stagger-${teams.length + 1}`}>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Standalone Event Types</h2>
                <p className="text-xs text-gray-400 mb-4">These event types aren&apos;t assigned to any team.</p>
                <div className="space-y-4">
                  {unassigned.map((et) => (
                    <div key={et.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="w-1.5 h-6 rounded-full flex-shrink-0"
                          style={{ backgroundColor: et.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">{et.title}</span>
                        <span className="text-xs text-gray-400">{et.duration_minutes} min</span>
                      </div>
                      <CodeBlock code={getLegacyEmbedCode(et.slug)} />
                      <CopyButton
                        copied={copiedKey === `un-${et.id}`}
                        onClick={() => copyCode(getLegacyEmbedCode(et.slug), `un-${et.id}`)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===== LEGACY: no teams ===== */
          <div className="space-y-4">
            {unassigned.map((et, i) => (
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
                <CodeBlock code={getLegacyEmbedCode(et.slug)} />
                <CopyButton
                  copied={copiedKey === `et-${et.id}`}
                  onClick={() => copyCode(getLegacyEmbedCode(et.slug), `et-${et.id}`)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Options reference */}
        <div className="mt-8 bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Options</h2>
          <div className="font-mono text-[11px] text-gray-500 space-y-1">
            <div><span className="text-purple-500">data-team</span> — team slug <span className="text-gray-400">(embeds team booking page)</span></div>
            <div><span className="text-purple-500">data-slug</span> — event type slug <span className="text-gray-400">(embeds specific event type)</span></div>
            <div><span className="text-purple-500">data-width</span> — widget width <span className="text-gray-400">(default: &quot;100%&quot;)</span></div>
            <div><span className="text-purple-500">data-height</span> — widget height <span className="text-gray-400">(default: &quot;620px&quot;)</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Reusable sub-components ── */

function CodeBlock({ code }: { code: string }) {
  // Parse the embed code into colored spans
  const lines = code.split("\n");
  return (
    <div className="bg-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto">
      {lines.map((line, i) => (
        <div key={i}>
          {line.split(/(<[^>]+>)/g).map((part, j) => {
            if (part.startsWith("<") && part.endsWith(">")) {
              // HTML tag — colorize
              return (
                <span key={j}>
                  <span className="text-gray-500">&lt;</span>
                  <span className="text-blue-400">
                    {part.slice(1, -1).split(/\s+/)[0].replace("/", "")}
                  </span>
                  {part.includes("=") && (
                    <span>
                      {part
                        .slice(1, -1)
                        .replace(/^[^\s]+/, "")
                        .split(/(\w[\w-]*="[^"]*")/g)
                        .map((attr, k) => {
                          const match = attr.match(/^([\w-]+)="([^"]*)"$/);
                          if (match) {
                            return (
                              <span key={k}>
                                {" "}
                                <span className="text-purple-400">{match[1]}</span>
                                <span className="text-gray-500">=</span>
                                <span className="text-green-400">&quot;{match[2]}&quot;</span>
                              </span>
                            );
                          }
                          return null;
                        })}
                    </span>
                  )}
                  <span className="text-gray-500">&gt;</span>
                  {part.includes("</") && (
                    <>
                      <span className="text-gray-500">&lt;/</span>
                      <span className="text-blue-400">
                        {part.match(/<\/(\w+)>/)?.[1] || ""}
                      </span>
                      <span className="text-gray-500">&gt;</span>
                    </>
                  )}
                </span>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 text-xs font-medium flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-500" />
          <span className="text-emerald-500">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          Copy snippet
        </>
      )}
    </button>
  );
}
