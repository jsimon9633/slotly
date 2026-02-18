"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  User,
  Mail,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ShieldX,
} from "lucide-react";

type Step = "validating" | "invalid" | "info" | "calendar" | "done";

const SERVICE_ACCOUNT_EMAIL = "slotly-calendar@slotly-fast-scheduling.iam.gserviceaccount.com";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      }
    >
      <JoinPageInner />
    </Suspense>
  );
}

function JoinPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";

  const [step, setStep] = useState<Step>("validating");
  const [invalidReason, setInvalidReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [calendarShared, setCalendarShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) {
      setInvalidReason("No invite token provided. You need an invite link from your admin.");
      setStep("invalid");
      return;
    }

    fetch(`/api/invite/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setStep("info");
        } else {
          setInvalidReason(data.error || "Invalid invite link.");
          setStep("invalid");
        }
      })
      .catch(() => {
        setInvalidReason("Could not verify invite. Please try again.");
        setStep("invalid");
      });
  }, [inviteToken]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canProceedInfo = name.trim().length >= 2 && isValidEmail;

  const copyServiceEmail = () => {
    navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          calendarShared,
          inviteToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }

      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const wizardSteps = [
    { key: "info", label: "Your info" },
    { key: "calendar", label: "Share & submit" },
  ];

  const currentIndex = wizardSteps.findIndex(
    (s) => s.key === step || (step === "validating" && s.key === "info")
  );

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col">
      {/* Header */}
      <header className="max-w-[560px] w-full mx-auto flex items-center gap-2 px-4 sm:px-5 pt-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg grid place-items-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">Slotly</span>
        </Link>
        <span className="text-sm text-gray-300 ml-1">Join the team</span>
      </header>

      <main className="flex-1 max-w-[560px] w-full mx-auto px-4 sm:px-5 pt-6 sm:pt-8 pb-12">

        {/* Validating state */}
        {step === "validating" && (
          <div className="animate-fade-in text-center pt-12">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-base text-gray-400">Verifying your invite...</p>
          </div>
        )}

        {/* Invalid invite */}
        {step === "invalid" && (
          <div className="animate-fade-in-up text-center pt-8">
            <div className="w-14 h-14 bg-red-50 rounded-2xl grid place-items-center mx-auto mb-4">
              <ShieldX className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {invalidReason.includes("not found") ? "Invite no longer valid" : "Invalid invite"}
            </h1>
            <p className="text-base text-gray-400 max-w-[380px] mx-auto">
              {invalidReason}
            </p>
            <p className="text-sm text-gray-300 mt-4 max-w-[380px] mx-auto">
              If you think this is a mistake, ask your admin for a new invite link.
            </p>
          </div>
        )}

        {/* Progress bar (only for wizard steps) */}
        {["info", "calendar"].includes(step) && (
          <div className="flex items-center gap-2 mb-6 animate-fade-in">
            {wizardSteps.map((s, i) => (
              <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                    i <= currentIndex ? "bg-indigo-500" : "bg-gray-200"
                  }`}
                />
                <span
                  className={`text-sm font-medium transition-colors ${
                    i <= currentIndex ? "text-indigo-600" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Your Info */}
        {step === "info" && (
          <div className="animate-fade-in-up">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to Slotly</h1>
            <p className="text-base text-gray-400 mb-6">
              Let&apos;s get you set up for round-robin scheduling.
            </p>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  Google Workspace email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-300"
                />
                <p className="text-sm text-gray-400 mt-1.5">
                  Must be a Google Workspace account so we can check your availability.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep("calendar")}
              disabled={!canProceedInfo}
              className={`mt-8 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-base font-semibold transition-all ${
                canProceedInfo
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Share Calendar & Submit */}
        {step === "calendar" && (
          <div className="animate-fade-in-up">
            <button
              onClick={() => setStep("info")}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <h1 className="text-2xl font-bold text-gray-900">Share your calendar</h1>
            </div>
            <p className="text-base text-gray-400 mb-5">
              Share your Google Calendar with our service account so Slotly can check when you&apos;re free.
            </p>

            {/* Instructions card */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full grid place-items-center flex-shrink-0 text-xs font-bold mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-base text-gray-700 font-medium">Open Google Calendar settings</p>
                  <a
                    href="https://calendar.google.com/calendar/r/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mt-0.5"
                  >
                    Open settings
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full grid place-items-center flex-shrink-0 text-xs font-bold mt-0.5">
                  2
                </div>
                <p className="text-base text-gray-700 font-medium">
                  Click your calendar → &quot;Share with specific people or groups&quot;
                </p>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full grid place-items-center flex-shrink-0 text-xs font-bold mt-0.5">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-700 font-medium">Add this email with &quot;See all event details&quot;</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 break-all flex-1">
                      {SERVICE_ACCOUNT_EMAIL}
                    </code>
                    <button
                      onClick={copyServiceEmail}
                      className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Copy email"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full grid place-items-center flex-shrink-0 text-xs font-bold mt-0.5">
                  4
                </div>
                <p className="text-base text-gray-700 font-medium">Click &quot;Send&quot; to confirm</p>
              </div>
            </div>

            {/* Confirmation checkbox */}
            <label className="mt-5 flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={calendarShared}
                  onChange={(e) => setCalendarShared(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border-[1.5px] border-gray-300 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all grid place-items-center group-hover:border-indigo-300">
                  {calendarShared && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
              <span className="text-base text-gray-600">
                I&apos;ve shared my Google Calendar with the Slotly service account
              </span>
            </label>

            {/* Summary */}
            <div className="mt-5 bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Name</span>
                <span className="text-base text-gray-900 font-medium">{name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-base text-gray-900 font-medium">{email}</span>
              </div>
            </div>

            <div className="mt-3 bg-indigo-50 rounded-xl p-4">
              <p className="text-sm text-indigo-700">
                <strong>What happens next:</strong> Your admin will review your request and add you to the round-robin. Slotly uses your live Google Calendar — no extra setup needed.
              </p>
            </div>

            {error && (
              <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-xl p-4 font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!calendarShared || submitting}
              className={`mt-5 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-base font-semibold transition-all ${
                calendarShared && !submitting
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit request
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="animate-scale-in text-center pt-8">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl grid place-items-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-check-pop" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
            <p className="text-base text-gray-400 max-w-[360px] mx-auto">
              Your request has been submitted. An admin will review it and add you to the
              round-robin scheduling. You&apos;ll start receiving bookings once approved.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
