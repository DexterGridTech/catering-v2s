import {Tooltip} from 'antd';
import type {ReactElement, ReactNode} from 'react';

/**
 * Use at an authored text truncation boundary. Callers retain ownership of the
 * displayed text and pass the complete, human-readable form as `title`.
 */
export function EllipsisTooltip({title, children}: {title: ReactNode; children: ReactElement}) {
  return <Tooltip title={title}>{children}</Tooltip>;
}
