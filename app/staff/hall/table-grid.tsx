"use client";

import { formatYen } from "@/lib/money";
import { tableState } from "@/lib/status";
import type { Order, RestaurantTable } from "@/lib/types";

type Props = {
  tables: RestaurantTable[];
  ordersByTable: Map<string, Order[]>;
  onPick: (table: RestaurantTable) => void;
};

export function TableGrid({ tables, ordersByTable, onPick }: Props) {
  if (tables.length === 0) {
    return (
      <p className="p-6 text-center text-slate-500">
        No tables yet. An admin can add them under Admin → Tables.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
      {tables.map((table) => {
        const orders = ordersByTable.get(table.id) ?? [];
        const s = tableState(orders);

        // Ready-to-serve outranks everything: that is the thing the waiter
        // must act on right now.
        const tone = s.ready
          ? "bg-green-600 text-white ring-green-700"
          : s.cooking
            ? "bg-orange-500 text-white ring-orange-600"
            : s.waiting
              ? "bg-red-600 text-white ring-red-700"
              : "bg-white text-slate-900 ring-slate-200";

        const caption = s.ready
          ? "Food ready"
          : s.cooking
            ? "Cooking"
            : s.waiting
              ? "Sent to kitchen"
              : "Free";

        return (
          <button
            key={table.id}
            onClick={() => onPick(table)}
            className={`flex h-36 flex-col items-center justify-center gap-1 rounded-2xl
                        shadow-sm ring-1 active:brightness-95 ${tone}`}
          >
            <span className="text-4xl font-bold leading-none">{table.label}</span>
            <span className="text-sm font-medium">{caption}</span>
            {s.occupied &&
              (s.hasUnpaid ? (
                <span className="text-sm opacity-90">{formatYen(s.total)}</span>
              ) : (
                // Paid up front and still cooking — nothing left to collect.
                <span className="text-sm font-semibold opacity-90">Paid</span>
              ))}
          </button>
        );
      })}
    </div>
  );
}
