/**
 * Japanese Yen has no minor unit, so prices are plain whole-yen integers.
 * Keeping money as integers means totals can never drift through
 * floating-point rounding.
 */
export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

/** Sums a ticket's live line items. Corrected-away lines are not charged. */
export function orderTotal(
  items: { unit_price: number; qty: number; voided_at?: string | null }[],
): number {
  return items
    .filter((i) => !i.voided_at)
    .reduce((sum, i) => sum + i.unit_price * i.qty, 0);
}
