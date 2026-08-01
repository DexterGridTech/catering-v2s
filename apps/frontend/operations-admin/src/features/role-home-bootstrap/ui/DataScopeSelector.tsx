import {Alert, Button, Popover, Select, Space, Typography} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import type {WorkspaceSessionEntry} from '../../../app/api/generated/operations-edge';

type RequiredDataNodeType = 'NONE' | 'REGION' | 'PROJECT' | 'STORE';
type Candidate = NonNullable<WorkspaceSessionEntry['dataNodeCandidates']>[number];
type Option = {value: string; label: string};
type DataScopePage = {
  requiredDataNodeType: RequiredDataNodeType;
  noDataNodePrompt: string | null;
  noCandidatePrompt: string | null;
  cascadeLevelLabels: readonly string[];
};

type DataScopeSelectorProps = {
  entry: WorkspaceSessionEntry;
  page?: DataScopePage;
  disabled?: boolean;
  onChanged: (entry: WorkspaceSessionEntry) => void;
};

const scopeProblem = '暂时无法设置可查看范围，请重试';
const nameAt = (candidate: Candidate, index: number) => candidate.ancestorPath[index] ?? candidate.dataNodeName;
const distinct = (values: Array<{value?: string | null; label: string}>): Option[] => [...new Map(values.filter((value): value is {value: string; label: string} => Boolean(value.value)).map((value) => [value.value, value])).values()];

export function DataScopeSelector({entry, page, disabled = false, onChanged}: DataScopeSelectorProps) {
  const requiredDataNodeType = page?.requiredDataNodeType ?? 'NONE';
  const [open, setOpen] = useState(false);
  const [regionRef, setRegionRef] = useState<string>();
  const [projectRef, setProjectRef] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const locked = useOverlayLock();
  const candidates = entry.dataNodeCandidates ?? [];
  const regions = useMemo(() => distinct(candidates.map((candidate) => ({value: candidate.regionRef ?? (candidate.dataNodeType === 'REGION' ? candidate.dataNodeRef : undefined), label: nameAt(candidate, 0)}))), [candidates]);
  const projects = useMemo(() => distinct(candidates.filter((candidate) => (candidate.regionRef ?? (candidate.dataNodeType === 'REGION' ? candidate.dataNodeRef : undefined)) === regionRef).map((candidate) => ({value: candidate.projectRef ?? (candidate.dataNodeType === 'PROJECT' ? candidate.dataNodeRef : undefined), label: nameAt(candidate, 1)}))), [candidates, regionRef]);
  const finalCandidates = useMemo(() => candidates.filter((candidate) => candidate.dataNodeType === requiredDataNodeType && (requiredDataNodeType === 'REGION' || candidate.regionRef === regionRef) && (requiredDataNodeType !== 'STORE' || candidate.projectRef === projectRef)), [candidates, projectRef, regionRef, requiredDataNodeType]);
  const finalOptions = useMemo(() => finalCandidates.map((candidate) => ({value: candidate.dataNodeRef, label: candidate.dataNodeName})), [finalCandidates]);
  const [regionLabel = '大区', projectLabel = '项目', storeLabel = '门店'] = page?.cascadeLevelLabels ?? [];
  const noDataNodePrompt = page?.noDataNodePrompt ?? '请选择可查看范围';
  const noCandidatePrompt = page?.noCandidatePrompt ?? '当前任职没有可查看范围';

  useEffect(() => {
    if (!open) return;
    setProblem(undefined);
    const selected = entry.selectedDataNode;
    setRegionRef(selected?.regionRef ?? (selected?.dataNodeType === 'REGION' ? selected.dataNodeRef : undefined));
    setProjectRef(selected?.projectRef ?? (selected?.dataNodeType === 'PROJECT' ? selected.dataNodeRef : undefined));
  }, [entry.contextVersion, entry.selectedDataNode, open]);

  const submit = async (dataNodeRef: string) => {
    const candidate = finalCandidates.find((item) => item.dataNodeRef === dataNodeRef);
    if (!entry.selected || !candidate || submitting || locked || disabled) return;
    const request = generation.begin();
    lifecycle.markBusinessIntentChanged();
    setSubmitting(true);
    setProblem(undefined);
    try {
      const next = await operationsClient.selectOperationsWorkspaceSessionDataNode(
        {groupWorkspaceKey: entry.groupWorkspaceKey},
        {body: {dataNodeRef: candidate.dataNodeRef, dataNodeType: candidate.dataNodeType, requiredContextVersion: entry.contextVersion}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      if (generation.isCurrent(request)) { onChanged(next); setOpen(false); }
    } catch {
      if (generation.isCurrent(request)) setProblem(scopeProblem);
    } finally {
      if (generation.isCurrent(request)) setSubmitting(false);
    }
  };

  if (requiredDataNodeType === 'NONE') return null;
  const selectedName = entry.selectedDataNode?.dataNodeName ?? noDataNodePrompt;
  const selector = <Space direction="vertical" style={{minWidth: 300}}>
    <Typography.Title level={5}>选择可查看范围</Typography.Title>
    <Typography.Text>请选择本次需要查看的机构</Typography.Text>
    {problem && <Alert type="error" showIcon message={scopeProblem}/>}
    {regions.length === 0
      ? <Alert type="info" showIcon message={noCandidatePrompt}/>
      : <>
        <Typography.Text>{regionLabel}</Typography.Text>
        <Select showSearch aria-label={regionLabel} value={regionRef} options={regions} placeholder={`选择${regionLabel}`} disabled={submitting || locked || disabled} onChange={(value) => { setRegionRef(value); setProjectRef(undefined); }} {...testId('operations-data-scope-region')}/>
        {requiredDataNodeType !== 'REGION' && <>
          <Typography.Text>{projectLabel}</Typography.Text>
          <Select showSearch aria-label={projectLabel} value={projectRef} options={projects} placeholder={regionRef ? `选择${projectLabel}` : `请先选择${regionLabel}`} disabled={!regionRef || submitting || locked || disabled} onChange={setProjectRef} {...testId('operations-data-scope-project')}/>
        </>}
        {requiredDataNodeType === 'STORE'
          ? <>
            <Typography.Text>{storeLabel}</Typography.Text>
            <Select showSearch aria-label={storeLabel} options={finalOptions} placeholder={projectRef ? `选择${storeLabel}` : `请先选择${projectLabel}`} disabled={!projectRef || submitting || locked || disabled} onChange={(value) => void submit(value)} {...testId('operations-data-scope-store')}/>
          </>
          : <Select showSearch aria-label="最终可查看机构" options={finalOptions} placeholder={requiredDataNodeType === 'REGION' ? `选择${regionLabel}` : regionRef ? `选择${projectLabel}` : `请先选择${regionLabel}`} disabled={(requiredDataNodeType === 'PROJECT' && !regionRef) || submitting || locked || disabled} onChange={(value) => void submit(value)} {...testId('operations-data-scope-final')}/>}
      </>}
  </Space>;
  return <Popover open={open} onOpenChange={setOpen} placement="rightBottom" trigger="click" content={selector}><Button type="text" disabled={!entry.selected || disabled || locked || submitting} {...testId('operations-data-scope-trigger')}>可查看范围：{selectedName}</Button></Popover>;
}
