"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  format,
  addDays,
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
  Globe,
} from "lucide-react";
import Link from "next/link";
import type { EventType, TimeSlot, SiteSettings } from "@/lib/types";

type Step = "date" | "time" | "form" | "confirmed";

// Country codes with flag emojis — sorted by most common usage
const COUNTRIES = [
  { code: "US", dial: "+1", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { code: "GB", dial: "+44", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { code: "CA", dial: "+1", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { code: "AU", dial: "+61", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  { code: "DE", dial: "+49", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
  { code: "FR", dial: "+33", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
  { code: "ES", dial: "+34", flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
  { code: "IT", dial: "+39", flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
  { code: "NL", dial: "+31", flag: "\u{1F1F3}\u{1F1F1}", name: "Netherlands" },
  { code: "BR", dial: "+55", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
  { code: "MX", dial: "+52", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
  { code: "AR", dial: "+54", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina" },
  { code: "CO", dial: "+57", flag: "\u{1F1E8}\u{1F1F4}", name: "Colombia" },
  { code: "CL", dial: "+56", flag: "\u{1F1E8}\u{1F1F1}", name: "Chile" },
  { code: "PE", dial: "+51", flag: "\u{1F1F5}\u{1F1EA}", name: "Peru" },
  { code: "IN", dial: "+91", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
  { code: "JP", dial: "+81", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { code: "KR", dial: "+82", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
  { code: "CN", dial: "+86", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
  { code: "SG", dial: "+65", flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore" },
  { code: "AE", dial: "+971", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE" },
  { code: "SA", dial: "+966", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia" },
  { code: "IL", dial: "+972", flag: "\u{1F1EE}\u{1F1F1}", name: "Israel" },
  { code: "ZA", dial: "+27", flag: "\u{1F1FF}\u{1F1E6}", name: "South Africa" },
  { code: "NG", dial: "+234", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria" },
  { code: "EG", dial: "+20", flag: "\u{1F1EA}\u{1F1EC}", name: "Egypt" },
  { code: "KE", dial: "+254", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenya" },
  { code: "PH", dial: "+63", flag: "\u{1F1F5}\u{1F1ED}", name: "Philippines" },
  { code: "TH", dial: "+66", flag: "\u{1F1F9}\u{1F1ED}", name: "Thailand" },
  { code: "VN", dial: "+84", flag: "\u{1F1FB}\u{1F1F3}", name: "Vietnam" },
  { code: "ID", dial: "+62", flag: "\u{1F1EE}\u{1F1E9}", name: "Indonesia" },
  { code: "MY", dial: "+60", flag: "\u{1F1F2}\u{1F1FE}", name: "Malaysia" },
  { code: "PK", dial: "+92", flag: "\u{1F1F5}\u{1F1F0}", name: "Pakistan" },
  { code: "BD", dial: "+880", flag: "\u{1F1E7}\u{1F1E9}", name: "Bangladesh" },
  { code: "TR", dial: "+90", flag: "\u{1F1F9}\u{1F1F7}", name: "Turkey" },
  { code: "PL", dial: "+48", flag: "\u{1F1F5}\u{1F1F1}", name: "Poland" },
  { code: "SE", dial: "+46", flag: "\u{1F1F8}\u{1F1EA}", name: "Sweden" },
  { code: "NO", dial: "+47", flag: "\u{1F1F3}\u{1F1F4}", name: "Norway" },
  { code: "DK", dial: "+45", flag: "\u{1F1E9}\u{1F1F0}", name: "Denmark" },
  { code: "FI", dial: "+358", flag: "\u{1F1EB}\u{1F1EE}", name: "Finland" },
  { code: "CH", dial: "+41", flag: "\u{1F1E8}\u{1F1ED}", name: "Switzerland" },
  { code: "AT", dial: "+43", flag: "\u{1F1E6}\u{1F1F9}", name: "Austria" },
  { code: "BE", dial: "+32", flag: "\u{1F1E7}\u{1F1EA}", name: "Belgium" },
  { code: "PT", dial: "+351", flag: "\u{1F1F5}\u{1F1F9}", name: "Portugal" },
  { code: "IE", dial: "+353", flag: "\u{1F1EE}\u{1F1EA}", name: "Ireland" },
  { code: "NZ", dial: "+64", flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand" },
  { code: "RO", dial: "+40", flag: "\u{1F1F7}\u{1F1F4}", name: "Romania" },
  { code: "CZ", dial: "+420", flag: "\u{1F1E8}\u{1F1FF}", name: "Czech Republic" },
  { code: "GR", dial: "+30", flag: "\u{1F1EC}\u{1F1F7}", name: "Greece" },
  { code: "HU", dial: "+36", flag: "\u{1F1ED}\u{1F1FA}", name: "Hungary" },
  { code: "UA", dial: "+380", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukraine" },
  { code: "RU", dial: "+7", flag: "\u{1F1F7}\u{1F1FA}", name: "Russia" },
  { code: "TW", dial: "+886", flag: "\u{1F1F9}\u{1F1FC}", name: "Taiwan" },
  { code: "HK", dial: "+852", flag: "\u{1F1ED}\u{1F1F0}", name: "Hong Kong" },
  { code: "CR", dial: "+506", flag: "\u{1F1E8}\u{1F1F7}", name: "Costa Rica" },
  { code: "PA", dial: "+507", flag: "\u{1F1F5}\u{1F1E6}", name: "Panama" },
  { code: "DO", dial: "+1", flag: "\u{1F1E9}\u{1F1F4}", name: "Dominican Republic" },
  { code: "PR", dial: "+1", flag: "\u{1F1F5}\u{1F1F7}", name: "Puerto Rico" },
];

// Detect country from timezone
function detectCountryFromTimezone(tz: string): string {
  const tzCountryMap: Record<string, string> = {
    "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
    "America/Los_Angeles": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US",
    "Europe/London": "GB", "Europe/Paris": "FR", "Europe/Berlin": "DE",
    "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL",
    "America/Toronto": "CA", "America/Vancouver": "CA",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
    "America/Sao_Paulo": "BR", "America/Mexico_City": "MX",
    "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO",
    "Asia/Kolkata": "IN", "Asia/Tokyo": "JP", "Asia/Seoul": "KR",
    "Asia/Shanghai": "CN", "Asia/Singapore": "SG", "Asia/Dubai": "AE",
    "Asia/Jerusalem": "IL", "Africa/Johannesburg": "ZA",
    "Pacific/Auckland": "NZ", "Europe/Istanbul": "TR",
  };
  return tzCountryMap[tz] || "US";
}

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

// Common timezones grouped by region
const COMMON_TIMEZONES = [
  { label: "US Eastern", value: "America/New_York" },
  { label: "US Central", value: "America/Chicago" },
  { label: "US Mountain", value: "America/Denver" },
  { label: "US Pacific", value: "America/Los_Angeles" },
  { label: "US Alaska", value: "America/Anchorage" },
  { label: "US Hawaii", value: "Pacific/Honolulu" },
  { label: "London", value: "Europe/London" },
  { label: "Paris / Berlin", value: "Europe/Paris" },
  { label: "Helsinki / Bucharest", value: "Europe/Helsinki" },
  { label: "Istanbul", value: "Europe/Istanbul" },
  { label: "Dubai", value: "Asia/Dubai" },
  { label: "Mumbai / Kolkata", value: "Asia/Kolkata" },
  { label: "Bangkok / Jakarta", value: "Asia/Bangkok" },
  { label: "Singapore / KL", value: "Asia/Singapore" },
  { label: "Shanghai / Beijing", value: "Asia/Shanghai" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Seoul", value: "Asia/Seoul" },
  { label: "Sydney", value: "Australia/Sydney" },
  { label: "Auckland", value: "Pacific/Auckland" },
  { label: "São Paulo", value: "America/Sao_Paulo" },
  { label: "Buenos Aires", value: "America/Argentina/Buenos_Aires" },
  { label: "Toronto", value: "America/Toronto" },
  { label: "Mexico City", value: "America/Mexico_City" },
  { label: "Bogotá / Lima", value: "America/Bogota" },
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

interface BookingClientProps {
  eventType: EventType;
  settings: SiteSettings;
  slug: string;
  teamSlug: string;
  teamName: string;
}

export default function BookingClient({ eventType, settings, slug, teamSlug, teamName }: BookingClientProps) {
  const isEmbed = useIsEmbed();
  const dateScrollRef = useRef<HTMLDivElement>(null);

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

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: "error" | "warning" | "success" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "warning" | "success" = "error") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 6000);
  };

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const tz = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York";
    const code = detectCountryFromTimezone(tz);
    return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryPickerRef = useRef<HTMLDivElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  // Dynamic booking questions from event type config
  const bookingQuestions = eventType.booking_questions || [];

  // Close country picker on click outside
  useEffect(() => {
    if (!showCountryPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(e.target as Node)) {
        setShowCountryPicker(false);
        setCountrySearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCountryPicker]);

  // Auto-focus search when country picker opens
  useEffect(() => {
    if (showCountryPicker && countrySearchRef.current) {
      countrySearchRef.current.focus();
    }
  }, [showCountryPicker]);

  // Memoize filtered countries
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const lower = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.dial.includes(lower) || c.code.toLowerCase().includes(lower)
    );
  }, [countrySearch]);

  // Format phone for display (US: (xxx) xxx-xxxx)
  const formatPhoneDisplay = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (selectedCountry.code === "US" || selectedCountry.code === "CA" || (selectedCountry.dial === "+1")) {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 15);
    setPhone(raw);
  };

  // Memoize filtered topics
  const filteredTopics = useMemo(() => {
    if (!topic.trim()) return TOPIC_SUGGESTIONS;
    const lower = topic.toLowerCase();
    return TOPIC_SUGGESTIONS.filter((t) => t.toLowerCase().includes(lower));
  }, [topic]);

  // Timezone — auto-detected, user can override
  const [timezone, setTimezone] = useState(() =>
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "America/New_York"
  );
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [tzSearch, setTzSearch] = useState("");
  const tzPickerRef = useRef<HTMLDivElement>(null);

  // Close timezone picker on click outside
  useEffect(() => {
    if (!showTzPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (tzPickerRef.current && !tzPickerRef.current.contains(e.target as Node)) {
        setShowTzPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTzPicker]);

  // Memoize calendar days — today + max_advance_days into the future
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDays = (eventType.max_advance_days || 10) + 1; // +1 to include today
  const days = useMemo(() => Array.from({ length: maxDays }, (_, i) => addDays(today, i)), [today, maxDays]);

  // Date scroll navigation
  const [dateOffset, setDateOffset] = useState(0);
  const visibleDays = 7;

  // Fetch slots when date selected
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetch(
      `/api/availability?date=${dateStr}&eventType=${slug}&teamSlug=${teamSlug}&timezone=${encodeURIComponent(timezone)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoadingSlots(false);
      })
      .catch(() => setLoadingSlots(false));
  }, [selectedDate, slug, teamSlug, timezone]);

  // Check if all required custom questions are answered
  const requiredQuestionsComplete = bookingQuestions
    .filter((q) => q.required)
    .every((q) => {
      const val = customAnswers[q.id];
      if (q.type === "checkbox") return val === true;
      return val && String(val).trim() !== "";
    });

  const handleBook = async () => {
    if (!selectedSlot || !name || !email || !phone || !requiredQuestionsComplete) return;
    setBooking(true);

    const fullPhone = `${selectedCountry.dial}${phone}`;

    // Only include non-empty custom answers
    const filteredAnswers: Record<string, any> = {};
    for (const [k, v] of Object.entries(customAnswers)) {
      if (v !== "" && v !== false && v !== undefined && v !== null) {
        filteredAnswers[k] = v;
      }
    }

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeSlug: slug,
          teamSlug,
          startTime: selectedSlot.start,
          timezone,
          name,
          email,
          phone: fullPhone,
          notes: [topic && `Topic: ${topic}`, notes].filter(Boolean).join("\n") || undefined,
          custom_answers: Object.keys(filteredAnswers).length > 0 ? filteredAnswers : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfirmation(data.booking);
        setStep("confirmed");
        // Show warnings for partial failures (calendar sync, email delivery)
        if (data.warnings && data.warnings.length > 0) {
          showToast(data.warnings[0], "warning");
        }
      } else {
        showToast(data.error || "Booking failed. Please try again.", "error");
      }
    } catch {
      showToast("Something went wrong. Please check your connection and try again.", "error");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className={`${isEmbed ? "p-2 sm:p-4" : "min-h-screen p-4"} flex items-center justify-center`}>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-xl shadow-lg border animate-fade-in-up flex items-start gap-3 ${
            toast.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : toast.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => { setToast(null); if (toastTimeout.current) clearTimeout(toastTimeout.current); }}
            className="text-current opacity-50 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6 animate-fade-in-up">
          {!isEmbed && (
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-600 mb-3 sm:mb-4 transition-colors"
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
              <p className="text-gray-500 text-xs sm:text-sm flex items-center gap-1">
                {eventType.duration_minutes} min ·{" "}
                <button
                  onClick={() => setShowTzPicker(!showTzPicker)}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors underline decoration-dotted underline-offset-2"
                >
                  <Globe className="w-3 h-3" />
                  {timezone.replace(/_/g, " ")}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Timezone Picker Dropdown */}
        {showTzPicker && (
          <div
            ref={tzPickerRef}
            className="bg-white rounded-xl border border-gray-200 shadow-lg mb-4 overflow-hidden animate-fade-in"
          >
            <div className="p-3 border-b border-gray-100">
              <input
                type="text"
                value={tzSearch}
                onChange={(e) => setTzSearch(e.target.value)}
                placeholder="Search timezones..."
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {COMMON_TIMEZONES.filter(
                (tz) =>
                  tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
                  tz.value.toLowerCase().includes(tzSearch.toLowerCase())
              ).map((tz) => (
                <button
                  key={tz.value}
                  onClick={() => {
                    setTimezone(tz.value);
                    setShowTzPicker(false);
                    setTzSearch("");
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${
                    timezone === tz.value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                  }`}
                >
                  <span>{tz.label}</span>
                  <span className="text-xs text-gray-500">{tz.value.replace(/_/g, " ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                            ? "text-white shadow-lg scale-[1.02]"
                            : isWeekend
                            ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                            : isToday
                            ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            : "bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-gray-700 border border-transparent"
                        }`}
                      style={isSelected ? { backgroundColor: settings.primary_color } : undefined}
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
                  <div className="text-center py-8 sm:py-12 text-gray-500 animate-fade-in text-sm sm:text-base">
                    No available times on this day.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-h-56 sm:max-h-64 overflow-y-auto hide-scrollbar pt-2 pr-1">
                    {slots.map((slot, i) => (
                      <button
                        key={slot.start}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep("form");
                        }}
                        className={`relative py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 animate-fade-in-up stagger-${Math.min(i + 1, 9)} hover:scale-[1.03] active:scale-95 ${
                          slot.label === "popular"
                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 hover:border-emerald-300"
                            : slot.label === "recommended"
                            ? "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 hover:border-blue-300"
                            : "bg-gray-50 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm text-gray-700"
                        }`}
                      >
                        {new Date(slot.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        {slot.label && (
                          <span className={`absolute -top-1.5 -right-1 text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                            slot.label === "popular"
                              ? "bg-emerald-500 text-white"
                              : "bg-blue-500 text-white"
                          }`}>
                            {slot.label === "popular" ? "Popular" : "Top"}
                          </span>
                        )}
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
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-600 mb-3 sm:mb-4 transition-colors"
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

              {/* Phone Number with Country Picker */}
              <div className="animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <div className="flex gap-0">
                  {/* Country selector */}
                  <div className="relative" ref={countryPickerRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCountryPicker(!showCountryPicker);
                        setCountrySearch("");
                      }}
                      className="flex items-center gap-1 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm sm:text-base whitespace-nowrap"
                    >
                      <span className="text-base sm:text-lg leading-none">{selectedCountry.flag}</span>
                      <span className="text-gray-600 text-xs sm:text-sm font-medium">{selectedCountry.dial}</span>
                      <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${showCountryPicker ? "rotate-90" : ""}`} />
                    </button>

                    {/* Country dropdown */}
                    {showCountryPicker && (
                      <div className="absolute top-full left-0 mt-1 w-64 sm:w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-fade-in">
                        <div className="p-2 border-b border-gray-100">
                          <input
                            ref={countrySearchRef}
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredCountries.map((c) => (
                            <button
                              key={c.code + c.dial}
                              onClick={() => {
                                setSelectedCountry(c);
                                setShowCountryPicker(false);
                                setCountrySearch("");
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2.5 ${
                                selectedCountry.code === c.code && selectedCountry.dial === c.dial ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                              }`}
                            >
                              <span className="text-base leading-none">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-xs text-gray-500">{c.dial}</span>
                            </button>
                          ))}
                          {filteredCountries.length === 0 && (
                            <div className="px-3 py-4 text-sm text-gray-400 text-center">No countries found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phone input */}
                  <input
                    type="tel"
                    value={formatPhoneDisplay(phone)}
                    onChange={handlePhoneChange}
                    placeholder={selectedCountry.code === "US" || selectedCountry.dial === "+1" ? "(555) 123-4567" : "Phone number"}
                    className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-r-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Topic with AI suggestions */}
              <div className="animate-fade-in-up relative" style={{ animationDelay: "0.18s" }}>
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 transition-colors"
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

              <div className="animate-fade-in-up" style={{ animationDelay: "0.24s" }}>
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

              {/* Dynamic Booking Questions */}
              {bookingQuestions.map((q, qi) => (
                <div key={q.id} className="animate-fade-in-up" style={{ animationDelay: `${0.28 + qi * 0.04}s` }}>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {q.label}{q.required && " *"}
                  </label>
                  {q.type === "text" && (
                    <input
                      type="text"
                      value={customAnswers[q.id] || ""}
                      onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={`Enter ${q.label.toLowerCase()}`}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm sm:text-base"
                    />
                  )}
                  {q.type === "dropdown" && (
                    <select
                      value={customAnswers[q.id] || ""}
                      onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm sm:text-base bg-white"
                    >
                      <option value="">Select...</option>
                      {(q.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {q.type === "checkbox" && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!customAnswers[q.id]}
                        onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Yes</span>
                    </label>
                  )}
                </div>
              ))}

              <button
                onClick={handleBook}
                disabled={!name || !email || !phone || !requiredQuestionsComplete || booking}
                className={`w-full py-2.5 sm:py-3 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base animate-fade-in-up ${
                  !booking && name && email && phone && requiredQuestionsComplete ? "hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]" : ""
                }`}
                style={{
                  animationDelay: "0.3s",
                  backgroundColor: !name || !email || !phone || !requiredQuestionsComplete || booking ? undefined : settings.primary_color,
                }}
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
          <span className="text-[10px] sm:text-xs text-gray-500">
            Powered by{" "}
            <span className="font-semibold rainbow-shimmer">Slotly ⚡</span>
          </span>
        </div>
      </div>
    </div>
  );
}
