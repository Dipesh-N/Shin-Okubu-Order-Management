import type { Order } from "@/lib/types";

export type TableState = {
  /** Something is still owed: money, food, or both. */
  occupied: boolean;
  /** Food is cooked and waiting to be carried up or handed over. */
  ready: boolean;
  cooking: boolean;
  waiting: boolean;
  /** What is still to be paid. Already-paid tickets are not counted. */
  total: number;
  /** False once everything on the table has been paid for. */
  hasUnpaid: boolean;
};

/**
 * A table's state is derived from its tickets, never stored, so it can never
 * drift out of step with reality.
 *
 * Paying and cooking are independent: a takeout customer may pay first and
 * wait, or a diner may eat first and pay after. A ticket is finished only
 * when both have happened, and the queries only hand us tickets where at
 * least one is still outstanding.
 */
export function tableState(orders: Order[]): TableState {
  const unpaid = orders.filter((o) => !o.payment_id);

  const total = unpaid.reduce(
    (sum, o) =>
      sum +
      o.order_items
        .filter((i) => !i.voided_at)
        .reduce((s, i) => s + i.unit_price * i.qty, 0),
    0,
  );

  return {
    occupied: orders.length > 0,
    ready: orders.some((o) => o.status === "COMPLETED"),
    cooking: orders.some((o) => o.status === "COOKING"),
    waiting: orders.some((o) => o.status === "NEW"),
    total,
    hasUnpaid: unpaid.length > 0,
  };
}

export const STATUS_LABEL: Record<Order["status"], string> = {
  NEW: "Waiting",
  COOKING: "Cooking",
  COMPLETED: "Ready",
};

/** One place to decide what each status looks like, so every screen agrees. */
export const STATUS_CLASS: Record<Order["status"], string> = {
  NEW: "bg-red-100 text-red-800 ring-red-200",
  COOKING: "bg-orange-100 text-orange-900 ring-orange-200",
  COMPLETED: "bg-green-100 text-green-800 ring-green-200",
};

/** How long ago, in the short form a busy kitchen can read at a glance. */
export function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min";
  return `${mins} min`;
}
