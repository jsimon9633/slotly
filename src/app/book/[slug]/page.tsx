"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  format,
  addDays,
  parseISO,
  startOfDay,
  isSameDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import type { EventType, TimeSlot } from "@/lib/types";

type Step = "date" | "time" | "form" | "confirmed";

// Pre-defined business/sales meeting topics (no AI tokens needed)
const TOPIC_SUGGESTIONS = [
  "Product Demo",
  "Partnership Discussion",
  "Sales Follow-up",
  "Pricing Review",
  "Onboarding Call",
  "Quarterly Check-in",
  "Strategy Session",
  "Contract Negotiation",
  "Technical Integration",
  "Budget Planning",
  "Campaign Review",
  "Talent Acquisition",
];

// Detect if we're in an iframe (embed mode)
function useIsEmbed() {
  const [isEmbed, setIsEmbed] = useState(false);
  useEffect(() => {
    try {
      setIsEmbed(window.self !== window.top);
    } catch {
      setIsEmbed(true);
    }
  }, []);
  return isEmbed;
}

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const isEmbed = useIsEmbed();
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const [eventType, setEventType] = useState<EventType | null>(null);
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    team_member_name: string;
    start_time: string;
    event_type: string;
  } | null>(null);

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [filteredTopics, setFilteredTopics] = useState(TOPIC_SUGGESTIONS);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Generate next 14 days
  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  // Date scroll navigation
  const [dateOffset, setDateOffset] = useState(0);
  const visibleDays = 7;

  // Filter topic suggestions based on input
  useEffect(() => {
    if (topic.trim()) {
      const lower = topic.toLowerCase();
      setFilteredTopics(
        TOPIC_SUGGESTIONS.filter((t) => t.toLowerCase().includes(lower))
      );
    } else {
      setFilteredTopics(TOPIC_SUGGESTIONS);
    }
  }, [topic]);

  // Fetch event type
  useEffect(() => {
    const baseUrl = isEmbed ? "" : "";
    fetch(`${baseUrl}/api/event-types`)
      .then((r) => r.json())
      .then((types: EventType[]) => {
        const et = types.find((t) => t.slug === slug);
        if (et) setEventType(et);
      });
  }, [slug, isEmbed]);

  // Fetch slots when date selected
  useEffect(() => {
    if (!selectedDate || !eventType) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetch(
      `/api/availability?date=${dateStr}&eventType=${slug}&timezone=${encodeURIComponent(timezone)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
  }, [selectedDate, eventType, slug, timezone]);

  const handleBook = async () => {
    if (!selectedSlot || !name || !email) return;
    setBooking(true);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeSlug: slug,
          startTime: selectedSlot.start,
          timezone,
          name,
          email,
          notes: [topic && `Topic: ${topic}`, notes].filter(Boolean).join("\n") || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfirmation(data.booking);
        setStep("confirmed");
      } else {
        alert("Booking failed: " + (data.error || "Unknown error"));
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (!eventType) {
    return (
      <div className={`${isEmbed ? "" : "min-h-screen"} flex items-center justify-center text-gray-400 p-4`}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`${isEmbed ? "p-2 sm:p-4" : "min-h-screen p-4"} flex items-center justify-center`}>
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6 animate-fade-in-up">
          {!isEmbed && (
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 sm:mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div
              className="w-1.5 sm:w-2 h-8 sm:h-10 rounded-full transition-all"
              style={{ backgroundColor: eventType.color }}
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {eventType.title}
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm">
                {eventType.duration_minutes} min · {timezone.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>

        {/* ── STEP: Confirmed ── */}
        {step === "confirmed" && confirmation && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 text-center animate-scale-in">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-check-pop">
              <Check className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
              You&apos;re booked!
            </h2>
            <p className="text-gray-500 text-sm sm:text-base mb-6 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
              A calendar invite has been sent to {email}.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Meeting</span>
                <span className="text-sm font-medium">{confirmation.event_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">With</span>
                <span className="text-sm font-medium">{confirmation.team_member_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">When</span>
                <span className="text-sm font-medium">
                  {new Date(confirmation.start_time).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}
                  {new Date(confirmation.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              {topic && (
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Topic</span>
                  <span className="text-sm font-medium">{topic}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: Date + Time Selection ── */}
        {(step === "date" || step === "time") && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-scale-in">
            {/* Date Picker */}
            <div className="p-3 sm:p-4 border-b border-gray-100">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
                Select a Date
              </h3>
              <div className="relative">
                {/* Scroll left */}
                {dateOffset > 0 && (
                  <button
                    onClick={() => setDateOffset(Math.max(0, dateOffset - 1))}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {/* Scroll right */}
                {dateOffset + visibleDays < days.length && (
                  <button
                    onClick={() => setDateOffset(Math.min(days.length - visibleDays, dateOffset + 1))}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                <div
                  ref={dateScrollRef}
                  className="flex gap-1.5 sm:gap-2 overflow-hidden px-1"
                >
                  {days.slice(dateOffset, dateOffset + visibleDays).map((day, i) => {
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, today);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => {
                          setSelectedDate(day);
                          setStep("time");
                        }}
                        disabled={isWeekend}
                        className={`flex-1 min-w-0 py-2 sm:py-3 rounded-xl text-center transition-all duration-200 animate-fade-in-up stagger-${i + 1} ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-[1.02]"
                            : isWeekend
                            ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                            : isToday
                            ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            : "bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-gray-700 border border-transparent"
                        }`}
                      >
                        <div className="text-[10px] sm:text-xs font-medium opacity-70">
                          {format(day, "EEE")}
                        </div>
                        <div className="text-base sm:text-lg font-bold">
                          {format(day, "d")}
                        </div>
                        <div className="text-[10px] sm:text-xs opacity-60">
                          {format(day, "MMM")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time Slots */}
            {step === "time" && selectedDate && (
              <div className="p-3 sm:p-4 animate-fade-in">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
                  Available Times — {format(selectedDate, "EEE, MMM d")}
                </h3>
                {loadingSlots ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="skeleton h-10 rounded-lg" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-gray-400 animate-fade-in text-sm sm:text-base">
                    No available times on this day.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-h-56 sm:max-h-64 overflow-y-auto hide-scrollbar">
                    {slots.map((slot, i) => (
                      <button
                        key={slot.start}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep("form");
                        }}
                        className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 animate-fade-in-up stagger-${Math.min(i + 1, 9)} hover:scale-[1.03] active:scale-95 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm text-gray-700`}
                      >
                        {new Date(slot.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Booking Form ── */}
        {step === "form" && selectedSlot && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 animate-slide-in-right">
            <button
              onClick={() => setStep("time")}
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 sm:mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Change time
            </button>

            <div className="bg-blue-50 rounded-xl p-3 mb-4 sm:mb-6 text-xs sm:text-sm text-blue-800 animate-fade-in">
              <span className="font-semibold">
                {new Date(selectedSlot.start).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>{" "}
              at{" "}
              <span className="font-semibold">
                {new Date(selectedSlot.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>{" "}
              · {eventType.duration_minutes} min
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm sm:text-base"
                />
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm sm:text-base"
                />
              </div>

              {/* Topic with AI suggestions */}
              <div className="animate-fade-in-up relative" style={{ animationDelay: "0.15s" }}>
                <label className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Meeting Topic
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      setShowTopicSuggestions(true);
                    }}
                    onFocus={() => setShowTopicSuggestions(true)}
                    placeholder="What would you like to discuss?"
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm sm:text-base pr-8"
                  />
                  {topic && (
                    <button
                      onClick={() => { setTopic(""); setShowTopicSuggestions(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Suggestion chips */}
                {showTopicSuggestions && filteredTopics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 animate-fade-in">
                    {filteredTopics.slice(0, 6).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setTopic(t);
                          setShowTopicSuggestions(false);
                        }}
                        className="topic-chip text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you'd like us to know..."
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none text-sm sm:text-base"
                />
              </div>

              <button
                onClick={handleBook}
                disabled={!name || !email || booking}
                className={`w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base animate-fade-in-up ${
                  !booking && name && email ? "hover:shadow-lg hover:shadow-blue-600/25 hover:scale-[1.01] active:scale-[0.99]" : ""
                }`}
                style={{ animationDelay: "0.25s" }}
              >
                {booking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Confirm Booking
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Powered by */}
        <div className="mt-4 sm:mt-6 text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <span className="text-[10px] sm:text-xs text-gray-400">
            Powered by{" "}
            <span className="font-semibold text-gray-500">Slotly</span>
          </span>
        </div>
      </div>
    </div>
  );
}
