import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating circle in the corner is Next.js's development indicator. It
  // never ships to production, but it sits on top of the Hall and Kitchen
  // screens while testing on a tablet, so hide it. Compile and runtime errors
  // are still surfaced.
  devIndicators: false,
};

export default nextConfig;
