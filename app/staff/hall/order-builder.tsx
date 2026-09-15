"use client";

import { useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/back-button";
import { formatYen } from "@/lib/money";
import type { MenuItem, RestaurantTable } from "@/lib/types";

type Props = {
  table: RestaurantTable;
  menu: MenuItem[];
  /** Tab order, as arranged by the admin. */
  categories: string[];
  /** True when the table already has tickets, so wording says "add". */
  isAddition: boolean;
  onCancel: () => void;
  onSend: (
    items: { menu_item_id: string; qty: number }[],
    isTakeout: boolean,
  ) => Promise<void>;
};

export function OrderBuilder({
  table,
  menu,
  categories,
  isAddition,
  onCancel,
  onSend,
}: Props) {
  // Order comes from the admin's category list, not from the item rows.
  const [category, setCategory] = useState<string>(categories[0] ?? "");
  // If the menu was empty when this opened (or the chosen tab disappeared),
  // fall back to the first real category rather than showing nothing.
  const activeCategory =
    categories.includes(category) ? category : (categories[0] ?? "");
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  // A long category row scrolls, and the selected tab was ending up clipped
  // at the edge. "nearest" only scrolls when it is not already fully visible.
  const activeSideRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Seven categories can outrun a short phone screen, so keep the selected
    // one in view. "nearest" does nothing when it is already visible.
    activeSideRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeCategory]);
  const [sending, setSending] = useState(false);
  const [isTakeout, setIsTakeout] = useState(false);

  const visible = menu.filter((m) => m.category === activeCategory);

  const lines = [...cart.entries()].map(([id, qty]) => {
    const item = menu.find((m) => m.id === id)!;
    return { item, qty };
  });
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function remove(id: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function bump(id: string, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const qty = (next.get(id) ?? 0) + delta;
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
  }

  async function send() {
    if (count === 0 || sending) return;
    setSending(true);
    try {
      await onSend(
        lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty })),
        isTakeout,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-3 py-2.5">
        <BackButton onClick={onCancel} label="Back" />
        <span className="font-semibold">
          Table {table.label} · {isAddition ? "Add items" : "New order"}
        </span>

        {/* Lives in this row rather than with the category tabs: that row
            scrolls sideways, and this must stay reachable. */}
        <button
          onClick={() => setIsTakeout((v) => !v)}
          aria-pressed={isTakeout}
          className={`ml-auto flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 font-bold
                      transition-colors ${
                        isTakeout
                          ? "bg-violet-600 text-white shadow-md"
                          : "bg-white text-slate-600 ring-1 ring-slate-300 active:bg-slate-100"
                      }`}
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-md text-sm ${
              isTakeout
                ? "bg-white text-violet-700"
                : "bg-slate-100 ring-1 ring-slate-300"
            }`}
          >
            {isTakeout ? "✓" : ""}
          </span>
          Takeout
        </button>
      </div>

      {menu.length === 0 && (
        <p className="p-8 text-center text-slate-500">
          There is nothing on the menu yet. An admin can add items under
          Admin → Menu.
        </p>
      )}

      {/* Categories down the left on a tablet: seven of them all visible at
          once, instead of a strip that has to be scrolled sideways. Too
          narrow for that on a phone, so there they stay a scrolling row.

          min-h-0 on the flex children is what lets the two columns scroll
          independently rather than pushing the cart off the screen. */}
      <div className="flex min-h-0 flex-1">
        <nav
          className={`w-32 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200
                      bg-white p-2 sm:w-44 lg:w-52 ${
                        categories.length === 0 ? "hidden" : ""
                      }`}
        >
          {categories.map((c) => {
            const selected = c === activeCategory;
            return (
              <button
                key={c}
                ref={selected ? activeSideRef : undefined}
                onClick={() => setCategory(c)}
                aria-pressed={selected}
                className={`flex min-h-12 w-full items-center rounded-xl px-3 py-2 text-left
                            text-sm font-bold transition-colors sm:px-4 sm:text-base ${
                              selected
                                ? "bg-slate-900 text-white shadow-md"
                                : "bg-white text-slate-600 ring-1 ring-slate-300 active:bg-slate-100"
                            }`}
              >
                {c}
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Menu: one tap adds one, tap again for two. */}
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => {
              const qty = cart.get(item.id) ?? 0;
              return (
                <div
                  key={item.id}
                  // In the order: tinted green and ringed, so it stands out from
                  // a grid of white cards rather than relying on a thin outline.
                  className={`relative flex flex-col rounded-2xl p-3 text-left shadow-sm ${
                    qty > 0
                      ? "bg-green-50 ring-2 ring-green-600"
                      : "bg-white ring-1 ring-slate-200"
                  }`}
                >
                  <button
                    onClick={() => bump(item.id, 1)}
                    className="flex flex-1 flex-col items-start gap-1 text-left"
                  >
                    <span className="font-semibold leading-tight text-slate-900">
                      {item.name}
                    </span>
                    <span className="text-sm text-slate-500">
                      {formatYen(item.price)}
                    </span>
                  </button>

                  {qty > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        onClick={() => bump(item.id, -1)}
                        aria-label={`One less ${item.name}`}
                        className="h-10 w-10 rounded-lg bg-slate-100 text-xl font-bold active:bg-slate-200"
                      >
                        −
                      </button>
                      <span className="text-lg font-bold tabular-nums text-green-800">
                        {qty}
                      </span>
                      <button
                        onClick={() => bump(item.id, 1)}
                        aria-label={`One more ${item.name}`}
                        className="h-10 w-10 rounded-lg bg-slate-900 text-xl font-bold text-white active:bg-slate-700"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky cart bar — also where mistakes get fixed, so quantity and
          removal live here rather than only up in the menu grid. */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3">
        {count > 0 && (
          <>
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                This order
              </span>
              <button
                onClick={() => setCart(new Map())}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 active:bg-red-50"
              >
                Clear all
              </button>
            </div>

            <div className="mb-2 max-h-44 divide-y divide-slate-100 overflow-y-auto sm:max-h-64">
              {lines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {l.item.name}
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => bump(l.item.id, -1)}
                      aria-label={`One less ${l.item.name}`}
                      className="h-10 w-10 rounded-lg bg-slate-100 text-lg font-bold
                                 text-slate-700 active:bg-slate-200"
                    >
                      &minus;
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => bump(l.item.id, 1)}
                      aria-label={`One more ${l.item.name}`}
                      className="h-10 w-10 rounded-lg bg-slate-900 text-lg font-bold
                                 text-white active:bg-slate-700"
                    >
                      +
                    </button>
                  </div>

                  {/* Line total is reassurance, not a control — first to go
                      when the screen is narrow. */}
                  <span className="hidden w-16 shrink-0 text-right text-sm tabular-nums text-slate-500 sm:block">
                    {formatYen(l.item.price * l.qty)}
                  </span>

                  <button
                    onClick={() => remove(l.item.id)}
                    aria-label={`Remove ${l.item.name}`}
                    title={`Remove ${l.item.name}`}
                    className="h-10 w-10 shrink-0 rounded-lg text-xl font-bold
                               text-red-600 active:bg-red-50"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <button
          onClick={send}
          disabled={count === 0 || sending}
          className={`h-16 w-full rounded-xl text-lg font-bold text-white
                      disabled:bg-slate-200 disabled:text-slate-400 ${
                        isTakeout
                          ? "bg-violet-600 active:bg-violet-700"
                          : "bg-green-600 active:bg-green-700"
                      }`}
        >
          {sending
            ? "Sending…"
            : count === 0
              ? "Select food"
              : `${isTakeout ? "Send TAKEOUT" : "Send to kitchen"} · ${count} item${count > 1 ? "s" : ""} · ${formatYen(total)}`}
        </button>
      </div>
    </div>
  );
}
