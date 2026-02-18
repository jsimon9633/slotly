"use client";

import { useEffect, useState } from "react";
import { Zap, Code2, Copy, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { EventType } from "@/lib/types";

export default function EmbedPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((data) => {
        setEventTypes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const copyCode = (slug: string) => {
    const code = `<div id="slotly-widget" data-slug="${slug}"></div>\n<script src="${baseUrl}/embed.js"><\/script>`;
    navigator.clipboard.writeText(code);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Header */}
      <header className="max-w-[680px] mx-auto flex items-center justify-between px-4 sm:px-5 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg grid place-items-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">Slotly</span>
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
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-4 h-4 text-indigo-500" />
            <h1 className="text-lg font-bold text-gray-900">Embed Slotly</h1>
          </div>
          <p className="text-sm text-gray-400">
            Add scheduling to any website with two lines of code.
          </p>
        </div>

        {/* Event type cards with embed code */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-40 rounded-xl" />
              ))}
            </div>
          ) : (
            eventTypes.map((et, i) => (
              <div
                key={et.id}
                className={`bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up stagger-${i + 1}`}
              >
                {/* Event info */}
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

                {/* Code block */}
                <div className="bg-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-gray-300 overflow-x-auto">
                  <div>
                    <span className="text-gray-500">&lt;</span>
                    <span className="text-blue-400">div</span>
                    {" "}
                    <span className="text-purple-400">id</span>
                    <span className="text-gray-500">=</span>
                    <span className="text-green-400">&quot;slotly-widget&quot;</span>
                    {" "}
                    <span className="text-purple-400">data-slug</span>
                    <span className="text-gray-500">=</span>
                    <span className="text-green-400">&quot;{et.slug}&quot;</span>
                    <span className="text-gray-500">&gt;&lt;/</span>
                    <span className="text-blue-400">div</span>
                    <span className="text-gray-500">&gt;</span>
                  </div>
                  <div>
                    <span className="text-gray-500">&lt;</span>
                    <span className="text-blue-400">script</span>
                    {" "}
                    <span className="text-purple-400">src</span>
                    <span className="text-gray-500">=</span>
                    <span className="text-green-400 break-all">&quot;{baseUrl}/embed.js&quot;</span>
                    <span className="text-gray-500">&gt;&lt;/</span>
                    <span className="text-blue-400">script</span>
                    <span className="text-gray-500">&gt;</span>
                  </div>
                </div>

                {/* Copy button */}
                <button
                  onClick={() => copyCode(et.slug)}
                  className="mt-2.5 text-xs font-medium flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  {copiedSlug === et.slug ? (
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

                {/* Live preview */}
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Preview</div>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <iframe
                      src={`/book/${et.slug}`}
                      className="w-full border-none block"
                      style={{ height: "420px" }}
                      title={`${et.title} preview`}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Options reference */}
        <div className="mt-8 bg-white rounded-xl border-[1.5px] border-gray-100 p-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Options</h2>
          <div className="font-mono text-[11px] text-gray-500 space-y-1">
            <div><span className="text-purple-500">data-slug</span> — event type slug <span className="text-gray-400">(required)</span></div>
            <div><span className="text-purple-500">data-width</span> — widget width <span className="text-gray-400">(default: &quot;100%&quot;)</span></div>
            <div><span className="text-purple-500">data-height</span> — widget height <span className="text-gray-400">(default: &quot;620px&quot;)</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}
