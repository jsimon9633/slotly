"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Check, Loader2, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BookingData {
  id: string;
  invitee_name: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  event_type: { title: string; duration_minutes: number; color: string };
  team_member_name: string;
}

export default function CancelPage() {
  const params = useParams();
  const token = params.token as string;

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/manage/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.booking) {
          setBooking(data.booking);
          if (data.booking.status === "cancelled") setCancelled(true);
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

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/manage/${token}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCancelled(true);
      } else {
        setError(data.error || "Failed to cancel.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error && !booking) {
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

  if (cancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md w-full animate-scale-in">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Cancelled</h1>
          <p className="text-gray-500 mb-6">
            Your {booking?.event_type?.title?.toLowerCase() || "meeting"} has been cancelled and removed from the calendar.
          </p>
          <p className="text-sm text-gray-400">
            A confirmation email has been sent to both parties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href={`/manage/${token}`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cancel Booking?</h1>
              <p className="text-sm text-gray-500">This action cannot be undone.</p>
            </div>
          </div>

          {booking && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Meeting</span>
                <span className="text-sm font-medium">{booking.event_type?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">With</span>
                <span className="text-sm font-medium">{booking.team_member_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">When</span>
                <span className="text-sm font-medium">
                  {new Date(booking.start_time).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {new Date(booking.start_time).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <Link
              href={`/manage/${token}`}
              className="flex-1 py-2.5 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all text-sm"
            >
              Keep Booking
            </Link>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
