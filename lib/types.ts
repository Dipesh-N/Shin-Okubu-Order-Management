export type Role = "admin" | "staff";

/** Kitchen ticket lifecycle. Deliberately only three states. */
export type OrderStatus = "NEW" | "COOKING" | "COMPLETED";

export type PaymentMethod = "cash" | "card" | "other";

export type MenuCategory = {
  name: string;
  sort_order: number;
  /** False for things the waiter serves directly, like drinks. */
  needs_kitchen: boolean;
  created_at: string;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
  sort_order: number;
  created_at: string;
};

export type RestaurantTable = {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  unit_price: number;
  qty: number;
  /** Snapshotted when the order is taken, so later changes never rewrite it. */
  to_kitchen: boolean;
};

/** One "send to kitchen" = one ticket. */
export type Order = {
  id: string;
  ticket_no: number;
  table_id: string;
  status: OrderStatus;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  payment_id: string | null;
  /** Packed to go rather than plated. Set per ticket, not per item. */
  is_takeout: boolean;
  order_items: OrderItem[];
};

/** A table plus its unpaid tickets, as shown in Hall View. */
export type TableWithOrders = RestaurantTable & {
  orders: Order[];
};
