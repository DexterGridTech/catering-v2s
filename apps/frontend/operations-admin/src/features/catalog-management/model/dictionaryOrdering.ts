export type DictionaryOrderingRow = {status: string};

export function canMoveDictionaryRow(rows: readonly DictionaryOrderingRow[], index: number, offset: -1 | 1): boolean {
  const target = index + offset;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return false;
  return true;
}
