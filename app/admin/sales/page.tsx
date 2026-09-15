import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DayPicker } from "./day-picker";
import { requireRole } from "@/lib/auth";
import { formatYen } from "@/lib/money";
import {
  formatDayLabel,
  isValidDay,
  shiftDay,
  todayInTokyo,
  tokyoDayRange,
} from "@/lib/day";

export const metadata = { title: "Sales · Admin" };

type SoldRow = { name: string; qty: number; amount: number };

export default async function AdminSalesPage(props: PageProps<"/admin/sales">) {
  await requireRole("admin");

  const params = await props.searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  const today = todayInTokyo();
  const date = isValidDay(raw) ? raw : today;
  const { start, end } = tokyoDayRange(date);

  const supabase = await createClient();

  // Everything settled during the restaurant's day.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("payments")
    .select("id, total")
    .gte("paid_at", start.toISOString())
    .lt("paid_at", end.toISOString());

  if (paymentsError) {
    return <p className="p-4 text-red-700">Could not load sales: {paymentsError.message}</p>;
  }

  const payments = paymentRows ?? [];
  const totalSales = payments.reduce((sum, p) => sum + p.total, 0);

  // What was actually served, counted from the tickets those payments covered.
  // Basing it on paid tickets means the quantities always reconcile with the
  // total above.
  let sold: SoldRow[] = [];

  if (payments.length > 0) {
    const { data: orderRows, error: ordersError } = await supabase
      .from("orders")
      .select("payment_id, order_items(item_name, unit_price, qty)")
      .in(
        "payment_id",
        payments.map((p) => p.id),
      );

    if (ordersError) {
      return <p className="p-4 text-red-700">Could not load items: {ordersError.message}</p>;
    }

    const tally = new Map<string, SoldRow>();
    for (const order of orderRows ?? []) {
      for (const item of order.order_items ?? []) {
        const row = tally.get(item.item_name) ?? {
          name: item.item_name,
          qty: 0,
          amount: 0,
        };
        row.qty += item.qty;
        row.amount += item.unit_price * item.qty;
        tally.set(item.item_name, row);
      }
    }

    // Best sellers first — the thing an owner scans for.
    sold = [...tally.values()].sort(
      (a, b) => b.qty - a.qty || a.name.localeCompare(b.name),
    );
  }

  const totalItems = sold.reduce((sum, r) => sum + r.qty, 0);

  return (
    <div className="space-y-4">
      {/* Day picker */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/sales?date=${shiftDay(date, -1)}`}
          aria-label="Previous day"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-bold
                     shadow-sm ring-1 ring-slate-200 active:bg-slate-100"
        >
          ‹
        </Link>

        <DayPicker date={date} max={today} />

        {date < today ? (
          <Link
            href={`/admin/sales?date=${shiftDay(date, 1)}`}
            aria-label="Next day"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-bold
                       shadow-sm ring-1 ring-slate-200 active:bg-slate-100"
          >
            ›
          </Link>
        ) : (
          <span className="flex h-12 w-12 items-center justify-center text-xl font-bold text-slate-300">
            ›
          </span>
        )}

        {date !== today && (
          <Link
            href="/admin/sales"
            className="h-12 rounded-xl bg-slate-200 px-4 text-sm font-semibold leading-[3rem] text-slate-800 active:bg-slate-300"
          >
            Today
          </Link>
        )}
      </div>

      {/* The number the owner came for */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-500">
          {date === today ? "Today" : formatDayLabel(date)}
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
          {formatYen(totalSales)}
        </p>
      </div>

      {/* What sold */}
      <section>
        <h2 className="flex items-baseline justify-between px-1 pb-2">
          <span className="text-sm font-bold uppercase tracking-wide text-slate-400">
            Items sold
          </span>
          {totalItems > 0 && (
            <span className="text-sm text-slate-500">{totalItems} in total</span>
          )}
        </h2>

        {sold.length === 0 ? (
          <p className="rounded-2xl bg-white py-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
            Nothing sold {date === today ? "yet today" : "on this day"}.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {sold.map((row, i) => (
              <div
                key={row.name}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <span className="flex-1 font-medium text-slate-900">
                  {row.name}
                </span>
                <span className="w-16 text-right text-xl font-bold tabular-nums text-slate-900">
                  {row.qty}
                </span>
                <span className="w-24 text-right tabular-nums text-slate-500">
                  {formatYen(row.amount)}
                </span>
              </div>
            ))}

            <div className="flex items-center gap-3 border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
              <span className="flex-1 font-bold text-slate-900">Total</span>
              <span className="w-16 text-right text-xl font-bold tabular-nums text-slate-900">
                {totalItems}
              </span>
              <span className="w-24 text-right font-bold tabular-nums text-slate-900">
                {formatYen(totalSales)}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
