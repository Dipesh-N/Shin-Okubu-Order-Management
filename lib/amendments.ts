import type { OrderItem } from "@/lib/types";

export type AmendedLine = {
  /** The line as it stands now. Null when it was removed outright. */
  current: OrderItem | null;
  /** Earlier versions, oldest first, all struck through on screen. */
  superseded: OrderItem[];
};

/**
 * Rebuilds a ticket's lines into "what it says now, and what it used to say".
 *
 * A correction voids the old row and inserts a new one, linked by
 * `replaced_by`. Following those links turns a flat list into one row per
 * dish, carrying its own history — including a chain of several corrections.
 */
export function groupAmendments(items: OrderItem[]): AmendedLine[] {
  const byId = new Map(items.map((i) => [i.id, i]));

  // Which line replaced which.
  const predecessorOf = new Map<string, OrderItem>();
  for (const item of items) {
    if (item.replaced_by) predecessorOf.set(item.replaced_by, item);
  }

  // A line starts a chain unless something else was replaced BY it.
  const isSuccessor = new Set(
    items.map((i) => i.replaced_by).filter((id): id is string => Boolean(id)),
  );

  const lines: AmendedLine[] = [];

  for (const item of items) {
    // Walk only from the end of each chain: a live line, or a voided line
    // that was removed rather than replaced.
    const isChainEnd = !item.replaced_by;
    if (!isChainEnd) continue;

    const superseded: OrderItem[] = [];
    let cursor: OrderItem | undefined = predecessorOf.get(item.id);
    const guard = new Set<string>([item.id]);
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      superseded.unshift(cursor);
      cursor = predecessorOf.get(cursor.id);
    }

    lines.push({
      current: item.voided_at ? null : item,
      superseded: item.voided_at ? [...superseded, item] : superseded,
    });
  }

  // Anything orphaned by unexpected data still gets shown rather than lost.
  const shown = new Set(
    lines.flatMap((l) => [l.current?.id, ...l.superseded.map((s) => s.id)]),
  );
  for (const item of items) {
    if (!shown.has(item.id) && !isSuccessor.has(item.id) && byId.has(item.id)) {
      lines.push({ current: item.voided_at ? null : item, superseded: [] });
    }
  }

  return lines;
}

/** Live lines only — what the kitchen should make and the customer pays for. */
export function liveItems(items: OrderItem[]): OrderItem[] {
  return items.filter((i) => !i.voided_at);
}
