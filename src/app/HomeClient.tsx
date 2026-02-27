"use client";

import { useState } from "react";
import { Zap, Code2, Clock, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";
import type { EventType, SiteSettings, Team } from "@/lib/types";

const NAME_EMOJIS: Record<string, string> = {
  alberto: "\u{1F468}\u{200D}\u{1F4BC}",
  jason: "\u{1F468}\u{200D}\u{1F4BB}",
  sarah: "\u{1F469}\u{200D}\u{1F4BC}",
  jessica: "\u{1F469}\u{200D}\u{1F4BB}",
  michael: "\u{1F9D1}\u{200D}\u{1F4BC}",
  david: "\u{1F468}\u{200D}\u{1F3A8}",
  emily: "\u{1F469}\u{200D}\u{1F3A8}",
  chris: "\u{1F9D1}\u{200D}\u{1F4BB}",
  alex: "\u{1F9D1}\u{200D}\u{1F52C}",
  sam: "\u{1F9D1}\u{200D}\u{1F680}",
  james: "\u{1F468}\u{200D}\u{1F4BC}",
};
const FALLBACK_EMOJIS = ["\u{1F464}", "\u{1F9D1}", "\u{1F468}", "\u{1F469}"];

// Finance / money themed emojis for team cards
const FINANCE_EMOJIS = [
  "\u{1F4B0}", // money bag
  "\u{1F4B5}", // dollar banknote
  "\u{1F4C8}", // chart increasing
  "\u{1F3E6}", // bank
  "\u{1F4B3}", // credit card
  "\u{1F4B8}", // money with wings
  "\u{1F911}", // money-mouth face
  "\u{1FA99}", // coin
  "\u{1F4B2}", // heavy dollar sign
  "\u{1F4C9}", // chart decreasing (bearish)
  "\u{1F4CA}", // bar chart
  "\u{1F4B1}", // currency exchange
  "\u{2696}\u{FE0F}", // balance scale
  "\u{1F48E}", // gem stone
  "\u{1F3AF}", // bullseye
];

function getEmojiForName(name: string, index: number): string {
  const first = name.toLowerCase();
  return NAME_EMOJIS[first] || FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

// Extended EventType with team_slug from server
interface EventTypeWithTeam extends EventType {
  team_slug?: string;
}

interface TeamWithEventTypes extends Team {
  event_types: Pick<EventType, "id" | "slug" | "title" | "description" | "duration_minutes" | "color">[];
  member_names?: string[];
}

interface HomeClientProps {
  eventTypes: EventTypeWithTeam[];
  teamMembers: { id: string; name: string }[];
  settings: SiteSettings;
  teams?: TeamWithEventTypes[];
}

// Team color palette
const TEAM_COLORS = [
  { bg: "bg-indigo-50", border: "border-indigo-100", accent: "bg-indigo-500", text: "text-indigo-600", hover: "hover:border-indigo-300 hover:shadow-md" },
  { bg: "bg-violet-50", border: "border-violet-100", accent: "bg-violet-500", text: "text-violet-600", hover: "hover:border-violet-300 hover:shadow-md" },
  { bg: "bg-blue-50", border: "border-blue-100", accent: "bg-blue-500", text: "text-blue-600", hover: "hover:border-blue-300 hover:shadow-md" },
  { bg: "bg-emerald-50", border: "border-emerald-100", accent: "bg-emerald-500", text: "text-emerald-600", hover: "hover:border-emerald-300 hover:shadow-md" },
  { bg: "bg-amber-50", border: "border-amber-100", accent: "bg-amber-500", text: "text-amber-600", hover: "hover:border-amber-300 hover:shadow-md" },
  { bg: "bg-rose-50", border: "border-rose-100", accent: "bg-rose-500", text: "text-rose-600", hover: "hover:border-rose-300 hover:shadow-md" },
];

export default function HomeClient({ eventTypes, teamMembers, settings, teams }: HomeClientProps) {
  const hasTeams = teams && teams.length > 0 && !(teams.length === 1 && teams[0].id === "default");

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* ── Header ── */}
      <header className="max-w-[880px] mx-auto flex items-center justify-between px-4 sm:px-5 pt-4">
        <Link href="/" className="flex items-center gap-2 animate-fade-in-up hover:opacity-80 transition-opacity">
          {settings.logo_url ? (
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-white border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logo_url} alt="" className="w-full h-full object-contain" loading="eager" width={28} height={28} />
            </div>
          ) : (
            <div
              className="w-7 h-7 rounded-lg grid place-items-center"
              style={{ backgroundColor: settings.primary_color }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className="text-lg font-bold tracking-tight text-gray-900">
            {settings.company_name}
          </span>
        </Link>
        <Link
          href="/embed"
          className="text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all animate-fade-in"
        >
          <Code2 className="w-3 h-3" />
          Embed
        </Link>
      </header>

      {/* ── Main ── */}
      <main className="max-w-[880px] mx-auto px-4 sm:px-5 pt-5 sm:pt-7 pb-6">

        {/* Title */}
        <div className="animate-fade-in-up mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Book a meeting</h1>
          <p className="text-base sm:text-lg text-gray-400">
            {hasTeams
              ? "Pick a team to see their available meeting types."
              : "Choose a meeting type to get started."}
          </p>
        </div>

        {hasTeams ? (
          /* ===== TEAMS VIEW ===== */
          <div className="space-y-4">
            {teams!.map((team, i) => {
              const colors = TEAM_COLORS[i % TEAM_COLORS.length];
              return (
                <Link
                  key={team.id}
                  href={`/book/${team.slug}`}
                  className={`block bg-white rounded-2xl border-[1.5px] ${colors.border} ${colors.hover} transition-all animate-fade-in-up stagger-${i + 1}`}
                >
                  <div className="p-5 sm:p-6">
                    {/* Team header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${colors.bg} rounded-xl grid place-items-center text-xl`}>
                          {FINANCE_EMOJIS[i % FINANCE_EMOJIS.length]}
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-gray-900">{team.name}</h2>
                          {team.description && (
                            <p className="text-sm text-gray-400 mt-0.5">{team.description}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    </div>

                    {/* Event types preview */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {team.event_types.map((et) => (
                        <div
                          key={et.id}
                          className={`inline-flex items-center gap-2 ${colors.bg} rounded-lg px-3 py-1.5`}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: et.color }}
                          />
                          <span className="text-sm font-medium text-gray-700">{et.title}</span>
                          <span className="text-xs text-gray-400">{et.duration_minutes}m</span>
                        </div>
                      ))}
                      {team.event_types.length === 0 && (
                        <span className="text-sm text-gray-300">No event types yet</span>
                      )}
                    </div>

                    {/* Round-robin members */}
                    {team.member_names && team.member_names.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100/60">
                        <span className="text-[11px] text-gray-400">Round-robin:</span>
                        {team.member_names.map((name, mi) => (
                          <span
                            key={mi}
                            className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 text-[11px] px-2 py-0.5 rounded-full"
                          >
                            <span className="text-xs">{getEmojiForName(name, mi)}</span>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* ===== NO TEAMS / DEFAULT VIEW ===== */
          <div className="space-y-3">
            {eventTypes.map((et, i) => (
              <Link
                key={et.id}
                href={`/book/${et.team_slug || "default"}/${et.slug}`}
                className={`block bg-white rounded-xl border-[1.5px] border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all p-4 sm:p-5 animate-fade-in-up stagger-${i + 1}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900">{et.title}</div>
                    {et.description && (
                      <div className="text-sm text-gray-400 mt-0.5 truncate">{et.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-400 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {et.duration_minutes} min
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-[880px] mx-auto flex flex-col items-center gap-2 px-4 py-3 sm:py-4 text-[11px] text-gray-400 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <span>Powered by {settings.company_name}</span>
      </footer>
    </div>
  );
}
