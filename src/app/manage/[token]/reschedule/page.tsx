"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  format,
  addDays,
  startOfDay,
  isSameDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface BookingData {
  id: string;
  invitee_name: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  event_type: { title: string; duration_minutes: number; color: string; slug: string };
  team_member_name: string;
}

interface TimeSlot {
  start: string;
  end: string;
}

export default function ReschedulePage() {
  const params = useParams();
  const token = params.token as string;

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Slot selection
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Rescheduling state
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduled, setRescheduled] = useState(false);
  const [newBooking, setNewBooking] = useState<{ start_time: string; end_time: string } | null>(null);

  const timezone = typeof window !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "America/New_York";

  // 14-day calendar
  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const [dateOffset, setDateOffset] = useState(0);
  const visibleDays = 7;

  // Fetch booking
  useEffect(() => {
    fetch(`/api/manage/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.booking) {
          setBooking(data.booking);
          if (data.booking.status === "cancelled") {
            setError("This booking has been cancelled.");
          }
        } else {
          setError("Booking not found or link has expired.");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Something went wrong.");
        setLoading(false);
      });
  }, [token]);

  // Fetch slots when date selected
  useEffect(() => {
    if (!selectedDate || !booking) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetch(
      `/api/availability?date=${dateStr}&eventType=${booking.event_type?.slug}&timezone=${encodeURIComponent(timezone)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
  }, [selectedDate, booking, timezone]);

  const handleReschedule = async () => {
    if (!selectedSlot) return;
    setRescheduling(true);
    setError("");

    try {
      const res = await fetch(`/api/manage/${token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: selectedSlot.start,
          timezone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewBooking(data.booking);
        setRescheduled(true);
      } else {
        setError(data.error || "Failed to reschedule.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if ((error && !booking) || booking?.status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md w-full">
          <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Cannot Reschedule</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (rescheduled && newBooking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 text-center max-w-md w-full animate-scale-in">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Rescheduled!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your {booking?.event_type?.title?.toLowerCase() || "meeting"} has been moved to a new time.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Meeting</span>
              <span className="text-sm font-medium">{booking?.event_type?.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">With</span>
              <span className="text-sm font-medium">{booking?.team_member_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">New Time</span>
              <span className="text-sm font-medium">
                {new Date(newBooking.start_time).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                {new Date(newBooking.start_time).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Confirmation emails have been sent. Your calendar is updated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            href={`/manage/${token}`}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-10 rounded-full"
              style={{ backgroundColor: booking?.event_type?.color || "#4f46e5" }}
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Reschedule Booking
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm">
                {booking?.event_type?.title} · {booking?.event_type?.duration_minutes} min
              </p>
            </div>
          </div>
        </div>

        {/* Current booking info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm">
          <span className="text-amber-800">
            <strong>Current time:</strong>{" "}
            {new Date(booking!.start_time).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {" at "}
            {new Date(booking!.start_time).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Date + Time selection card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Date Picker */}
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
              Select a New Date
            </h3>
            <div className="relative">
              {dateOffset > 0 && (
                <button
                  onClick={() => setDateOffset(Math.max(0, dateOffset - 1))}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
              )}
              {dateOffset + visibleDays < days.length && (
                <button
                  onClick={() => setDateOffset(Math.min(days.length - visibleDays, dateOffset + 1))}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              )}
              <div className="flex gap-1.5 sm:gap-2 overflow-hidden px-1">
                {days.slice(dateOffset, dateOffset + visibleDays).map((day) => {
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isSameDay(day, today);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      disabled={isWeekend}
                      className={`flex-1 min-w-0 py-2 sm:py-3 rounded-xl text-center transition-all duration-200 ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]"
                          : isWeekend
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : isToday
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                          : "bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 text-gray-700 border border-transparent"
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
          {selectedDate && (
            <div className="p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
                Available Times — {format(selectedDate, "EEE, MMM d")}
              </h3>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No available times on this day.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-h-56 sm:max-h-64 overflow-y-auto">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start === slot.start;
                    return (
                      <button
                        key={slot.start}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                            : "bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700"
                        }`}
                      >
                        {new Date(slot.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Confirm reschedule */}
          {selectedSlot && (
            <div className="p-3 sm:p-4 border-t border-gray-100">
              {error && (
                <p className="text-red-500 text-sm mb-3">{error}</p>
              )}
              <div className="bg-indigo-50 rounded-xl p-3 mb-4 text-sm text-indigo-800">
                <strong>New time:</strong>{" "}
                {new Date(selectedSlot.start).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {" at "}
                {new Date(selectedSlot.start).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <button
                onClick={handleReschedule}
                disabled={rescheduling}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:shadow-lg hover:shadow-indigo-600/25"
              >
                {rescheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rescheduling...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Confirm Reschedule
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <span className="text-xs text-gray-400">
            Powered by <span className="font-semibold text-gray-500">Slotly</span>
          </span>
        </div>
      </div>
    </div>
  );
}
