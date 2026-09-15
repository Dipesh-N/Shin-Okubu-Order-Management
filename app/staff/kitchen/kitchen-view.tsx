"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchKitchenData } from "@/lib/queries";
import { useLiveData } from "@/lib/use-live-data";
import { setOrderStatus } from "@/lib/mutations";
import { minutesAgo } from "@/lib/status";
import type { Order } from "@/lib/types";
import { LiveBadge } from "@/components/live-badge";
import { Toast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";

export function KitchenView() {
  const { data, error, live, reload } = useLiveData(fetchKitchenData);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const labelFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of data?.tables ?? []) map.set(t.id, t.label);
    return map;
  }, [data?.tables]);

  async function move(order: Order, status: Order["status"]) {
    setBusyId(order.id);
    try {
      await setOrderStatus(createClient(), order.id, status);
      await reload();
    } catch (err) {
      setToast(errorMessage(err, "Could not update."));
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={reload}
          className="mt-3 h-12 rounded-xl bg-slate-900 px-6 font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return <p className="p-6 text-center text-slate-400">Loading…</p>;

  const { active, recentlyDone } = data;

  return (
    <>
      <LiveBadge live={live} />

      {active.length === 0 && (
        <p className="py-16 text-center text-xl text-slate-400">
          No orders right now.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {active.map((order) => {
          const isNew = order.status === "NEW";
          // Drinks are poured by the waiter, so they never reach this screen.
          const cookItems = order.order_items.filter((i) => i.to_kitchen);
          if (cookItems.length === 0) return null;
          return (
            <article
              key={order.id}
              className={`flex flex-col rounded-2xl bg-white shadow-sm ring-2 ${
                isNew ? "ring-red-500" : "ring-orange-400"
              }`}
            >
              <header
                className={`flex items-baseline gap-2 rounded-t-2xl px-3 py-2 text-white ${
                  isNew ? "bg-red-600" : "bg-orange-500"
                }`}
              >
                <span className="text-lg font-bold">
                  TABLE {labelFor.get(order.table_id) ?? "?"}
                </span>
                <span className="text-xs opacity-80">#{order.ticket_no}</span>
                {order.is_takeout && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-violet-700">
                    Takeout
                  </span>
                )}
                <span className="ml-auto text-xs font-medium opacity-90">
                  {minutesAgo(order.created_at)}
                </span>
              </header>

              <ul className="flex-1 space-y-0.5 px-3 py-2">
                {cookItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="font-medium text-slate-900">
                      {item.item_name}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-slate-900">
                      ×{item.qty}
                    </span>
                  </li>
                ))}
              </ul>

              <footer className="px-3 pb-3">
                {isNew ? (
                  <button
                    onClick={() => move(order, "COOKING")}
                    disabled={busyId === order.id}
                    className="h-12 w-full rounded-xl bg-orange-500 font-bold text-white
                               active:bg-orange-600 disabled:opacity-50"
                  >
                    Start cooking
                  </button>
                ) : (
                  <button
                    onClick={() => move(order, "COMPLETED")}
                    disabled={busyId === order.id}
                    className="h-12 w-full rounded-xl bg-green-600 font-bold text-white
                               active:bg-green-700 disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      {/* Undo for a mis-tapped Complete. Small on purpose — it is not the job. */}
      {recentlyDone.length > 0 && (
        <section className="border-t border-slate-200 px-3 py-3">
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-400">
            Just completed
          </h2>
          <div className="flex flex-wrap gap-2">
            {recentlyDone.map((order) => (
              <button
                key={order.id}
                onClick={() => move(order, "COOKING")}
                disabled={busyId === order.id}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600
                           shadow-sm ring-1 ring-slate-200 active:bg-slate-100 disabled:opacity-50"
              >
                Table {labelFor.get(order.table_id) ?? "?"} · #{order.ticket_no}
                <span className="ml-2 text-slate-400">Undo</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
