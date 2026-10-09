import {Alert, Button, Result, Select, Space, Typography} from 'antd';
import {
  NameCodeText,
  testId,
  useAsyncGenerationGuard,
  useCursorCandidates,
  useOverlayLock,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {Fragment, createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {
  platformClient,
  platformProblemOf,
  platformRefreshSignal,
  type PlatformApiProblem,
} from '../api/PlatformTransport';
import type {GroupWorkspacePage} from '../api/generated/platform-edge';
import {platformWorkspaceTestIds} from '../automation/platformWorkspaceTestIds';

type WorkspaceScopeValue = {
  result?: GroupWorkspacePage;
  loading: boolean;
  selectedGroupWorkspaceKey?: string;
  setSelectedGroupWorkspaceKey: (value: string | undefined) => void;
  setSearch: (value: string) => void;
  onPopupScroll: (
    event: Parameters<ReturnType<typeof useCursorCandidates<GroupWorkspacePage['items'][number]>>['onPopupScroll']>[0],
  ) => void;
  problem?: PlatformApiProblem;
  refresh: () => void;
};

const WorkspaceScopeContext = createContext<WorkspaceScopeValue | undefined>(undefined);

/** One app-owned, explicitly chosen workspace context; it is never an authorization decision. */
export function WorkspaceScopeProvider({children}: {children: ReactNode}) {
  const [latestPage, setLatestPage] = useState<GroupWorkspacePage>();
  const [selectedGroupWorkspaceKey, setSelectedGroupWorkspaceKey] = useState<string>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useAsyncGenerationGuard();
  const refreshVersion = useRefreshVersion(platformRefreshSignal);
  const candidates = useCursorCandidates<GroupWorkspacePage['items'][number]>({
    queryText: search,
    resetKey: `${refreshVersion}|${retry}`,
    pageSize: 100,
    keyOf: item => item.groupWorkspaceKey,
  });
  const {acceptPage} = candidates;
  const confirmedRefreshVersion = useRef(refreshVersion);
  const selectedGroupWorkspaceKeyRef = useRef(selectedGroupWorkspaceKey);
  selectedGroupWorkspaceKeyRef.current = selectedGroupWorkspaceKey;

  // A successful platform mutation is the authoritative point to re-check the
  // last confirmed selection against the complete enabled owner result, not a
  // transient user-search subset.
  useEffect(() => {
    setSearch('');
  }, [refreshVersion]);

  useEffect(() => {
    const shouldReconcileSelection = confirmedRefreshVersion.current !== refreshVersion;
    confirmedRefreshVersion.current = refreshVersion;
    const request = generation.begin();
    setLoading(true);
    setProblem(undefined);
    void platformClient
      .listPlatformGroupWorkspaces(
        {},
        {
          query: {
            name: shouldReconcileSelection ? undefined : candidates.debouncedQueryText,
            status: 'ENABLED',
            page: candidates.page,
            pageSize: candidates.pageSize,
          },
        },
      )
      .then(value => {
        if (!generation.isCurrent(request)) return;
        acceptPage(value.items, {pageSize: value.pageSize, total: value.total});
        setLatestPage(value);
        if (
          shouldReconcileSelection &&
          selectedGroupWorkspaceKeyRef.current &&
          !value.items.some(item => item.groupWorkspaceKey === selectedGroupWorkspaceKeyRef.current)
        )
          setSelectedGroupWorkspaceKey(undefined);
      })
      .catch(error => {
        if (generation.isCurrent(request)) setProblem(platformProblemOf(error));
      })
      .finally(() => {
        if (generation.isCurrent(request)) setLoading(false);
      });
  }, [
    acceptPage,
    candidates.debouncedQueryText,
    candidates.page,
    candidates.pageSize,
    generation,
    refreshVersion,
    retry,
  ]);

  const result = latestPage
    ? {
        ...latestPage,
        items: candidates.items,
        page: candidates.page,
        pageSize: candidates.pageSize,
        total: candidates.total,
      }
    : undefined;
  const onPopupScroll = (event: Parameters<typeof candidates.onPopupScroll>[0]) =>
    candidates.onPopupScroll(event, loading);
  return (
    <WorkspaceScopeContext.Provider
      value={{
        result,
        loading,
        selectedGroupWorkspaceKey,
        setSelectedGroupWorkspaceKey,
        setSearch,
        onPopupScroll,
        problem,
        refresh: () => setRetry(value => value + 1),
      }}
    >
      {children}
    </WorkspaceScopeContext.Provider>
  );
}

export function useWorkspaceScope() {
  const value = useContext(WorkspaceScopeContext);
  if (!value) throw new Error('Platform workspace context is unavailable outside the authenticated shell');
  return value;
}

/** This is the sole UI selector, hosted in the authenticated shell header. */
export function WorkspaceScopeSelector() {
  const {
    result,
    loading,
    selectedGroupWorkspaceKey,
    setSelectedGroupWorkspaceKey,
    setSearch,
    onPopupScroll,
    problem,
    refresh,
  } = useWorkspaceScope();
  const locked = useOverlayLock();
  return (
    <>
      {problem && (
        <Alert
          type="error"
          showIcon
          title="暂时无法获取集团空间"
          description={
            <>
              <span>{problem.detail}</span>
              <Button type="link" size="small" onClick={refresh}>
                重试
              </Button>
            </>
          }
        />
      )}
      <Space size={8} align="center">
        <Typography.Text>集团空间</Typography.Text>
        <Select
          loading={loading || (!result && !problem)}
          disabled={locked}
          aria-label="集团空间"
          placeholder="请选择集团空间"
          style={{width: 288}}
          value={selectedGroupWorkspaceKey}
          onSelect={value => {
            setSelectedGroupWorkspaceKey(value);
            setSearch('');
          }}
          showSearch={{filterOption: false, onSearch: value => setSearch(value)}}
          onPopupScroll={onPopupScroll}
          notFoundContent={result && result.items.length === 0 ? '暂无可选择的集团空间' : undefined}
          options={(result?.items ?? []).map(row => ({
            value: row.groupWorkspaceKey,
            label: <NameCodeText name={row.name} code={row.groupWorkspaceKey} />,
          }))}
          optionRender={option => (
            <span {...testId(platformWorkspaceTestIds.option(String(option.value)))}>{option.label}</span>
          )}
          {...testId(platformWorkspaceTestIds.selector)}
        />
      </Space>
    </>
  );
}

/** Required platform pages never issue task reads before the shell has an explicit selection. */
export function WorkspaceScope({children}: {children: (key: string) => ReactNode}) {
  const {selectedGroupWorkspaceKey} = useWorkspaceScope();
  return selectedGroupWorkspaceKey ? (
    <Fragment key={selectedGroupWorkspaceKey}>{children(selectedGroupWorkspaceKey)}</Fragment>
  ) : (
    <Result
      status="info"
      title="请先选择集团空间"
      subTitle="选择集团空间后，才能查看对应的集团空间概览。"
      {...testId('platform-workspace-scope-required')}
    />
  );
}
