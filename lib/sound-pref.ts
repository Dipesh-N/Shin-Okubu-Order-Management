"use client";

/**
 * Whether this device chimes on a new ticket. Per device, not per account:
 * the kitchen iPad wants sound, a waiter's phone almost certainly does not.
 *
 * A tiny external store rather than component state, so the toggle button and
 * the chime hook always agree without passing props between them.
 */
const STORAGE_KEY = "okubu.sound";

const listeners = new Set<() => void>();

function readStored(): "on" | "off" {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on" ? "on" : "off";
  } catch {
    return "off";
  }
}

export function subscribeSound(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSoundSnapshot(): "on" | "off" {
  return readStored();
}

/** The server has no localStorage; sound is off until the client says so. */
export function getSoundServerSnapshot(): "on" | "off" {
  return "off";
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Blocked storage: the choice just will not survive a reload.
  }
  for (const listener of listeners) listener();
}
