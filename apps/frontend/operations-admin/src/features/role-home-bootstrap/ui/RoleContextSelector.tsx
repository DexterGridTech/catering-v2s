import {Alert, Button, Card, Form, Result, Select, Space, Typography} from 'antd';
import {EllipsisTooltip, testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type WorkspaceSessionEntry} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';

type Variant = 'initial' | 'header';

type RoleContextSelectorProps = {
  entry: WorkspaceSessionEntry;
  variant: Variant;
  disabled?: boolean;
  onSelected: (entry: WorkspaceSessionEntry) => void;
};

const switchProblem = '暂时无法切换任职，请重试';

export function RoleContextSelector({entry, variant, disabled = false, onSelected}: RoleContextSelectorProps) {
  const [draftAssignmentRef, setDraftAssignmentRef] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const locked = useOverlayLock();
  const options = entry.candidates.map((candidate) => ({value: candidate.roleAssignmentRef, label: `${candidate.roleName} · ${candidate.roleNodeName}`}));

  const select = async (roleAssignmentRef: string) => {
    if (submitting || locked || disabled) return;
    const request = generation.begin();
    lifecycle.markBusinessIntentChanged();
    setProblem(undefined);
    setSubmitting(true);
    try {
      const next = await operationsClient.selectOperationsWorkspaceSessionContext(
        {groupWorkspaceKey: entry.groupWorkspaceKey},
        {body: {roleAssignmentRef: wireUuid(roleAssignmentRef), requiredContextVersion: entry.contextVersion}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      if (generation.isCurrent(request)) onSelected(next);
    } catch {
      if (generation.isCurrent(request)) setProblem(switchProblem);
    } finally {
      if (generation.isCurrent(request)) setSubmitting(false);
    }
  };

  if (variant === 'header') {
    const selectedRef = entry.selected?.roleAssignmentRef;
    if (!selectedRef || entry.candidates.length < 2) return <Space size={8}><Typography.Text>当前角色</Typography.Text><Typography.Text type="secondary">{entry.selected ? `${entry.selected.roleName} · ${entry.selected.roleNodeName}` : '待选择'}</Typography.Text></Space>;
    return <Space size={8} align="center"><Typography.Text>当前角色</Typography.Text><Select aria-label="当前角色" style={{width: 288}} value={selectedRef} options={options} labelRender={({label}) => <EllipsisTooltip title={label}><span>{label}</span></EllipsisTooltip>} loading={submitting} disabled={disabled || locked || submitting} onChange={(next) => { if (next !== selectedRef) void select(next); }} {...testId('operations-role-context-header')}/>{problem && <Alert type="error" showIcon title={switchProblem}/>}</Space>;
  }

  if (entry.mode === 'EMPTY' || entry.candidates.length === 0) return <Result status="info" title="选择本次任职" subTitle="当前账号暂无可用任职，请联系集团管理员" {...testId('operations-role-context-empty')}/>;
  return <Card title="选择当前角色"><Form layout="vertical" disabled={submitting || locked} onFinish={() => { if (draftAssignmentRef) void select(draftAssignmentRef); }}><Form.Item label="可选角色" required><Select aria-label="可选角色" value={draftAssignmentRef} options={options} onChange={setDraftAssignmentRef} {...testId('operations-role-context-select')}/></Form.Item>{problem && <Alert type="error" showIcon title={switchProblem} style={{marginBottom: 16}}/>}<Button type="primary" htmlType="submit" disabled={!draftAssignmentRef || submitting || locked} loading={submitting} data-operation={OPERATIONS_ADMIN_OPERATION_IDS.selectOperationsWorkspaceSessionContext} {...testId('operations-role-context-enter')}>进入运营管理后台</Button></Form></Card>;
}
