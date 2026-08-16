import {createElement, type ReactNode} from 'react';

export function formatNameCode(name?: string | null, code?: string | null) {
  const displayName = name?.trim();
  const displayCode = code?.trim();
  if (displayName && displayCode) return `${displayName}(${displayCode})`;
  return displayName || displayCode || '—';
}

/** Shared visual rule: keep the business name primary and make its code smaller and quieter. */
export function NameCodeText({
  name,
  code,
  emphasizeName = false,
}: {
  name?: string | null;
  code?: string | null;
  emphasizeName?: boolean;
}) {
  const displayName = name?.trim();
  const displayCode = code?.trim();
  const quietCode = {fontSize: 'var(--ant-font-size-sm)', color: 'var(--ant-color-text-tertiary)'};
  if (!displayName && !displayCode) return '—';
  const nameElement = createElement('span', emphasizeName ? {style: {fontWeight: 600}} : null, displayName);
  if (!displayCode) return emphasizeName ? nameElement : displayName;
  if (!displayName) return createElement('span', {style: quietCode}, displayCode);
  return createElement('span', null, nameElement, createElement('span', {style: quietCode}, `(${displayCode})`));
}

/** Shared visual rule for owner paths whose segments are encoded as `CODE name`. */
export function NameCodePathText({value}: {value?: string | null}): ReactNode {
  const path = value?.trim();
  if (!path) return '—';
  return path.split(' / ').map((segment, index) => {
    const display = segment.trim();
    const match = display.match(/^(\S+)\s+(.+)$/);
    return createElement(
      'span',
      {key: `${display}-${index}`},
      index > 0 ? ' / ' : '',
      match ? createElement(NameCodeText, {name: match[2], code: match[1]}) : display,
    );
  });
}

/** Converts owner task-path transport segments from `CODE name` to `名称(编码)`. */
export function formatCodeNamePath(value?: string | null) {
  const path = value?.trim();
  if (!path) return '—';
  return path
    .split(' / ')
    .map(segment => {
      const display = segment.trim();
      const match = display.match(/^(\S+)\s+(.+)$/);
      return match ? formatNameCode(match[2], match[1]) : display;
    })
    .join(' / ');
}
