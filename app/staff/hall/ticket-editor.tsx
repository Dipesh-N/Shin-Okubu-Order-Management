"use client";

import { useState } from "react";
import { formatYen } from "@/lib/money";
import type { OrderItem } from "@/lib/types";

type Props = {
  items: OrderItem[];
  onSave: (changes: { itemId: string; qty: number }[]) => Promise<void>;
  onCancel: () => void;
};

/**
 * Edits a whole ticket at once, in the same shape as the order builder's cart
 * so there is only one layout to learn.
 *
 * Quantities are held locally and written on Save. Amending on every tap of
 * "+" would record a correction per press — 4 -> 5 -> 6 -> 7 — and bury the
 * real change in noise. One save, one correction per line that actually moved.
 */
export function TicketEditor({ items, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Map<string, number>>(
    () => new Map(items.map((i) => [i.id, i.qty])),
  );
  const [busy, setBusy] = useState(false);

  const qtyOf = (item: OrderItem) => draft.get(item.id) ?? item.qty;
  const changes = items
    .filter((i) => qtyOf(i) !== i.qty)
    .map((i) => ({ itemId: i.id, qty: qtyOf(i) }));

  function setQty(id: string, qty: number) {
    setDraft((prev) => new Map(prev).set(id, Math.max(0, qty)));
  }

  async function save() {
    if (busy || changes.length === 0) return;
    setBusy(true);
    try {
      await onSave(changes);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const qty = qtyOf(item);
          const removed = qty === 0;

          return (
            <div key={item.id} className="flex items-center gap-2 py-1.5">
              <span
                className={`min-w-0 flex-1 truncate font-medium ${
                  removed
                    ? "text-slate-400 line-through decoration-red-400 decoration-2"
                    : "text-slate-900"
                }`}
              >
                {item.item_name}
              </span>

              {removed ? (
                // Nothing is written until Save, so this is still undoable.
                <button
                  onClick={() => setQty(item.id, item.qty)}
                  className="h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 active:bg-slate-100"
                >
                  Undo
                </button>
              ) : (
                <>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setQty(item.id, qty - 1)}
                      aria-label={`One less ${item.item_name}`}
                      className="h-10 w-10 rounded-lg bg-slate-100 text-lg font-bold text-slate-700 active:bg-slate-200"
                    >
                      &minus;
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums">
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty(item.id, qty + 1)}
                      aria-label={`One more ${item.item_name}`}
                      className="h-10 w-10 rounded-lg bg-slate-900 text-lg font-bold text-white active:bg-slate-700"
                    >
                      +
                    </button>
                  </div>

                  <span className="hidden w-16 shrink-0 text-right text-sm tabular-nums text-slate-500 sm:block">
                    {formatYen(item.unit_price * qty)}
                  </span>

                  <button
                    onClick={() => setQty(item.id, 0)}
                    aria-label={`Remove ${item.item_name}`}
                    className="h-10 w-10 shrink-0 rounded-lg text-xl font-bold text-red-600 active:bg-red-50"
                  >
                    &times;
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t border-slate-200 pt-2">
        <button
          onClick={save}
          disabled={busy || changes.length === 0}
          className="h-12 flex-1 rounded-xl bg-slate-900 font-bold text-white
                     active:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy
            ? "Saving…"
            : changes.length === 0
              ? "No changes"
              : `Save ${changes.length} change${changes.length > 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="h-12 rounded-xl px-5 font-semibold text-slate-600 active:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
