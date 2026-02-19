"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  ArrowLeft,
  BarChart3,
  Lock,
  Loader2,
  TrendingUp,
  Calendar,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

interface AnalyticsData {
  period_days: number;
  summary: {
    total_bookings: number;
    confirmed: number;
    cancelled: number;
    completed: number;
    cancellation_rate: number;
  };
  volume_timeline: { date: string; count: number }[];
  event_type_breakdown: { event_type_id: string; title: string; color: string; count: number }[];
  team_utilization: { team_member_id: string; name: string; bookings: number }[];
  peak_days: { day: string; count: number }[];
  peak_hours: { hour: string; count: number }[];
}

export default function AdminAnalyticsPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analytics?token=${encodeURIComponent(token)}&days=${days}`
      );
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setError("Invalid token.");
        return;
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    if (authenticated) fetchAnalytics();
  }, [authenticated, fetchAnalytics]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

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

  // Bar chart helper — renders an inline SVG bar chart
  const maxTimelineCount = data
    ? Math.max(...data.volume_timeline.map((d) => d.count), 1)
    : 1;

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
          <Link
            href="/admin/teams"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Teams
          </Link>
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
          <div className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center bg-white text-gray-900 shadow-sm whitespace-nowrap px-2">
            Analytics
          </div>
        </div>
      </div>

      <main className="max-w-[720px] sm:max-w-[860px] mx-auto px-5 sm:px-8 pt-7 sm:pt-9 pb-14">
        {/* Title + period selector */}
        <div className="mb-6 sm:mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics</h1>
              </div>
              <p className="text-base sm:text-lg text-gray-400">
                Booking volume, popular event types, team utilization, and peak times.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    days === d
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600 animate-fade-in">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : !data ? (
          <div className="text-center py-14 text-gray-300 text-base">No data available.</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-4 sm:p-5 animate-fade-in-up stagger-1">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {data.summary.total_bookings}
                </p>
                <p className="text-xs text-gray-400 mt-1">bookings</p>
              </div>
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-4 sm:p-5 animate-fade-in-up stagger-2">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Confirmed
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {data.summary.confirmed}
                </p>
                <p className="text-xs text-gray-400 mt-1">active</p>
              </div>
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-4 sm:p-5 animate-fade-in-up stagger-3">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cancelled
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {data.summary.cancelled}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {data.summary.cancellation_rate}% rate
                </p>
              </div>
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-4 sm:p-5 animate-fade-in-up stagger-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Completed
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {data.summary.completed}
                </p>
                <p className="text-xs text-gray-400 mt-1">done</p>
              </div>
            </div>

            {/* Booking volume timeline — CSS bar chart */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 mb-6 sm:mb-8 animate-fade-in-up stagger-5">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                Booking Volume
              </h2>
              {data.volume_timeline.length === 0 ? (
                <p className="text-sm text-gray-400">No data for this period.</p>
              ) : (
                <div className="flex items-end gap-[2px] h-32 sm:h-40">
                  {data.volume_timeline.map((d) => {
                    const pct = maxTimelineCount > 0 ? (d.count / maxTimelineCount) * 100 : 0;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 group relative"
                        style={{ height: "100%" }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-indigo-400 rounded-t-sm transition-all hover:bg-indigo-500"
                          style={{
                            height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%`,
                            minHeight: d.count > 0 ? "3px" : "0",
                          }}
                        />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                          {d.date.slice(5)}: {d.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                <span>{data.volume_timeline[0]?.date.slice(5)}</span>
                <span>{data.volume_timeline[data.volume_timeline.length - 1]?.date.slice(5)}</span>
              </div>
            </div>

            {/* Two-column layout: Event Types + Team Utilization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Popular Event Types */}
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up stagger-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Event Types
                </h2>
                {data.event_type_breakdown.length === 0 ? (
                  <p className="text-sm text-gray-400">No bookings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.event_type_breakdown.map((et) => {
                      const maxCount = data.event_type_breakdown[0]?.count || 1;
                      const pct = (et.count / maxCount) * 100;
                      return (
                        <div key={et.event_type_id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: et.color }}
                              />
                              <span className="text-sm font-medium text-gray-700">{et.title}</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{et.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: et.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Team Utilization */}
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up stagger-7">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Team Utilization
                </h2>
                {data.team_utilization.length === 0 ? (
                  <p className="text-sm text-gray-400">No bookings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.team_utilization.map((tm) => {
                      const maxBookings = data.team_utilization[0]?.bookings || 1;
                      const pct = (tm.bookings / maxBookings) * 100;
                      return (
                        <div key={tm.team_member_id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{tm.name}</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {tm.bookings}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Peak Days + Peak Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Peak Days */}
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up stagger-8">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Peak Days
                </h2>
                <div className="flex items-end gap-2 h-24">
                  {data.peak_days.map((d) => {
                    const maxDay = Math.max(...data.peak_days.map((x) => x.count), 1);
                    const pct = (d.count / maxDay) * 100;
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500">{d.count}</span>
                        <div className="w-full relative" style={{ height: "60px" }}>
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-indigo-300 rounded-t-sm"
                            style={{
                              height: `${Math.max(pct, d.count > 0 ? 8 : 0)}%`,
                              minHeight: d.count > 0 ? "3px" : "0",
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-gray-400">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Peak Hours */}
              <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up stagger-9">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Peak Hours
                </h2>
                <div className="flex items-end gap-[2px] h-24">
                  {data.peak_hours
                    .filter((_, i) => i >= 7 && i <= 20) // Show business hours 7AM-8PM
                    .map((h) => {
                      const maxHour = Math.max(...data.peak_hours.map((x) => x.count), 1);
                      const pct = (h.count / maxHour) * 100;
                      return (
                        <div key={h.hour} className="flex-1 group relative" style={{ height: "60px" }}>
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-blue-300 rounded-t-sm hover:bg-blue-400 transition-all"
                            style={{
                              height: `${Math.max(pct, h.count > 0 ? 8 : 0)}%`,
                              minHeight: h.count > 0 ? "3px" : "0",
                            }}
                          />
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                            {h.hour}: {h.count}
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                  <span>7AM</span>
                  <span>12PM</span>
                  <span>8PM</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
