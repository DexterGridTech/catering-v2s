import {Empty} from 'antd';
import {testId} from '../automation/testId';

type AdminListStateOptions = {
  loading: boolean;
  failed: boolean;
  emptyText: string;
  testIdPrefix: string;
};

/** Keeps loading, failed, and empty table states mutually exclusive. */
export function adminListState({loading, failed, emptyText, testIdPrefix}: AdminListStateOptions) {
  return {
    loading: loading ? {spinning: true, description: <span {...testId(`${testIdPrefix}-loading`)}>正在加载</span>} : false,
    locale: {emptyText: loading || failed ? null : <Empty description={<span {...testId(`${testIdPrefix}-empty`)}>{emptyText}</span>}/>},
  };
}
