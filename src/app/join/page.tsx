"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  CheckCircle2,
  Loader2,
  ShieldX,
  Calendar,
  RefreshCw,
} from "lucide-react";

type Step = "validating" | "invalid" | "connect" | "done" | "reauth_done" | "error";

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
  const success = searchParams.get("success");
  const reauth = searchParams.get("reauth");
  const errorCode = searchParams.get("error");
  const userName = searchParams.get("name") || "";
  const userAvatar = searchParams.get("avatar") || "";

  const [step, setStep] = useState<Step>("validating");
  const [invalidReason, setInvalidReason] = useState("");

  // Handle OAuth callback redirects
  useEffect(() => {
    if (success) {
      setStep("done");
      return;
    }
    if (reauth === "success") {
      setStep("reauth_done");
      return;
    }
    if (errorCode) {
      setStep("error");
      setInvalidReason(getErrorMessage(errorCode));
      return;
    }

    // Normal invite flow — validate token
    if (!inviteToken) {
      setInvalidReason("No invite token provided. You need an invite link from your admin.");
      setStep("invalid");
      return;
    }

    fetch(`/api/invite/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setStep("connect");
        } else {
          setInvalidReason(data.error || "Invalid invite link.");
          setStep("invalid");
        }
      })
      .catch(() => {
        setInvalidReason("Could not verify invite. Please try again.");
        setStep("invalid");
      });
  }, [inviteToken, success, reauth, errorCode]);

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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid invite</h1>
            <p className="text-base text-gray-400 max-w-[380px] mx-auto">
              {invalidReason}
            </p>
            <p className="text-sm text-gray-300 mt-4 max-w-[380px] mx-auto">
              If you think this is a mistake, ask your admin for a new invite link.
            </p>
          </div>
        )}

        {/* Error from OAuth callback */}
        {step === "error" && (
          <div className="animate-fade-in-up text-center pt-8">
            <div className="w-14 h-14 bg-red-50 rounded-2xl grid place-items-center mx-auto mb-4">
              <ShieldX className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-base text-gray-400 max-w-[380px] mx-auto">
              {invalidReason}
            </p>
            <p className="text-sm text-gray-300 mt-4 max-w-[380px] mx-auto">
              Please ask your admin for a new invite link and try again.
            </p>
          </div>
        )}

        {/* Connect with Google (single-action step) */}
        {step === "connect" && (
          <div className="animate-fade-in-up text-center pt-8">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl grid place-items-center mx-auto mb-4">
              <Calendar className="w-7 h-7 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect your calendar</h1>
            <p className="text-base text-gray-400 max-w-[400px] mx-auto mb-8">
              Sign in with your Google Workspace account to connect your calendar.
              We&apos;ll pull your name, email, and photo automatically.
            </p>

            {/* Google Sign-in button (follows Google branding guidelines) */}
            <a
              href={`/api/auth/google?invite=${encodeURIComponent(inviteToken)}`}
              className="inline-flex items-center gap-3 px-6 py-3.5 bg-white border-[1.5px] border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm group"
            >
              {/* Google G logo */}
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span className="text-base font-semibold text-gray-700 group-hover:text-gray-900">
                Connect with Google
              </span>
            </a>

            <div className="mt-8 bg-indigo-50 rounded-xl p-4 text-left max-w-[400px] mx-auto">
              <p className="text-sm text-indigo-700">
                <strong>What happens next:</strong> After connecting, your admin will review
                your request and add you to a team. You&apos;ll start receiving bookings
                once approved.
              </p>
            </div>

            <p className="text-xs text-gray-300 mt-4 max-w-[400px] mx-auto">
              We only access your calendar to check availability and create booking events.
              You can disconnect anytime.
            </p>
          </div>
        )}

        {/* Success — new member */}
        {step === "done" && (
          <div className="animate-scale-in text-center pt-8">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl grid place-items-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-check-pop" />
            </div>

            {userAvatar && (
              <img
                src={decodeURIComponent(userAvatar)}
                alt=""
                className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-white shadow-sm"
              />
            )}

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {success === "reconnected"
                ? "Calendar reconnected!"
                : success === "reactivated"
                ? "Welcome back!"
                : "You're all set!"}
            </h1>

            {userName && (
              <p className="text-lg text-gray-600 font-medium mb-2">
                {decodeURIComponent(userName)}
              </p>
            )}

            <p className="text-base text-gray-400 max-w-[360px] mx-auto">
              {success === "reconnected"
                ? "Your Google Calendar is reconnected. No action needed."
                : "Your calendar is connected and your request has been submitted. An admin will review and add you to the team."}
            </p>
          </div>
        )}

        {/* Success — re-auth */}
        {step === "reauth_done" && (
          <div className="animate-scale-in text-center pt-8">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl grid place-items-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 text-emerald-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Calendar reconnected!</h1>

            {userName && (
              <p className="text-lg text-gray-600 font-medium mb-2">
                {decodeURIComponent(userName)}
              </p>
            )}

            <p className="text-base text-gray-400 max-w-[360px] mx-auto">
              Your Google Calendar connection has been refreshed. You&apos;ll continue
              receiving bookings as normal.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function getErrorMessage(code: string): string {
  switch (code) {
    case "consent_denied":
      return "You declined the Google Calendar permission. We need calendar access to check your availability and create booking events.";
    case "missing_params":
      return "The OAuth callback was missing required parameters. Please try again.";
    case "invalid_state":
      return "The authentication session expired. Please try again with a fresh invite link.";
    case "no_refresh_token":
      return "Google did not provide the required permissions. Please try again and make sure to approve all requested access.";
    case "no_email":
      return "Could not retrieve your email from Google. Please try again.";
    case "invite_expired":
      return "Your invite link has expired or was already used.";
    case "create_failed":
      return "Failed to create your account. Please try again or contact your admin.";
    case "reauth_expired":
      return "Your reconnect link has expired. Please ask your admin for a new one.";
    case "email_mismatch":
      return "The Google account you signed in with doesn't match the email on file. Please sign in with the correct account.";
    case "server_error":
      return "An unexpected error occurred. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
