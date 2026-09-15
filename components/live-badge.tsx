"use client";

/**
 * Only appears when the realtime connection is down.
 *
 * Silence would be dangerous here: the kitchen must know the difference
 * between "no new orders" and "this screen stopped listening". The screen is
 * still correct in that state — it falls back to polling — so the wording
 * reassures rather than alarms.
 */
export function LiveBadge({ live }: { live: boolean }) {
  if (live) return null;

  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      Reconnecting… orders still refresh every 15 seconds.
    </div>
  );
}
