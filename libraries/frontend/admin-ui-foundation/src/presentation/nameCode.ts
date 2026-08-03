export function formatNameCode(name?: string | null, code?: string | null) {
  const displayName = name?.trim();
  const displayCode = code?.trim();
  if (displayName && displayCode) return `${displayName}(${displayCode})`;
  return displayName || displayCode || '—';
}

/** Converts owner task-path transport segments from `CODE name` to `名称(编码)`. */
export function formatCodeNamePath(value?: string | null) {
  const path = value?.trim();
  if (!path) return '—';
  return path.split(' / ').map((segment) => {
    const display = segment.trim();
    const match = display.match(/^(\S+)\s+(.+)$/);
    return match ? formatNameCode(match[2], match[1]) : display;
  }).join(' / ');
}
