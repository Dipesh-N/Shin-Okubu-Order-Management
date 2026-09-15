import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuCategory, MenuItem, Order, RestaurantTable } from "@/lib/types";

/** Table labels are text ("5", "A1"), but should sort like numbers when they are. */
export function compareLabels(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

const ORDER_COLUMNS =
  "id, ticket_no, table_id, status, created_by, created_at, completed_at, payment_id, is_takeout, order_items(id, order_id, menu_item_id, item_name, unit_price, qty, to_kitchen, voided_at, replaced_by)";

/** Everything Hall View needs: active tables, their unpaid tickets, the menu. */
export async function fetchHallData(supabase: SupabaseClient) {
  const [tablesRes, ordersRes, menuRes, categoriesRes] = await Promise.all([
    supabase
      .from("tables")
      .select("id, label, is_active, created_at")
      .eq("is_active", true),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      // Open business is money owed OR food owed. A takeout customer who pays
      // up front still has a ticket here until the kitchen finishes it.
      .or("payment_id.is.null,status.neq.COMPLETED")
      .order("created_at", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, name, price, category, is_available, sort_order, created_at")
      .eq("is_available", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("menu_categories")
      .select("name, sort_order, needs_kitchen, created_at")
      .order("sort_order"),
  ]);

  const error =
    tablesRes.error ?? ordersRes.error ?? menuRes.error ?? categoriesRes.error;
  if (error) throw error;

  const tables = (tablesRes.data ?? []) as RestaurantTable[];
  const orders = (ordersRes.data ?? []) as Order[];
  const menu = (menuRes.data ?? []) as MenuItem[];
  const allCategories = (categoriesRes.data ?? []) as MenuCategory[];

  // Only tabs that actually have something orderable behind them — an empty
  // tab is a dead end for the waiter.
  const stocked = new Set(menu.map((m) => m.category));
  const categories = allCategories
    .filter((c) => stocked.has(c.name))
    .map((c) => c.name);

  tables.sort((a, b) => compareLabels(a.label, b.label));
  return { tables, orders, menu, categories };
}

/**
 * Kitchen queue: everything not finished, plus anything completed in the last
 * 30 minutes so a mis-tapped "Complete" can be undone.
 */
export async function fetchKitchenData(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 30 * 60_000).toISOString();

  const [activeRes, doneRes, tablesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      // Deliberately no payment filter: food that has been paid for still has
      // to be cooked, which is the whole point of takeout.
      .neq("status", "COMPLETED")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("status", "COMPLETED")
      .gte("completed_at", since)
      .order("completed_at", { ascending: false })
      .limit(8),
    supabase.from("tables").select("id, label, is_active, created_at"),
  ]);

  const error = activeRes.error ?? doneRes.error ?? tablesRes.error;
  if (error) throw error;

  return {
    active: (activeRes.data ?? []) as Order[],
    recentlyDone: (doneRes.data ?? []) as Order[],
    tables: (tablesRes.data ?? []) as RestaurantTable[],
  };
}
