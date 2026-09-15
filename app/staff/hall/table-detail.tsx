"use client";

import { useState } from "react";
import { BackButton } from "@/components/back-button";
import { TakeoutBadge } from "@/components/takeout-badge";
import { formatYen, orderTotal } from "@/lib/money";
import { STATUS_CLASS, STATUS_LABEL, minutesAgo, tableState } from "@/lib/status";
import type { Order, PaymentMethod, RestaurantTable } from "@/lib/types";
import { groupAmendments, liveItems } from "@/lib/amendments";
import { TicketEditor } from "./ticket-editor";

type Props = {
  table: RestaurantTable;
  orders: Order[];
  onBack: () => void;
  onAddItems: () => void;
  onCancelTicket: (orderId: string) => Promise<void>;
  /** Applies every quantity correction from one Save in a single pass. */
  onAmendMany: (changes: { itemId: string; qty: number }[]) => Promise<void>;
  onPay: (method: PaymentMethod) => Promise<void>;
};

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "other", label: "Other" },
];

export function TableDetail({
  table,
  orders,
  onBack,
  onAddItems,
  onCancelTicket,
  onAmendMany,
  onPay,
}: Props) {
  const [paying, setPaying] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = tableState(orders);

  async function pay(method: PaymentMethod) {
    if (busy) return;
    setBusy(true);
    try {
      await onPay(method);
    } finally {
      setBusy(false);
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-3 py-2.5">
        <BackButton onClick={onBack} label="Tables" />
        <span className="text-lg font-bold">Table {table.label}</span>
        {s.ready && (
          <span className="rounded-full bg-green-600 px-3 py-1 text-sm font-bold text-white">
            Food ready
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-400">
                #{order.ticket_no}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${STATUS_CLASS[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
              {order.is_takeout && <TakeoutBadge />}
              {order.payment_id && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800">
                  Paid
                </span>
              )}
              <span className="ml-auto text-sm text-slate-400">
                {minutesAgo(order.created_at)}
              </span>

              {/* One Edit for the whole ticket rather than one per line. */}
              {!order.payment_id && editingOrderId !== order.id && (
                <button
                  onClick={() => setEditingOrderId(order.id)}
                  className="h-10 rounded-lg px-3 text-sm font-semibold text-slate-500
                             ring-1 ring-slate-200 active:bg-slate-100"
                >
                  Edit
                </button>
              )}
            </div>

            {editingOrderId === order.id ? (
              <TicketEditor
                items={liveItems(order.order_items)}
                onCancel={() => setEditingOrderId(null)}
                onSave={async (changes) => {
                  await onAmendMany(changes);
                  setEditingOrderId(null);
                }}
              />
            ) : (
              <>
              {groupAmendments(order.order_items).map((line) => {
                const key = line.current?.id ?? line.superseded.at(-1)!.id;

                return (
                  <div key={key} className="border-t border-slate-100 py-1 first:border-t-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {/* Every earlier version, struck through and kept. */}
                      {line.superseded.map((old) => (
                        <span
                          key={old.id}
                          className="text-slate-400 line-through decoration-red-400 decoration-2"
                        >
                          {old.item_name} × {old.qty}
                        </span>
                      ))}

                      {line.superseded.length > 0 && (
                        <span aria-hidden className="font-bold text-slate-400">
                          →
                        </span>
                      )}

                      {line.current ? (
                        <span className="font-medium text-slate-900">
                          {line.current.item_name} × {line.current.qty}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold uppercase tracking-wide text-red-600">
                          Removed
                        </span>
                      )}

                      <span className="ml-auto flex items-center gap-2">
                        <span className="tabular-nums text-slate-600">
                          {line.current
                            ? formatYen(line.current.unit_price * line.current.qty)
                            : formatYen(0)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
              </>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-sm font-semibold text-slate-500">
                {formatYen(orderTotal(order.order_items))}
              </span>
              {/* Cancellable while the kitchen has not started — or at any
                  time for a drinks-only round, which they never saw. */}
              {!order.payment_id &&
                (order.status === "NEW" ||
                  order.order_items.every((i) => !i.to_kitchen)) && (
                <button
                  onClick={() => onCancelTicket(order.id)}
                  className="h-11 rounded-xl px-4 text-sm font-semibold text-red-600 ring-1 ring-red-200 active:bg-red-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <p className="py-10 text-center text-slate-500">
            This table is free.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between px-1">
          <span className="font-semibold text-slate-600">
            {s.hasUnpaid ? "To pay" : "All paid"}
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {formatYen(s.total)}
          </span>
        </div>

        {paying ? (
          <div className="space-y-2">
            <p className="px-1 text-sm text-slate-500">
              Take {formatYen(s.total)} by:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => pay(m.key)}
                  disabled={busy}
                  className="h-16 rounded-xl bg-slate-900 text-base font-bold text-white
                             active:bg-slate-700 disabled:opacity-50"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPaying(false)}
              className="h-12 w-full rounded-xl text-sm font-medium text-slate-500 active:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onAddItems}
              className="h-16 rounded-xl bg-slate-900 text-base font-bold text-white active:bg-slate-700"
            >
              Add items
            </button>
            <button
              onClick={() => setPaying(true)}
              disabled={!s.hasUnpaid}
              className="h-16 rounded-xl bg-blue-600 text-base font-bold text-white
                         active:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {s.hasUnpaid ? "Take payment" : "Paid"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
