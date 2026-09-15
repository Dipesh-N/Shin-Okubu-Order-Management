"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Supabase client for the browser. Used by Hall and Kitchen views for live
 * order data and the Realtime subscription.
 *
 * `createBrowserClient` is a singleton by default, so calling this repeatedly
 * reuses one client and one websocket.
 */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
