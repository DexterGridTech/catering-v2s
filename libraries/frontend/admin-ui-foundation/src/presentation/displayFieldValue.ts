/** Field-level empty values use one neutral representation. Page/list empty states keep their own business copy. */
export function displayFieldValue(value: unknown): string {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return '—';
  return String(value);
}
