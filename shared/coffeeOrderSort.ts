/**
 * Sort order by product, then by size — matches how production batches and
 * preps: everything for one product grouped together, ascending by size
 * within that group.
 *
 * Shared between client (coffee-order.tsx's CSV/PDF exports) and server
 * (resend.ts's vendor order email) so both apply the exact same order —
 * one implementation, not two kept in sync by hand.
 */

/**
 * Parses a free-text size like "12oz", "2 lb", "5lbs" into ounces, so sizes
 * across units compare by actual weight rather than by their leading digit
 * — plain numeric-string collation would put "2lb" before "12oz" (2 < 12),
 * when 12oz is in fact the smaller bag. Returns null for anything that
 * isn't a recognized oz/lb weight (e.g. "Whole Bean", "unit"), so the
 * caller can fall back to a plain string comparison rather than guessing.
 */
function parseSizeOunces(size: string): number | null {
  const match = size.trim().match(/^([\d.]+)\s*(oz|ounces?|lbs?|pounds?)$/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const isPounds = /^(lbs?|pounds?)$/i.test(match[2]);
  return isPounds ? value * 16 : value;
}

export function compareProductByNameThenSize<T extends { name: string; size: string }>(a: T, b: T): number {
  const nameCmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  if (nameCmp !== 0) return nameCmp;

  const ouncesA = parseSizeOunces(a.size);
  const ouncesB = parseSizeOunces(b.size);
  if (ouncesA !== null && ouncesB !== null) {
    return ouncesA - ouncesB;
  }
  // Neither, or only one, parsed as a weight — numeric-string collation is
  // the best a free-text field with no controlled vocabulary can offer
  // (still keeps "Size 9" before "Size 12", unlike a plain string sort).
  return a.size.localeCompare(b.size, undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Sorts an order's items (productId -> qty) into [productId, qty] pairs by
 * product name then size. A product id with no catalog match (deleted
 * since the order was placed) sorts after every named item, grouped
 * together as "Unknown".
 */
export function sortOrderItemEntries(
  items: Record<string, number>,
  catalog: Array<{ id: string; name: string; size: string }>
): Array<[string, number]> {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  return Object.entries(items).sort(([idA], [idB]) => {
    const a = byId.get(idA);
    const b = byId.get(idB);
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return compareProductByNameThenSize(a, b);
  });
}
