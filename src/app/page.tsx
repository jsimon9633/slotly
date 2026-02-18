"use client";

import { useEffect, useState } from "react";
import { Zap, Code2 } from "lucide-react";
import Link from "next/link";
import type { EventType } from "@/lib/types";

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

export default function Home() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/event-types").then((r) => r.json()),
      fetch("/api/team").then((r) => r.json()),
    ])
      .then(([types, members]) => {
        setEventTypes(types);
        setTeamMembers(members);
        if (types.length > 0) setActiveSlug(types[0].slug);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeType = eventTypes.find((et) => et.slug === activeSlug);

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* ── Header ── */}
      <header className="max-w-[880px] mx-auto flex items-center justify-between px-4 sm:px-5 pt-4">
        <Link href="/" className="flex items-center gap-2 animate-fade-in-up hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg grid place-items-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">Slotly</span>
        </Link>
        <Link
          href="/embed"
          className="text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all animate-fade-in"
        >
          <Code2 className="w-3 h-3" />
          Embed
        </Link>
      </header>

      {/* ── Main ── */}
      <main className="max-w-[880px] mx-auto px-3 sm:px-5 pt-4 sm:pt-5 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3 sm:gap-4 items-start">

          {/* ── Sidebar: event type selector ── */}
          <div className="flex sm:flex-col gap-1.5 overflow-x-auto sm:overflow-visible hide-scrollbar">
            {loading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-12 sm:h-[52px] rounded-xl min-w-[130px] sm:min-w-0" />
                ))}
              </>
            ) : (
              eventTypes.map((et, i) => (
                <button
                  key={et.id}
                  onClick={() => setActiveSlug(et.slug)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all min-w-[130px] sm:min-w-0 w-full animate-fade-in-up stagger-${i + 1} ${
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
                    <div className="text-[11px] text-gray-400 mt-0.5 hidden sm:block truncate">
                      {et.duration_minutes} min
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* ── Live widget area ── */}
          <div className="relative bg-white border-[1.5px] border-gray-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] animate-scale-in">
            {/* Live badge */}
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
              <div className="w-[5px] h-[5px] bg-emerald-500 rounded-full animate-live-pulse" />
              Live
            </div>

            {/* Embedded booking widget */}
            {activeSlug ? (
              <iframe
                key={activeSlug}
                src={`/book/${activeSlug}`}
                className="w-full border-none block"
                style={{ height: "480px" }}
                title={`Book ${activeType?.title || "a meeting"}`}
              />
            ) : (
              <div className="flex items-center justify-center h-[480px] text-gray-300 text-sm">
                Select a meeting type
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-[880px] mx-auto flex items-center justify-center gap-2.5 px-4 py-3 sm:py-4 text-[11px] text-gray-400 animate-fade-in" style={{ animationDelay: "0.3s" }}>
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
      </footer>
    </div>
  );
}
