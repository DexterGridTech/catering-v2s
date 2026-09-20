const CANONICAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Asia/Shanghai',
});

export type CanonicalDateTimeInput = Date | number | string | null | undefined;

/** Formats persisted epoch timestamps in the product's canonical business timezone. */
export function formatCanonicalDateTime(value: CanonicalDateTimeInput): string {
  if (value === null || value === undefined || value === '' || value === 0) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return CANONICAL_DATE_TIME_FORMATTER.format(date);
}
