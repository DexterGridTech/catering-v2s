import {Alert, Button, Drawer, Select, Space, Tag} from 'antd';
import {adminDrawerSurfaceProps, formatNameCode, testId, useAsyncGenerationGuard, useDrawerFormLifecycle, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {OPERATIONS_ADMIN_OPERATION_IDS, type HeadCompany} from '../../../app/api/generated/operations-edge';
import {ACTION_CAPABILITIES, adminCatalog} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {
  HeadCompanyBrandAuthorizationActionAdapter,
  type HeadCompanyBrandAuthorizationResult,
} from '../application/HeadCompanyBrandAuthorizationActionAdapter';

const adapter = new HeadCompanyBrandAuthorizationActionAdapter();
const authorizationAction = adminCatalog.actions.find(
  (action) => action.actionKey === ACTION_CAPABILITIES.ORG_HEAD_COMPANY_BRAND,
);
const authorizationActionLabel = authorizationAction?.actionLabel;
if (!authorizationActionLabel) throw new Error('ADMIN_CATALOG_HEAD_COMPANY_BRAND_ACTION_MISSING');

type Props = {
  headCompany?: HeadCompany;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onUpdated: (headCompany: HeadCompany) => void;
};

export function HeadCompanyBrandAuthorizationDrawer({headCompany, queryContext, onClose, onUpdated}: Props) {
  const [candidateOptions, setCandidateOptions] = useState<Array<{value: string; label: string}>>([]);
  const [candidateProblem, setCandidateProblem] = useState<string>();
  const [selectedBrandId, setSelectedBrandId] = useState<string>();
  const [commandProblem, setCommandProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(headCompany),
    onOpenChange: (next) => { if (!next) onClose(); },
    dirtyMessage: '',
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.addOperationsOrganizationHeadCompanyBrandAuthorization,
  });
  useOverlayLock(Boolean(headCompany));
  const submission = useSubmissionLifecycle();
  const candidatesGeneration = useAsyncGenerationGuard();
  const searchContext = useMemo(
    () => ({groupWorkspaceKey: queryContext.groupWorkspaceKey, expectedContextVersion: queryContext.expectedContextVersion}),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );

  useEffect(() => {
    if (!headCompany) {
      candidatesGeneration.invalidate();
      return;
    }
    const request = candidatesGeneration.begin();
    setSelectedBrandId(undefined);
    setCommandProblem(undefined);
    lifecycle.reset();
    void adapter.searchEnabledBrands(searchContext, undefined).then((page) => {
      if (!candidatesGeneration.isCurrent(request)) return;
      setCandidateOptions(page.items.map((brand) => ({value: brand.id, label: formatNameCode(brand.name, brand.code)})));
      setCandidateProblem(undefined);
    }).catch(() => {
      if (candidatesGeneration.isCurrent(request)) setCandidateProblem('候选品牌加载失败。');
    });
  }, [candidatesGeneration, headCompany, lifecycle, searchContext]);

  const searchCandidates = (value: string) => {
    const request = candidatesGeneration.begin();
    setCandidateProblem(undefined);
    void adapter.searchEnabledBrands(searchContext, value).then((page) => {
      if (!candidatesGeneration.isCurrent(request)) return;
      setCandidateOptions(page.items.map((brand) => ({value: brand.id, label: formatNameCode(brand.name, brand.code)})));
    }).catch(() => {
      if (candidatesGeneration.isCurrent(request)) setCandidateProblem('候选品牌加载失败。');
    });
  };

  const act = async (brandId: string, action: 'add' | 'remove') => {
    if (!headCompany || lifecycle.submitting) return;
    submission.markBusinessIntentChanged();
    lifecycle.setSubmitting(true);
    setCommandProblem(undefined);
    try {
      const context = {...searchContext, headCompanyId: headCompany.id};
      const intent = {brandId, idempotencyKey: submission.getIdempotencyKey()};
      const result = action === 'add' ? await adapter.add(context, intent) : await adapter.remove(context, intent);
      if (result.kind === 'readback') {
        setSelectedBrandId(undefined);
        onUpdated(result.headCompany);
      } else {
        setCommandProblem(messageFor(result));
      }
    } finally { lifecycle.setSubmitting(false); }
  };

  const authorizedBrandIds = new Set(headCompany?.authorizedBrands.map((brand) => brand.id));
  const candidateChoices = candidateOptions.filter((candidate) => !authorizedBrandIds.has(candidate.value));
  return <Drawer
    title={`${authorizationActionLabel}：${headCompany?.name ?? ''}`}
    open={Boolean(headCompany)}
    size={600}
    destroyOnHidden
    maskClosable={!lifecycle.submitting}
    closable={!lifecycle.submitting}
    keyboard={!lifecycle.submitting}
    onClose={lifecycle.requestClose}
    afterOpenChange={lifecycle.afterOpenChange}
    {...adminDrawerSurfaceProps}
    footer={<Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>关闭</Button>}
  >
    {commandProblem && <Alert type="error" showIcon title={authorizationActionLabel} description={commandProblem} style={{marginBottom: 16}}/>}
    <Space.Compact block style={{marginBottom: 16}}>
      <Select
        aria-label="候选品牌"
        showSearch
        filterOption={false}
        onSearch={searchCandidates}
        value={selectedBrandId}
        placeholder="搜索并选择可授权品牌"
        loading={lifecycle.submitting}
        options={candidateChoices}
        onChange={setSelectedBrandId}
        notFoundContent={candidateProblem ?? undefined}
        {...testId('operations-head-company-brand-candidate')}
      />
      <Button
        type="primary"
        disabled={!selectedBrandId || lifecycle.submitting}
        loading={lifecycle.submitting}
        onClick={() => { if (selectedBrandId) void act(selectedBrandId, 'add'); }}
        {...testId('operations-head-company-brand-add')}
      >
        添加
      </Button>
    </Space.Compact>
    {headCompany?.authorizedBrands.length ? <Space orientation="vertical" style={{width: '100%'}}>
      {headCompany.authorizedBrands.map((brand) => <Space key={brand.id} style={{justifyContent: 'space-between', width: '100%'}}>
        <Tag>{formatNameCode(brand.name, brand.code)}</Tag>
        <Button
          danger
          disabled={lifecycle.submitting}
          loading={lifecycle.submitting}
          onClick={() => void act(brand.id, 'remove')}
          {...testId(`operations-head-company-brand-remove-${brand.id}`)}
        >
          移除
        </Button>
      </Space>)}
    </Space> : <Alert type="info" showIcon title="当前没有已授权品牌。"/>}
  </Drawer>;
}

function messageFor(result: Extract<HeadCompanyBrandAuthorizationResult, {kind: 'failure'}>) {
  return result.errorCode === 'ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE'
    ? '该品牌仍被门店使用。'
    : '操作未完成，请稍后重试。';
}
