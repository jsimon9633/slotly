"use client";

import { useEffect, useState } from "react";
import { Clock, Zap, Users } from "lucide-react";
import Link from "next/link";
import type { EventType } from "@/lib/types";

export default function Home() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((data) => {
        setEventTypes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Slotly</h1>
          </div>
          <p className="text-gray-500 text-lg">
            Pick a meeting type to get started.
          </p>
        </div>

        {/* Event Type Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : eventTypes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No event types configured yet.
              <br />
              <span className="text-sm">Run the schema.sql in Supabase to seed data.</span>
            </div>
          ) : (
            eventTypes.map((et) => (
              <Link
                key={et.id}
                href={`/book/${et.slug}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-2 h-12 rounded-full flex-shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {et.title}
                    </h2>
                    {et.description && (
                      <p className="text-gray-500 text-sm mt-0.5">{et.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-sm flex-shrink-0">
                    <Clock className="w-4 h-4" />
                    <span>{et.duration_minutes} min</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            <span>Round-robin scheduling across our team</span>
          </div>
        </div>
      </div>
    </div>
  );
}
