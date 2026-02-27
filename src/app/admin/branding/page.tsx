"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  ArrowLeft,
  Palette,
  Lock,
  Loader2,
  Check,
  Image,
  Type,
  Pipette,
  Eye,
} from "lucide-react";
import Link from "next/link";

const ADMIN_TOKEN_KEY = "slotly_admin_token";
const ADMIN_USERNAME = "albertos";

const PRESET_COLORS = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Emerald", value: "#059669" },
  { label: "Rose", value: "#e11d48" },
  { label: "Orange", value: "#ea580c" },
  { label: "Slate", value: "#475569" },
  { label: "Teal", value: "#0d9488" },
];

export default function AdminBrandingPage() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [companyName, setCompanyName] = useState("Slotly");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auth check
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  // Fetch current settings
  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.company_name) setCompanyName(data.company_name);
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.primary_color) setPrimaryColor(data.primary_color);
        if (data.accent_color) setAccentColor(data.accent_color);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authenticated]);

  const handleLogin = () => {
    if (!username.trim() || !token.trim()) return;
    if (username.trim().toLowerCase() !== ADMIN_USERNAME) {
      setError("Invalid credentials.");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    setAuthenticated(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/settings?token=${encodeURIComponent(token)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          accent_color: accentColor,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
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
          <div className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center bg-white text-gray-900 shadow-sm whitespace-nowrap px-2">
            Branding
          </div>
          <Link
            href="/admin/email-templates"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Emails
          </Link>
          <Link
            href="/admin/webhooks"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Webhooks
          </Link>
          <Link
            href="/admin/workflows"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Workflows
          </Link>
          <Link
            href="/admin/analytics"
            className="flex-1 text-sm sm:text-base font-semibold py-2 sm:py-2.5 rounded-md text-center text-gray-400 hover:text-gray-600 transition-all whitespace-nowrap px-2"
          >
            Analytics
          </Link>
        </div>
      </div>

      <main className="max-w-[720px] sm:max-w-[860px] mx-auto px-5 sm:px-8 pt-7 sm:pt-9 pb-14">
        {/* Title */}
        <div className="mb-6 sm:mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2.5 mb-1">
            <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Custom Branding</h1>
          </div>
          <p className="text-base sm:text-lg text-gray-400">
            Customize how Slotly looks to your invitees.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Company Name */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up">
              <div className="flex items-center gap-2.5 mb-4">
                <Type className="w-5 h-5 text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Company Name</h2>
              </div>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={50}
                placeholder="Your Company"
                className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
              <p className="text-xs text-gray-400 mt-2">
                Shown in the page header. The footer always shows &quot;Powered by Slotly&quot;.
              </p>
            </div>

            {/* Logo URL */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up">
              <div className="flex items-center gap-2.5 mb-4">
                <Image className="w-5 h-5 text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Logo</h2>
              </div>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://yoursite.com/logo.png"
                className="w-full px-4 py-3 text-base bg-white border-[1.5px] border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
              <p className="text-xs text-gray-400 mt-2">
                Direct URL to your logo image. Recommended: square, at least 64×64px.
              </p>
              {logoUrl && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-500">Preview</span>
                </div>
              )}
            </div>

            {/* Primary Color */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up">
              <div className="flex items-center gap-2.5 mb-4">
                <Pipette className="w-5 h-5 text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Primary Color</h2>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                      setPrimaryColor(e.target.value);
                    }
                  }}
                  maxLength={7}
                  className="w-28 px-3 py-2 text-sm font-mono bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setPrimaryColor(c.value)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      primaryColor === c.value ? "border-gray-900 scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Used for buttons, selected states, and accent UI elements.
              </p>
            </div>

            {/* Accent Color */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up">
              <div className="flex items-center gap-2.5 mb-4">
                <Palette className="w-5 h-5 text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Accent Color</h2>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                      setAccentColor(e.target.value);
                    }
                  }}
                  maxLength={7}
                  className="w-28 px-3 py-2 text-sm font-mono bg-white border-[1.5px] border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Used for highlights, hover states, and secondary elements.
              </p>
            </div>

            {/* Live Preview */}
            <div className="bg-white rounded-xl border-[1.5px] border-gray-100 p-5 sm:p-6 animate-fade-in-up">
              <div className="flex items-center gap-2.5 mb-4">
                <Eye className="w-5 h-5 text-gray-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Preview</h2>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 flex flex-col items-center gap-4">
                {/* Mini header preview */}
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg grid place-items-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="text-lg font-bold text-gray-900">{companyName || "Slotly"}</span>
                </div>
                {/* Mini button preview */}
                <button
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  Confirm Booking
                </button>
                {/* Mini accent preview */}
                <div
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  Selected Time Slot
                </div>
                <span className="text-xs text-gray-400">
                  Powered by <span className="font-semibold rainbow-shimmer">Slotly ⚡</span>
                </span>
              </div>
            </div>

            {/* Save button */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-base font-semibold text-white transition-all flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                "Save Branding"
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
