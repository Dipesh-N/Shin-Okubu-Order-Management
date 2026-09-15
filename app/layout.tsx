import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RESTAURANT_NAME } from "@/lib/restaurant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // The template appends the name to every child page's title, so pages only
  // set their own part ("Hall" becomes "Hall · Okubu Momo").
  title: {
    default: RESTAURANT_NAME,
    template: `%s · ${RESTAURANT_NAME}`,
  },
  description: `Order management for ${RESTAURANT_NAME}`,
};

// Tablets and phones: fill the screen, and never zoom on input focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning on <html> and <body> only:
    // browser extensions (password managers, colour pickers, Grammarly) add
    // their own attributes to these two elements before React hydrates, which
    // React then reports as a mismatch. It is shallow — it covers these tags'
    // own attributes and nothing inside them — so a real hydration bug in the
    // app's own components is still reported.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
