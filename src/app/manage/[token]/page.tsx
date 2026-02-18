"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, User, Loader2, X, RefreshCw, Trash2 } from "lucide-react";
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

export default function ManagePage() {
  const params = useParams();
  const token = params.token as string;

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/manage/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.booking) setBooking(data.booking);
        else setError("Booking not found or link has expired.");
        setLoading(false);
      })
      .catch(() => {
        setError("Something went wrong.");
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md w-full">
          <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";
  const isPast = new Date(booking.start_time).getTime() < Date.now();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-10 rounded-full"
              style={{ backgroundColor: booking.event_type?.color || "#4f46e5" }}
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manage Booking</h1>
              <p className="text-gray-500 text-sm">{booking.event_type?.title}</p>
            </div>
          </div>
        </div>

        {/* Status badge */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm font-medium text-center">
            This booking has been cancelled.
          </div>
        )}

        {isPast && !isCancelled && (
          <div className="bg-gray-50 border border-gray-200 text-gray-500 rounded-xl px-4 py-3 mb-4 text-sm font-medium text-center">
            This booking has already passed.
          </div>
        )}

        {/* Booking card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 animate-scale-in">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(booking.start_time).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-base text-gray-700">
                  {new Date(booking.start_time).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {" – "}
                  {new Date(booking.end_time).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-500">Meeting With</p>
                <p className="text-base font-medium text-gray-900">{booking.team_member_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="text-base font-medium text-gray-900">
                  {booking.event_type?.duration_minutes} minutes
                </p>
              </div>
            </div>
          </div>

          {/* Actions — only for future, non-cancelled bookings */}
          {!isCancelled && !isPast && (
            <div className="mt-8 flex gap-3">
              <Link
                href={`/manage/${token}/reschedule`}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:shadow-lg hover:shadow-indigo-600/25"
              >
                <RefreshCw className="w-4 h-4" />
                Reschedule
              </Link>
              <Link
                href={`/manage/${token}/cancel`}
                className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 font-semibold rounded-xl border border-red-200 hover:border-red-300 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Cancel
              </Link>
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
