"use client";

import { useEffect } from "react";

/**
 * A brief confirmation at the bottom of the screen. Chosen over a modal
 * because a waiter must never have to dismiss something to carry on working.
 */
export function Toast({
  message,
  onDone,
  ms = 3000,
}: {
  message: string | null;
  onDone: () => void;
  ms?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [message, ms, onDone]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
    >
      <p className="rounded-xl bg-slate-900 px-5 py-3 text-center font-semibold text-white shadow-lg">
        {message}
      </p>
    </div>
  );
}
