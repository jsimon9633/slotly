import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export const metadata: Metadata = {
  title: "Slotly — Fast Scheduling",
  description:
    "Book meetings instantly with smart round-robin scheduling. No back-and-forth — just pick a time that works.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Slotly — Fast Scheduling",
    description:
      "Book meetings instantly with smart round-robin scheduling.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to Supabase for faster API calls */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"}
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"}
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
