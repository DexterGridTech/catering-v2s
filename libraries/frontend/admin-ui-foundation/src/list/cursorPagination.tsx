import {Button, Space, Typography} from 'antd';
import type {CSSProperties} from 'react';
import {testId} from '../automation/testId';
import type {CursorStackState} from './useCursorStack';

export type CursorPaginationProps = {
  state: Pick<CursorStackState, 'page' | 'canPrevious' | 'goToPage'>;
  nextCursor?: string;
  testIdPrefix: string;
  style?: CSSProperties;
};

/**
 * Shared Ant Design controls for an opaque-cursor surface.
 *
 * This deliberately exposes sequential navigation only. A cursor cannot be
 * derived from an arbitrary page number, so the component must not grow an
 * arbitrary-jump API merely to resemble a page-table pager.
 */
export function CursorPagination({state, nextCursor, testIdPrefix, style}: CursorPaginationProps) {
  return (
    <Space size={8} style={{display: 'flex', justifyContent: 'flex-end', ...style}} {...testId(testIdPrefix)}>
      <Button
        disabled={!state.canPrevious}
        onClick={() => state.goToPage(state.page - 1)}
        {...testId(`${testIdPrefix}-previous`)}
      >
        上一页
      </Button>
      <Typography.Text type="secondary">第 {state.page} 页</Typography.Text>
      <Button
        disabled={!nextCursor}
        onClick={() => state.goToPage(state.page + 1, nextCursor)}
        {...testId(`${testIdPrefix}-next`)}
      >
        下一页
      </Button>
    </Space>
  );
}
