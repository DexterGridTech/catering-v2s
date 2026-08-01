import {Alert, Button, Form, Result, Select} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock, useRefreshVersion} from '@catering-v2s/admin-ui-foundation';
import {Fragment, createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {platformClient, platformRefreshSignal, type PlatformApiProblem} from '../api/PlatformTransport';
import type {GroupWorkspacePage} from '../api/generated/platform-edge';

type WorkspaceScopeValue = {
  result?: GroupWorkspacePage;
  selectedGroupWorkspaceKey?: string;
  setSelectedGroupWorkspaceKey: (value: string | undefined) => void;
  setSearch: (value: string) => void;
  problem?: PlatformApiProblem;
  refresh: () => void;
};

const WorkspaceScopeContext = createContext<WorkspaceScopeValue | undefined>(undefined);

/** One app-owned, explicitly chosen workspace context; it is never an authorization decision. */
export function WorkspaceScopeProvider({children}: {children: ReactNode}) {
  const [result, setResult] = useState<GroupWorkspacePage>();
  const [selectedGroupWorkspaceKey, setSelectedGroupWorkspaceKey] = useState<string>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useAsyncGenerationGuard();
  const refreshVersion = useRefreshVersion(platformRefreshSignal);

  // A successful platform mutation is the authoritative point to re-check the
  // last confirmed selection against the complete enabled owner result, not a
  // transient user-search subset.
  useEffect(() => { setSearch(''); }, [refreshVersion]);

  useEffect(() => {
    const request = generation.begin();
    setProblem(undefined);
    void platformClient.listPlatformGroupWorkspaces({}, {query: {name: search.trim() || undefined, status: 'ENABLED', page: 1, pageSize: 100}})
      .then((value) => {
        if (!generation.isCurrent(request)) return;
        setResult(value);
        if (!search.trim() && selectedGroupWorkspaceKey && !value.items.some((item) => item.groupWorkspaceKey === selectedGroupWorkspaceKey)) setSelectedGroupWorkspaceKey(undefined);
      })
      .catch((error) => { if (generation.isCurrent(request)) setProblem(error as PlatformApiProblem); });
  }, [generation, refreshVersion, retry, search, selectedGroupWorkspaceKey]);

  return <WorkspaceScopeContext.Provider value={{result, selectedGroupWorkspaceKey, setSelectedGroupWorkspaceKey, setSearch, problem, refresh: () => setRetry((value) => value + 1)}}>{children}</WorkspaceScopeContext.Provider>;
}

export function useWorkspaceScope() {
  const value = useContext(WorkspaceScopeContext);
  if (!value) throw new Error('Platform workspace context is unavailable outside the authenticated shell');
  return value;
}

/** This is the sole UI selector, hosted in the authenticated shell side-bar footer. */
export function WorkspaceScopeSelector() {
  const {result, selectedGroupWorkspaceKey, setSelectedGroupWorkspaceKey, setSearch, problem, refresh} = useWorkspaceScope();
  const locked = useOverlayLock();
  return <>
    {problem && <Alert type="error" showIcon message="暂时无法获取集团空间" description={<><span>{problem.detail}</span><Button type="link" size="small" onClick={refresh}>重试</Button></>}/>} 
    <Form.Item label="集团空间" required>
      <Select
        loading={!result && !problem}
        disabled={locked}
        placeholder="请选择集团空间"
        value={selectedGroupWorkspaceKey}
        onSelect={(value) => { setSelectedGroupWorkspaceKey(value); setSearch(''); }}
        showSearch
        filterOption={false}
        onSearch={(value) => setSearch(value)}
        notFoundContent={result && result.items.length === 0 ? '暂无可选择的集团空间' : undefined}
        options={(result?.items ?? []).map((row) => ({value: row.groupWorkspaceKey, label: row.name}))}
        {...testId('platform-workspace-selector')}
      />
    </Form.Item>
  </>;
}

/** Required platform pages never issue task reads before the shell has an explicit selection. */
export function WorkspaceScope({children}: {children: (key: string) => ReactNode}) {
  const {selectedGroupWorkspaceKey} = useWorkspaceScope();
  return selectedGroupWorkspaceKey
    ? <Fragment key={selectedGroupWorkspaceKey}>{children(selectedGroupWorkspaceKey)}</Fragment>
    : <Result status="info" title="请先选择集团空间" subTitle="选择集团空间后，才能查看对应的集团空间概览。" {...testId('platform-workspace-scope-required')}/>;
}
