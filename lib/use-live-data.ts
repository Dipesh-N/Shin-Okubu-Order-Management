"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

const FALLBACK_POLL_MS = 15_000;
const DEBOUNCE_MS = 120;

type State<T> = {
  data: T | null;
  error: string | null;
  /** False when the websocket is down and we are relying on the poll. */
  live: boolean;
};

/**
 * Keeps a screen in sync with the orders tables.
 *
 * Realtime is used purely as a "something changed, look again" signal rather
 * than as a stream of rows to merge. Patching local state from individual
 * payloads is where this kind of screen usually goes wrong — an order_items
 * insert arrives with no parent order, deletes arrive with only an id — and
 * for a handful of tables, refetching is both simpler and always correct.
 *
 * The interval is a deliberate safety net: if the socket quietly dies on the
 * kitchen iPad, the screen must not freeze on a stale order list.
 */
export function useLiveData<T>(load: (supabase: SupabaseClient) => Promise<T>) {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    live: false,
  });

  // Keep the loader in a ref so a new inline function on each render does not
  // tear down and rebuild the subscription.
  const loadRef = useRef(load);
  loadRef.current = load;

  const supabaseRef = useRef<SupabaseClient | null>(null);
  supabaseRef.current ??= createClient();

  const reload = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    try {
      const data = await loadRef.current(supabase);
      setState((s) => ({ ...s, data, error: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: errorMessage(err, "Could not load orders."),
      }));
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const ping = () => {
      if (cancelled) return;
      clearTimeout(debounce);
      // A single "send order" writes an order plus several order_items, which
      // arrive as separate events. Coalesce them into one refetch.
      debounce = setTimeout(reload, DEBOUNCE_MS);
    };

    void reload();

    const channel = supabase
      .channel("okubu-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, ping)
      .subscribe((status) => {
        if (cancelled) return;
        const live = status === "SUBSCRIBED";
        setState((s) => (s.live === live ? s : { ...s, live }));
        if (live) void reload();
      });

    const poll = setInterval(reload, FALLBACK_POLL_MS);

    // Coming back to a backgrounded tablet should show current data at once.
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  return { ...state, reload };
}
