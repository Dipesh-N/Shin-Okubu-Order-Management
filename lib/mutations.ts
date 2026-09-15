import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus, PaymentMethod } from "@/lib/types";

/** Turns a Postgres error into the plain sentence the function raised. */
function fail(message: string | undefined, fallback: string): never {
  throw new Error(message?.trim() || fallback);
}

/**
 * Sends a ticket to the kitchen.
 * Only ids and quantities travel — the database reads the current price
 * itself, so a stale or tampered tablet cannot set its own prices.
 */
export async function placeOrder(
  supabase: SupabaseClient,
  tableId: string,
  items: { menu_item_id: string; qty: number }[],
  isTakeout = false,
): Promise<string> {
  const { data, error } = await supabase.rpc("place_order", {
    p_table_id: tableId,
    p_items: items,
    p_is_takeout: isTakeout,
  });
  if (error) fail(error.message, "Could not send the order.");
  return data as string;
}

export async function setOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  // .select() makes the affected rows come back. Without it, an update that
  // Row Level Security filters down to zero rows returns success and the
  // button appears dead — which is exactly how the paid-ticket bug hid.
  const { data, error } = await supabase
    .from("orders")
    .update({
      status,
      completed_at: status === "COMPLETED" ? new Date().toISOString() : null,
    })
    .eq("id", orderId)
    .select("id");

  if (error) fail(error.message, "Could not update the order.");

  if (!data || data.length === 0) {
    throw new Error(
      "This order can no longer be changed — it has probably just been paid for. Pull down to refresh.",
    );
  }
}

export async function cancelOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) fail(error.message, "Could not cancel the order.");
}

/** Settles every unpaid ticket on the table. The database computes the total. */
export async function settleTable(
  supabase: SupabaseClient,
  tableId: string,
  method: PaymentMethod,
): Promise<{ payment_id: string; total: number }> {
  const { data, error } = await supabase.rpc("settle_table", {
    p_table_id: tableId,
    p_method: method,
  });
  if (error) fail(error.message, "Could not record the payment.");
  const row = Array.isArray(data) ? data[0] : data;
  return row as { payment_id: string; total: number };
}

/**
 * Corrects one line of a sent ticket.
 *
 * The old line is kept and struck through rather than overwritten, so the
 * kitchen can see that what they were asked for has changed.
 *
 * @param menuItemId null to keep the same dish, or a new dish to swap to
 * @param qty        0 removes the line outright
 */
export async function amendOrderItem(
  supabase: SupabaseClient,
  itemId: string,
  menuItemId: string | null,
  qty: number,
): Promise<void> {
  const { error } = await supabase.rpc("amend_order_item", {
    p_item_id: itemId,
    p_menu_item_id: menuItemId,
    p_qty: qty,
  });
  if (error) fail(error.message, "Could not change the order.");
}
