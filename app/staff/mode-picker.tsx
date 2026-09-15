"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "okubu.mode";

/**
 * Distinguishes "not read yet" (the server render, where there is no
 * localStorage) from "nothing saved". Only "hall" and "kitchen" are ever
 * written, so this can never collide with a real value.
 */
const UNRESOLVED = "__unresolved__";

/** The saved choice never changes while this screen is open. */
function subscribe() {
  return () => {};
}

function readSavedMode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Private browsing or blocked storage: behave as if nothing was saved.
    return "";
  }
}

function readServerMode(): string {
  return UNRESOLVED;
}

/**
 * A device almost always plays one role: the iPad downstairs is always the
 * kitchen, the waiter's tablet is always the hall. So the choice is
 * remembered per device and the picker is skipped next time.
 *
 * Arriving with ?pick=1 (the "Switch view" link) forces the picker back.
 *
 * localStorage is read through useSyncExternalStore rather than in an effect,
 * so there is no render-then-correct cascade: the first client render already
 * knows the answer.
 */
export function ModePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcePick = searchParams.get("pick") === "1";

  const saved = useSyncExternalStore(subscribe, readSavedMode, readServerMode);

  const resolved = saved !== UNRESOLVED;
  const shouldRedirect =
    resolved && !forcePick && (saved === "hall" || saved === "kitchen");

  useEffect(() => {
    if (!forcePick) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to forget.
    }
  }, [forcePick]);

  useEffect(() => {
    if (shouldRedirect) router.replace(`/staff/${saved}`);
  }, [shouldRedirect, saved, router]);

  function choose(mode: "hall" | "kitchen") {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Not fatal — the picker just appears again next time.
    }
    router.replace(`/staff/${mode}`);
  }

  // Blank while localStorage is still unknown, and while redirecting — better
  // than flashing a picker the device has already answered.
  if (!resolved || shouldRedirect) return null;

  return (
    <main className="flex flex-1 flex-col justify-center gap-4 p-6">
      <p className="text-center text-slate-500">
        Select your role 
      </p>

      <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <button
          onClick={() => choose("hall")}
          className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl
                     bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 active:bg-slate-100"
        >
          <span className="text-5xl" aria-hidden>🍽</span>
          <span className="text-2xl font-bold">Hall</span>
          <span className="text-sm text-slate-500">Take orders</span>
        </button>

        <button
          onClick={() => choose("kitchen")}
          className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl
                     bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 active:bg-slate-100"
        >
          <span className="text-5xl" aria-hidden>🍳</span>
          <span className="text-2xl font-bold">Kitchen</span>
          <span className="text-sm text-slate-500">Cook orders</span>
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        This device will remember your choice.
      </p>
    </main>
  );
}
