"use client";

/**
 * A short two-note chime, generated rather than loaded from a file: nothing
 * to download or cache, and it still works if the restaurant's internet drops.
 *
 * One shared AudioContext for the whole page. Browsers refuse to start audio
 * until the user has interacted, so the context is created on the tap that
 * turns sound on — which doubles as the unlock.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null; // Audio unavailable; the screen still works, just silently.
  }
}

export function playChime() {
  const audio = context();
  if (!audio) return;

  const now = audio.currentTime;

  // Two rising notes, so it does not sound like a phone notification.
  [880, 1320].forEach((frequency, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const start = now + i * 0.18;

    osc.type = "sine";
    osc.frequency.value = frequency;

    // Ramped rather than switched on: a square edge clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

