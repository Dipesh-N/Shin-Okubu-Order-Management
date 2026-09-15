"use client";

import { useEffect, useRef } from "react";
import { playChime } from "@/lib/chime";

/**
 * Plays a chime when a ticket the kitchen has never seen appears.
 *
 * @param newOrderIds ids of tickets currently waiting (status NEW)
 * @param enabled     whether this device wants sound
 */
export function useNewOrderChime(newOrderIds: string[], enabled: boolean) {
  // Ids already accounted for. Seeded on the first load, so opening the screen
  // to a queue of five tickets does not fire five chimes.
  const chimedRef = useRef<Set<string> | null>(null);

  // Joined so the effect depends on the contents, not a fresh array identity.
  const key = newOrderIds.join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];

    if (chimedRef.current === null) {
      chimedRef.current = new Set(ids);
      return;
    }

    const fresh = ids.filter((id) => !chimedRef.current!.has(id));
    // Recorded even when muted, so unmuting does not replay the backlog.
    for (const id of fresh) chimedRef.current.add(id);

    if (fresh.length > 0 && enabled) playChime();
  }, [key, enabled]);
}
