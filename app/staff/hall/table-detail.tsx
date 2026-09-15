"use client";

import { useState } from "react";
import { BackButton } from "@/components/back-button";
import { TakeoutBadge } from "@/components/takeout-badge";
import { formatYen, orderTotal } from "@/lib/money";
import { STATUS_CLASS, STATUS_LABEL, minutesAgo, tableState } from "@/lib/status";
import type { Order, PaymentMethod, RestaurantTable } from "@/lib/types";

type Props = {
  table: RestaurantTable;
  orders: Order[];
  onBack: () => void;
  onAddItems: () => void;
  onCancelTicket: (orderId: string) => Promise<void>;
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
  onPay,
}: Props) {
  const [paying, setPaying] = useState(false);
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
              <span className="ml-auto text-sm text-slate-400">
                {minutesAgo(order.created_at)}
              </span>
            </div>

            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between py-0.5">
                <span className="text-slate-800">
                  {item.item_name} × {item.qty}
                </span>
                <span className="tabular-nums text-slate-600">
                  {formatYen(item.unit_price * item.qty)}
                </span>
              </div>
            ))}

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-sm font-semibold text-slate-500">
                {formatYen(orderTotal(order.order_items))}
              </span>
              {/* Cancellable while the kitchen has not started — or at any
                  time for a drinks-only round, which they never saw. */}
              {(order.status === "NEW" ||
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
          <span className="font-semibold text-slate-600">Total</span>
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
              disabled={!s.occupied}
              className="h-16 rounded-xl bg-blue-600 text-base font-bold text-white
                         active:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              Take payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
