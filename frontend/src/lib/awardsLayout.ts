export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items] : [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
