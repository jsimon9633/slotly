"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import Link from "next/link";
import type { EventType, TimeSlot } from "@/lib/types";

type Step = "date" | "time" | "form" | "confirmed";

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

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
  const [notes, setNotes] = useState("");

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Generate next 14 days for date picker
  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  // Fetch event type on mount
  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((types: EventType[]) => {
        const et = types.find((t) => t.slug === slug);
        if (et) setEventType(et);
      });
  }, [slug]);

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
          notes: notes || undefined,
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
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-10 rounded-full"
              style={{ backgroundColor: eventType.color }}
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {eventType.title}
              </h1>
              <p className="text-gray-500 text-sm">
                {eventType.duration_minutes} min · {timezone}
              </p>
            </div>
          </div>
        </div>

        {/* ── STEP: Confirmed ── */}
        {step === "confirmed" && confirmation && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              You&apos;re booked!
            </h2>
            <p className="text-gray-500 mb-6">
              A calendar invite has been sent to {email}.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Meeting</span>
                <span className="text-sm font-medium">
                  {confirmation.event_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">With</span>
                <span className="text-sm font-medium">
                  {confirmation.team_member_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">When</span>
                <span className="text-sm font-medium">
                  {format(parseISO(confirmation.start_time), "EEE, MMM d · h:mm a")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Date + Time Selection ── */}
        {(step === "date" || step === "time") && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Date Picker — horizontal scroll */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Select a Date
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {days.map((day) => {
                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setStep("time");
                      }}
                      disabled={isWeekend}
                      className={`flex-shrink-0 w-16 py-3 rounded-xl text-center transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-md"
                          : isWeekend
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : "bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-gray-700 border border-transparent"
                      }`}
                    >
                      <div className="text-xs font-medium opacity-70">
                        {format(day, "EEE")}
                      </div>
                      <div className="text-lg font-bold">
                        {format(day, "d")}
                      </div>
                      <div className="text-xs opacity-60">
                        {format(day, "MMM")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            {step === "time" && selectedDate && (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Available Times — {format(selectedDate, "EEE, MMM d")}
                </h3>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Checking availability...
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No available times on this day.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {slots.map((slot) => {
                      const isSelected =
                        selectedSlot?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep("form");
                          }}
                          className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-700"
                          }`}
                        >
                          {format(parseISO(slot.start), "h:mm a")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Booking Form ── */}
        {step === "form" && selectedSlot && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <button
              onClick={() => setStep("time")}
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Change time
            </button>

            <div className="bg-blue-50 rounded-xl p-3 mb-6 text-sm text-blue-800">
              <span className="font-semibold">
                {format(parseISO(selectedSlot.start), "EEEE, MMMM d")}
              </span>{" "}
              at{" "}
              <span className="font-semibold">
                {format(parseISO(selectedSlot.start), "h:mm a")}
              </span>{" "}
              · {eventType.duration_minutes} min
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@company.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you'd like us to know..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                />
              </div>

              <button
                onClick={handleBook}
                disabled={!name || !email || booking}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
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
        <div className="mt-6 text-center">
          <span className="text-xs text-gray-400">
            Powered by{" "}
            <span className="font-semibold text-gray-500">Slotly</span>
          </span>
        </div>
      </div>
    </div>
  );
}
