"use client";

import { useState } from "react";
import { Zap, Code2, Clock, ArrowLeft, ChevronRight } from "lucide-react";
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
};
const FALLBACK_EMOJIS = ["\u{1F464}", "\u{1F9D1}", "\u{1F468}", "\u{1F469}"];

function getEmojiForName(name: string, index: number): string {
  const first = name.toLowerCase();
  return NAME_EMOJIS[first] || FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

// Extended EventType with team_slug from server
interface EventTypeWithTeam extends EventType {
  team_slug?: string;
}

interface HomeClientProps {
  eventTypes: EventTypeWithTeam[];
  teamMembers: { id: string; name: string }[];
  settings: SiteSettings;
  teams?: (Team & { event_types: any[] })[];
}

export default function HomeClient({ eventTypes, teamMembers, settings, teams }: HomeClientProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(
    eventTypes.length > 0 ? eventTypes[0].slug : null
  );
  const [mobileStep, setMobileStep] = useState<"pick" | "book">("pick");

  const activeType = eventTypes.find((et) => et.slug === activeSlug);

  const selectEventType = (slug: string) => {
    setActiveSlug(slug);
    setMobileStep("book");
  };

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
      <main className="max-w-[880px] mx-auto px-3 sm:px-5 pt-4 sm:pt-5 pb-2">

        {/* ===== DESKTOP: side-by-side layout (hidden on mobile) ===== */}
        <div className="hidden sm:grid sm:grid-cols-[220px_1fr] gap-4 items-start">
          {/* Sidebar: event type selector */}
          <div className="flex flex-col gap-1.5">
            {eventTypes.map((et, i) => (
              <button
                key={et.id}
                onClick={() => setActiveSlug(et.slug)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all w-full animate-fade-in-up stagger-${i + 1} ${
                  activeSlug === et.slug
                    ? "bg-indigo-50 border-[1.5px] border-indigo-500"
                    : "bg-white border-[1.5px] border-gray-100 hover:border-indigo-200 hover:shadow-sm"
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: et.color }}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 leading-tight truncate">
                    {et.title}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                    {et.duration_minutes} min
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Live widget area */}
          <div className="relative bg-white border-[1.5px] border-gray-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] animate-scale-in">
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
              <div className="w-[5px] h-[5px] bg-emerald-500 rounded-full animate-live-pulse" />
              Live
            </div>
            {activeSlug ? (
              <iframe
                key={activeSlug}
                src={`/book/${activeType?.team_slug || 'default'}/${activeSlug}`}
                className="w-full border-none block"
                style={{ height: "480px" }}
                title={`Book ${activeType?.title || "a meeting"}`}
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center h-[480px] text-gray-400 text-sm">
                Select a meeting type
              </div>
            )}
          </div>
        </div>

        {/* ===== MOBILE: 2-step flow (hidden on desktop) ===== */}
        <div className="sm:hidden">

          {/* Mobile Step 1: Pick meeting type */}
          {mobileStep === "pick" && (
            <div className="animate-fade-in-up">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Book a meeting</h1>
              <p className="text-base text-gray-500 mb-5">
                Choose a meeting type to get started.
              </p>

              <div className="space-y-3">
                {eventTypes.map((et, i) => (
                  <button
                    key={et.id}
                    onClick={() => selectEventType(et.slug)}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all animate-fade-in-up stagger-${i + 1} ${
                      activeSlug === et.slug
                        ? "bg-indigo-50 border-[1.5px] border-indigo-500"
                        : "bg-white border-[1.5px] border-gray-100 hover:border-indigo-200 hover:shadow-sm active:scale-[0.98]"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: et.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-gray-900 leading-tight">
                        {et.title}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {et.duration_minutes} minutes
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mobile Step 2: Booking widget */}
          {mobileStep === "book" && activeSlug && (
            <div className="animate-fade-in-up">
              <button
                onClick={() => setMobileStep("pick")}
                className="text-sm text-gray-500 hover:text-gray-600 flex items-center gap-1 mb-3 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to meeting types
              </button>

              {activeType && (
                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: activeType.color }}
                  />
                  <span className="text-lg font-bold text-gray-900">{activeType.title}</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {activeType.duration_minutes} min
                  </span>
                </div>
              )}

              <div className="relative bg-white border-[1.5px] border-gray-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  <div className="w-[5px] h-[5px] bg-emerald-500 rounded-full animate-live-pulse" />
                  Live
                </div>
                <iframe
                  key={activeSlug}
                  src={`/book/${activeType?.team_slug || 'default'}/${activeSlug}`}
                  className="w-full border-none block"
                  style={{ height: "520px" }}
                  title={`Book ${activeType?.title || "a meeting"}`}
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-[880px] mx-auto flex flex-col items-center gap-2 px-4 py-3 sm:py-4 text-[11px] text-gray-500 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-2.5">
        <span>Round-robin across</span>
        {teamMembers.map((m, i) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[11px] px-2.5 py-0.5 rounded-full"
          >
            <span className="text-xs">{getEmojiForName(m.name, i)}</span>
            {m.name}
          </span>
        ))}
        </div>
      </footer>
    </div>
  );
}
