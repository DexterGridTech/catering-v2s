import {Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, message} from 'antd';
import {
  adminDrawerSurfaceProps,
  createContentIdempotencyKey,
  testId,
  useAsyncGenerationGuard,
  useCursorCandidates,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useRef, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type TerminalUpdateArtifactSummary,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';
import {terminalUpdateTestIds} from '../../../app/automation/terminalUpdateTestIds';
import {idleMinutesToSeconds} from '../model/terminalUpdateDuration';
import {terminalUpdateCandidateQuery} from '../model/terminalUpdateCandidateQuery';

type RuleForm = {
  targetMode: 'ALL' | 'STORE_REFS';
  status: 'ENABLED' | 'DISABLED';
  storeRefs?: string[];
  fullArtifactRef: string;
  hotArtifactRef?: string;
  nMinutes: number;
  hotStrategy?: 'IMMEDIATE' | 'IDLE';
  mMinutes?: number;
  description?: string;
};
type Candidate = TerminalUpdateArtifactSummary;

export function RuleCreateDrawer({
  open,
  queryContext,
  projectRef,
  onClose,
  onCreated,
}: {
  open: boolean;
  queryContext: OperationsPageProps['queryContext'];
  projectRef: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form] = Form.useForm<RuleForm>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '填写中的更新规则不会保存。',
    idempotencyKey: true,
  });
  const resetPreservingOpen = lifecycle.resetPreservingOpen;
  const [problem, setProblem] = useState<string>();
  const [fullCandidateSearch, setFullCandidateSearch] = useState('');
  const [hotCandidateSearch, setHotCandidateSearch] = useState('');
  const targetMode = Form.useWatch('targetMode', form) ?? 'ALL';
  const fullArtifactRef = Form.useWatch('fullArtifactRef', form);
  const hotArtifactRef = Form.useWatch('hotArtifactRef', form);
  const hotStrategy = Form.useWatch('hotStrategy', form);
  const candidateContextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const latestCandidateContextKey = useRef(candidateContextKey);
  latestCandidateContextKey.current = candidateContextKey;
  const latestOpen = useRef(open);
  latestOpen.current = open;
  const submitScope = `${open}|${candidateContextKey}`;
  const submitScopeRef = useRef(submitScope);
  submitScopeRef.current = submitScope;
  const submitGeneration = useAsyncGenerationGuard();
  const candidateRequestId = useRef(0);
  const hotCandidateRequestId = useRef(0);
  const fullCandidateState = useCursorCandidates<Candidate>({
    queryText: fullCandidateSearch,
    resetKey: `${open}|${candidateContextKey}`,
    pageSize: 50,
    keyOf: item => item.artifactRef,
  });
  const hotCandidateState = useCursorCandidates<Candidate>({
    queryText: hotCandidateSearch,
    resetKey: `${open}|${candidateContextKey}|${fullArtifactRef ?? ''}`,
    pageSize: 50,
    keyOf: item => item.artifactRef,
  });
  const {
    items: fullCandidates,
    acceptPage: acceptFullCandidatePage,
    cursor: fullCandidateCursor,
    debouncedQueryText: fullCandidateQueryText,
    pageSize: fullCandidatePageSize,
    nextCursor: fullCandidateNextCursor,
    loadNext: loadNextFullCandidatePage,
    onPopupScroll: onFullCandidatePopupScroll,
  } = fullCandidateState;
  const {
    items: hotCandidates,
    acceptPage: acceptHotCandidatePage,
    cursor: hotCandidateCursor,
    debouncedQueryText: hotCandidateQueryText,
    pageSize: hotCandidatePageSize,
    nextCursor: hotCandidateNextCursor,
    loadNext: loadNextHotCandidatePage,
    onPopupScroll: onHotCandidatePopupScroll,
  } = hotCandidateState;
  const [fetchFullCandidatePage, fullCandidateQuery] =
    operationsRtk.useLazyGetOperationsTerminalUpdateArtifactCandidatePageQuery();
  const [fetchHotCandidatePage, hotCandidateQuery] =
    operationsRtk.useLazyGetOperationsTerminalUpdateArtifactCandidatePageQuery();
  const loadingCandidates = fullCandidateQuery.isFetching || hotCandidateQuery.isFetching;
  const stores = useOrganizationCandidates({
    open: open && targetMode === 'STORE_REFS',
    queryContext,
    subjectType: 'STORE',
    projectId: projectRef,
    pageSize: 50,
  });
  useOverlayLock(open);
  useEffect(() => {
    submitGeneration.invalidate();
    if (!open) return;
    candidateRequestId.current += 1;
    resetPreservingOpen();
    form.resetFields();
    form.setFieldsValue({targetMode: 'ALL', status: 'DISABLED', nMinutes: 5, hotStrategy: 'IMMEDIATE'});
    setProblem(undefined);
    setFullCandidateSearch('');
    setHotCandidateSearch('');
    return () => {
      candidateRequestId.current += 1;
      submitGeneration.invalidate();
    };
  }, [
    candidateContextKey,
    form,
    resetPreservingOpen,
    open,
    projectRef,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
    submitGeneration,
  ]);
  useEffect(() => {
    if (!open) return;
    const requestContextKey = candidateContextKey;
    const requestId = ++candidateRequestId.current;
    const request = operationsAdminRtkRequest.getOperationsTerminalUpdateArtifactCandidatePage(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey},
      {
        query: terminalUpdateCandidateQuery({
          expectedContextVersion: queryContext.expectedContextVersion,
          projectRef: wireUuid(projectRef),
          kind: 'FULL',
          queryText: fullCandidateQueryText,
          cursor: fullCandidateCursor,
          limit: fullCandidatePageSize,
        }),
      },
    );
    void fetchFullCandidatePage(request).unwrap()
      .then(page => {
        if (latestCandidateContextKey.current === requestContextKey && candidateRequestId.current === requestId)
          acceptFullCandidatePage(page.items, {nextCursor: page.nextCursor});
      })
      .catch(error => {
        if (latestCandidateContextKey.current === requestContextKey && candidateRequestId.current === requestId)
          setProblem(operationsProblemOf(error).detail || '读取 FULL 更新包候选失败');
      });
    return () => {
      if (candidateRequestId.current === requestId) candidateRequestId.current += 1;
    };
  }, [
    candidateContextKey,
    fetchFullCandidatePage,
    acceptFullCandidatePage,
    fullCandidateCursor,
    fullCandidatePageSize,
    fullCandidateQueryText,
    open,
    projectRef,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
  ]);
  const submit = async (values: RuleForm) => {
    if (lifecycle.submitting) return;
    const generation = submitGeneration.begin();
    const requestScope = submitScopeRef.current;
    const requestContextKey = candidateContextKey;
    const isCurrent = () => submitGeneration.isCurrent(generation) &&
      submitScopeRef.current === requestScope && latestCandidateContextKey.current === requestContextKey && latestOpen.current;
    setProblem(undefined);
    lifecycle.setSubmitting(true);
    try {
      const body = {
        targetMode: values.targetMode,
        ...(values.targetMode === 'STORE_REFS' ? {storeRefs: (values.storeRefs ?? []).map(wireUuid)} : {}),
        fullArtifactRef: wireUuid(values.fullArtifactRef),
        ...(values.hotArtifactRef ? {hotArtifactRef: wireUuid(values.hotArtifactRef)} : {}),
        status: values.status,
        nSeconds: Math.round(values.nMinutes * 60),
        ...(values.hotArtifactRef
          ? {
              hotStrategy: values.hotStrategy ?? 'IMMEDIATE',
              ...(values.hotStrategy === 'IDLE' && values.mMinutes !== undefined
                ? {mSeconds: idleMinutesToSeconds(values.mMinutes)}
                : {}),
            }
          : {}),
        description: values.description?.trim() || undefined,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.createOperationsProjectTerminalUpdateRule,
        body,
      );
      if (!isCurrent()) return;
      await operationsClient.createOperationsProjectTerminalUpdateRule(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef)},
        {
          query: {expectedContextVersion: queryContext.expectedContextVersion},
          body,
          headers: {'Idempotency-Key': idempotencyKey},
        },
      );
      if (!isCurrent()) return;
      lifecycle.setDirty(false);
      message.success(`更新规则已创建，当前为${values.status === 'ENABLED' ? '启用' : '停用'}状态`);
      lifecycle.closeAfterSuccess();
      await onCreated();
    } catch (error) {
      if (isCurrent()) setProblem(operationsProblemOf(error).detail || '保存更新规则失败');
    } finally {
      if (isCurrent()) lifecycle.setSubmitting(false);
    }
  };
  useEffect(() => {
    if (!open || !fullArtifactRef) return;
    const requestContextKey = candidateContextKey;
    const requestId = ++hotCandidateRequestId.current;
    const request = operationsAdminRtkRequest.getOperationsTerminalUpdateArtifactCandidatePage(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey},
      {
        query: terminalUpdateCandidateQuery({
          expectedContextVersion: queryContext.expectedContextVersion,
          projectRef: wireUuid(projectRef),
          kind: 'HOT',
          minimumFullArtifactRef: wireUuid(fullArtifactRef),
          queryText: hotCandidateQueryText,
          cursor: hotCandidateCursor,
          limit: hotCandidatePageSize,
        }),
      },
    );
    void fetchHotCandidatePage(request).unwrap()
      .then(page => {
        if (latestCandidateContextKey.current === requestContextKey &&
          hotCandidateRequestId.current === requestId && form.getFieldValue('fullArtifactRef') === fullArtifactRef)
          acceptHotCandidatePage(page.items, {nextCursor: page.nextCursor});
      })
      .catch(error => {
        if (latestCandidateContextKey.current === requestContextKey &&
          hotCandidateRequestId.current === requestId && form.getFieldValue('fullArtifactRef') === fullArtifactRef)
          setProblem(operationsProblemOf(error).detail || '读取 HOT 更新包候选失败');
      });
    return () => {
      if (hotCandidateRequestId.current === requestId) hotCandidateRequestId.current += 1;
    };
  }, [
    candidateContextKey,
    fetchHotCandidatePage,
    form,
    fullArtifactRef,
    acceptHotCandidatePage,
    hotCandidateCursor,
    hotCandidatePageSize,
    hotCandidateQueryText,
    open,
    projectRef,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
  ]);
  return (
    <Drawer
      title="新建终端更新规则"
      open={open}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      width={720}
      destroyOnHidden
      {...adminDrawerSurfaceProps}
      footer={(
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button>
          <Button
            type="primary"
            htmlType="submit"
            form="terminal-update-rule-create-form"
            loading={lifecycle.submitting}
            disabled={lifecycle.submitting}
            {...testId(terminalUpdateTestIds.createRuleSubmit)}
          >
            保存并创建
          </Button>
        </Space>
      )}
    >
      {problem && <Alert type="error" showIcon message={problem} />}
      <Form
        id="terminal-update-rule-create-form"
        form={form}
        layout="vertical"
        onFinish={submit}
        onValuesChange={() => lifecycle.setDirty(true)}
        disabled={lifecycle.submitting}
      >
        <Form.Item name="targetMode" label="应用范围" rules={[{required: true}]}>
          <Select
            options={[
              {value: 'ALL', label: '项目全部门店'},
              {value: 'STORE_REFS', label: '指定门店'},
            ]}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.targetModeOption(option.value as 'ALL' | 'STORE_REFS'))}>
                {option.label}
              </span>
            )}
            {...testId(terminalUpdateTestIds.targetMode)}
          />
        </Form.Item>
        <Form.Item name="status" label="初始状态" rules={[{required: true}]}>
          <Select
            options={[
              {value: 'DISABLED', label: '停用'},
              {value: 'ENABLED', label: '启用'},
            ]}
            {...testId(terminalUpdateTestIds.initialStatus)}
          />
        </Form.Item>
        {targetMode === 'STORE_REFS' && (
          <Form.Item name="storeRefs" label="门店" rules={[{required: true}]}>
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              onSearch={stores.setStoreSearch}
              onPopupScroll={stores.onPopupScroll}
              loading={stores.isFetching}
              options={stores.items.map(item => ({value: item.id, label: `${item.name} · ${item.code}`}))}
              optionRender={option => (
                <span {...testId(terminalUpdateTestIds.storeRefOption(String(option.value)))}>{option.label}</span>
              )}
              {...testId(terminalUpdateTestIds.storeRefs)}
            />
          </Form.Item>
        )}
        <Form.Item name="fullArtifactRef" label="FULL 更新包" rules={[{required: true}]}>
          <Select
            showSearch
            loading={loadingCandidates}
            options={fullCandidates.map(item => ({
              value: item.artifactRef,
              label: `${item.applicationId} · ${item.apkVersion} · ${item.runtimeVersion}`,
            }))}
            filterOption={false}
            onSearch={setFullCandidateSearch}
            onPopupScroll={event => onFullCandidatePopupScroll(event, fullCandidateQuery.isFetching)}
            dropdownRender={menu => (
              <>
                {menu}
                {fullCandidateNextCursor && (
                  <Button
                    type="link"
                    loading={fullCandidateQuery.isFetching}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => loadNextFullCandidatePage(fullCandidateQuery.isFetching)}
                    {...testId(terminalUpdateTestIds.fullArtifactLoadMore)}
                  >
                    加载更多
                  </Button>
                )}
              </>
            )}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.fullArtifactOption(String(option.value)))}>{option.label}</span>
            )}
            onChange={value => {
              hotCandidateRequestId.current += 1;
              form.setFieldValue('hotArtifactRef', undefined);
              setHotCandidateSearch('');
              if (!value) setProblem(undefined);
            }}
            {...testId(terminalUpdateTestIds.fullArtifact)}
          />
        </Form.Item>
        <Form.Item name="hotArtifactRef" label="HOT 更新包">
          <Select
            allowClear
            showSearch
            loading={loadingCandidates}
            filterOption={false}
            onSearch={setHotCandidateSearch}
            onPopupScroll={event => onHotCandidatePopupScroll(event, hotCandidateQuery.isFetching)}
            options={hotCandidates.map(item => ({
              value: item.artifactRef,
              label: `${item.applicationId} · ${item.jsVersion} · ${item.runtimeVersion}`,
            }))}
            onChange={value => {
              form.setFieldValue('mMinutes', undefined);
              form.setFieldValue('hotStrategy', value ? (form.getFieldValue('hotStrategy') ?? 'IMMEDIATE') : undefined);
            }}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.hotArtifactOption(String(option.value)))}>{option.label}</span>
            )}
            dropdownRender={menu => (
              <>
                {menu}
                {hotCandidateNextCursor && (
                  <Button
                    type="link"
                    loading={hotCandidateQuery.isFetching}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => loadNextHotCandidatePage(hotCandidateQuery.isFetching)}
                    {...testId(terminalUpdateTestIds.hotArtifactLoadMore)}
                  >
                    加载更多
                  </Button>
                )}
              </>
            )}
            {...testId(terminalUpdateTestIds.hotArtifact)}
          />
        </Form.Item>
        <Form.Item name="nMinutes" label="安装提醒间隔（分钟）" rules={[{required: true}]}>
          <InputNumber
            min={1}
            max={1440}
            precision={0}
            style={{width: '100%'}}
            {...testId(terminalUpdateTestIds.nMinutes)}
          />
        </Form.Item>
        {hotArtifactRef && (
          <Form.Item name="hotStrategy" label="HOT 执行策略" rules={[{required: true}]} preserve={false}>
            <Select
              options={[
                {value: 'IMMEDIATE', label: '立即执行'},
                {value: 'IDLE', label: '空闲时执行'},
              ]}
              optionRender={option => (
                <span {...testId(terminalUpdateTestIds.hotStrategyOption(option.value as 'IMMEDIATE' | 'IDLE'))}>
                  {option.label}
                </span>
              )}
              {...testId(terminalUpdateTestIds.hotStrategy)}
            />
          </Form.Item>
        )}
        {hotArtifactRef && hotStrategy === 'IDLE' && (
          <Form.Item name="mMinutes" label="空闲时长（分钟）" rules={[{required: true}]} preserve={false}>
            <InputNumber
              min={1}
              max={1440}
              precision={0}
              style={{width: '100%'}}
              {...testId(terminalUpdateTestIds.mMinutes)}
            />
          </Form.Item>
        )}
        <Form.Item name="description" label="说明">
          <Input.TextArea maxLength={500} {...testId(terminalUpdateTestIds.description)} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
