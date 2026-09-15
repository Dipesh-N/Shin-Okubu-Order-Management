"use client";

import { useSyncExternalStore } from "react";
import { playChime } from "@/lib/chime";
import {
  getSoundServerSnapshot,
  getSoundSnapshot,
  setSoundEnabled,
  subscribeSound,
} from "@/lib/sound-pref";

export function useSoundEnabled(): boolean {
  return (
    useSyncExternalStore(
      subscribeSound,
      getSoundSnapshot,
      getSoundServerSnapshot,
    ) === "on"
  );
}

export function SoundToggle() {
  const enabled = useSoundEnabled();

  return (
    <button
      onClick={() => {
        const next = !enabled;
        setSoundEnabled(next);
        // Turning it on is a user gesture, which is the only moment a browser
        // will let audio start. Playing here both unlocks it and proves to the
        // kitchen that this device can actually be heard.
        if (next) playChime();
      }}
      aria-pressed={enabled}
      title={
        enabled
          ? "Sound on — tap to mute new order alerts"
          : "Sound off — tap to hear new orders"
      }
      className={`flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 font-bold ${
        enabled
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-500 ring-1 ring-slate-300 active:bg-slate-100"
      }`}
    >
      <span aria-hidden className="text-lg leading-none">
        {enabled ? "\u{1F514}" : "\u{1F507}"}
      </span>
      <span className="hidden sm:inline">{enabled ? "Sound on" : "Muted"}</span>
    </button>
  );
}
