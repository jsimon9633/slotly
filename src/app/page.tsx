"use client";

import { useEffect, useState } from "react";
import { Clock, Zap, Users, Code2, Copy, Check } from "lucide-react";
import Link from "next/link";
import type { EventType } from "@/lib/types";

export default function Home() {
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

  const copyEmbedCode = (slug: string) => {
    const code = `<div id="slotly-widget" data-slug="${slug}"></div>\n<script src="${baseUrl}/embed.js"></script>`;
    navigator.clipboard.writeText(code);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center animate-scale-in">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Slotly</h1>
          </div>
          <p className="text-gray-500 text-lg">
            Pick a meeting type to get started.
          </p>
        </div>

        {/* Event Type Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : eventTypes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 animate-fade-in">
              No event types configured yet.
              <br />
              <span className="text-sm">Run the schema.sql in Supabase to seed data.</span>
            </div>
          ) : (
            eventTypes.map((et, i) => (
              <div
                key={et.id}
                className={`bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-md transition-all group animate-fade-in-up stagger-${i + 1}`}
              >
                <Link href={`/book/${et.slug}`} className="flex items-center gap-4">
                  <div
                    className="w-2 h-12 rounded-full flex-shrink-0 transition-transform group-hover:scale-y-110"
                    style={{ backgroundColor: et.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {et.title}
                    </h2>
                    {et.description && (
                      <p className="text-gray-500 text-sm mt-0.5 truncate">{et.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-sm flex-shrink-0">
                    <Clock className="w-4 h-4" />
                    <span>{et.duration_minutes} min</span>
                  </div>
                </Link>
                {/* Embed code button */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Code2 className="w-3 h-3" />
                    Embeddable
                  </span>
                  <button
                    onClick={() => copyEmbedCode(et.slug)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
                  >
                    {copiedSlug === et.slug ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-green-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy embed code
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Embed Demo */}
        {eventTypes.length > 0 && (
          <div className="mt-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              Embed Preview
            </h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-800 px-4 py-2 flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-400 font-mono">your-website.com</span>
              </div>
              <div className="p-4 bg-gray-50">
                <iframe
                  src={`/book/${eventTypes[0].slug}`}
                  className="w-full border-none rounded-xl"
                  style={{ height: "560px" }}
                  title="Slotly embed preview"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            <span>Round-robin scheduling across our team</span>
          </div>
        </div>
      </div>
    </div>
  );
}
