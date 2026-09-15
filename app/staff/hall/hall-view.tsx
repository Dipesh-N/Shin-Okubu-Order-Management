"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchHallData } from "@/lib/queries";
import { useLiveData } from "@/lib/use-live-data";
import {
  amendOrderItem,
  cancelOrder,
  placeOrder,
  settleTable,
} from "@/lib/mutations";
import { formatYen } from "@/lib/money";
import type { Order, PaymentMethod, RestaurantTable } from "@/lib/types";
import { LiveBadge } from "@/components/live-badge";
import { Toast } from "@/components/toast";
import { TableGrid } from "./table-grid";
import { OrderBuilder } from "./order-builder";
import { TableDetail } from "./table-detail";
import { errorMessage } from "@/lib/errors";

type Screen =
  | { name: "tables" }
  | { name: "table"; tableId: string }
  | { name: "order"; tableId: string };

export function HallView() {
  // fetchHallData is a module-level function, so its identity is already
  // stable — no useCallback needed.
  const { data, error, live, reload } = useLiveData(fetchHallData);
  const [screen, setScreen] = useState<Screen>({ name: "tables" });
  const [toast, setToast] = useState<string | null>(null);

  const ordersByTable = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of data?.orders ?? []) {
      const list = map.get(o.table_id);
      if (list) list.push(o);
      else map.set(o.table_id, [o]);
    }
    return map;
  }, [data?.orders]);

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

  if (!data) {
    return <p className="p-6 text-center text-slate-400">Loading…</p>;
  }

  const { tables, menu, categories } = data;
  const currentTable: RestaurantTable | undefined =
    screen.name === "tables"
      ? undefined
      : tables.find((t) => t.id === screen.tableId);

  // A table disabled by an admin while the waiter was inside it.
  if (screen.name !== "tables" && !currentTable) {
    setScreen({ name: "tables" });
    return null;
  }

  async function send(
    items: { menu_item_id: string; qty: number }[],
    isTakeout: boolean,
  ) {
    if (!currentTable) return;
    const supabase = createClient();
    try {
      await placeOrder(supabase, currentTable.id, items, isTakeout);
      setScreen({ name: "table", tableId: currentTable.id });
      setToast(
        `${isTakeout ? "Takeout sent" : "Sent to kitchen"} · Table ${currentTable.label}`,
      );
      await reload();
    } catch (err) {
      setToast(errorMessage(err, "Could not send the order."));
    }
  }

  async function cancelTicket(orderId: string) {
    try {
      await cancelOrder(createClient(), orderId);
      setToast("Order cancelled.");
      await reload();
    } catch (err) {
      setToast(errorMessage(err, "Could not cancel."));
    }
  }

  async function amendMany(changes: { itemId: string; qty: number }[]) {
    const supabase = createClient();
    try {
      // Sequential, not parallel: each correction reads the line it is
      // replacing, and the database rejects a second amend of the same line.
      for (const change of changes) {
        await amendOrderItem(supabase, change.itemId, null, change.qty);
      }
      setToast(
        changes.length === 1
          ? "Order changed."
          : `${changes.length} changes saved.`,
      );
      await reload();
    } catch (err) {
      setToast(errorMessage(err, "Could not change the order."));
      // Some corrections may have gone through before the failure.
      await reload();
    }
  }

  async function pay(method: PaymentMethod) {
    if (!currentTable) return;
    try {
      const { total } = await settleTable(createClient(), currentTable.id, method);
      setScreen({ name: "tables" });
      setToast(`Table ${currentTable.label} paid · ${formatYen(total)}`);
      await reload();
    } catch (err) {
      setToast(errorMessage(err, "Could not record payment."));
    }
  }

  return (
    <>
      <LiveBadge live={live} />

      {screen.name === "tables" && (
        <TableGrid
          tables={tables}
          ordersByTable={ordersByTable}
          onPick={(table) => {
            const has = (ordersByTable.get(table.id) ?? []).length > 0;
            // A free table goes straight to the menu: two taps to start ordering.
            setScreen(
              has
                ? { name: "table", tableId: table.id }
                : { name: "order", tableId: table.id },
            );
          }}
        />
      )}

      {screen.name === "order" && currentTable && (
        <OrderBuilder
          table={currentTable}
          menu={menu}
          categories={categories}
          isAddition={(ordersByTable.get(currentTable.id) ?? []).length > 0}
          onCancel={() =>
            setScreen(
              (ordersByTable.get(currentTable.id) ?? []).length > 0
                ? { name: "table", tableId: currentTable.id }
                : { name: "tables" },
            )
          }
          onSend={send}
        />
      )}

      {screen.name === "table" && currentTable && (
        <TableDetail
          table={currentTable}
          orders={ordersByTable.get(currentTable.id) ?? []}
          onBack={() => setScreen({ name: "tables" })}
          onAddItems={() => setScreen({ name: "order", tableId: currentTable.id })}
          onCancelTicket={cancelTicket}
          onAmendMany={amendMany}
          onPay={pay}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
