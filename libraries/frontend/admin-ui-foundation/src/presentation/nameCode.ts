import {createElement, type ReactNode} from 'react';

/**
 * A structured organization path segment supplied by an owning read model.
 * The generic node type keeps the foundation independent from either app's
 * generated OpenAPI module while preserving its closed union at each app
 * boundary.
 */
export type OrganizationPathNode<NodeType extends string = string> = {
  ref: string;
  code: string;
  name: string;
  nodeType: NodeType;
};

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

function renderStructuredPath(nodes: readonly OrganizationPathNode[]): ReactNode {
  if (nodes.length === 0) return '—';
  return nodes.map((node, index) => {
    const name = node.name?.trim();
    const code = node.code?.trim();
    return createElement(
      'span',
      {key: `${node.ref}-${index}`},
      index > 0 ? ' / ' : '',
      // A missing owner name is an empty fact, not permission to promote the
      // code into the business name position.
      name ? createElement(NameCodeText, {name, code}) : '—',
    );
  });
}

function renderLegacyPath(value?: string | null): ReactNode {
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

/**
 * Shared visual rule for owner paths. New consumers must provide the
 * structured node array; `value` remains only for the short-lived contract
 * window and is intentionally not used when `nodes` is present.
 */
export function NameCodePathText({
  nodes,
  value,
}: {
  nodes?: readonly OrganizationPathNode[] | null;
  /** @deprecated Switch the caller to the owner's structured `nodes` fact. */
  value?: string | null;
}): ReactNode {
  if (nodes !== undefined) return nodes ? renderStructuredPath(nodes) : '—';
  return renderLegacyPath(value);
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
