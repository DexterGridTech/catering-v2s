import {Alert, Button, Card, Drawer, Form, Input, Radio, Select, Space, Tag, Typography} from 'antd';
import {
  NameCodeText,
  adminDrawerSurfaceProps,
  closedCodeLabel,
  isKnownClosedCode,
  LifecycleStatusTag,
  testId,
  useAsyncGenerationGuard,
  useDrawerFormLifecycle,
  useOverlayLock,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type BusinessChannelTemplateStoreVisibilityScope,
  type BusinessChannelTemplateView,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {wireUuid} from '../../../app/api/wireUuid';
import {businessChannelTemplateTestIds} from '../../../app/automation/businessChannelTemplateTestIds';
import {readAllBusinessChannelTemplateVisibleStores, readExternalProviderCandidates} from '../application/queries';
import {
  BusinessChannelTemplateStorePickerModal,
  type EditableVisibleStore,
} from './BusinessChannelTemplateStorePickerModal';
import {
  accessKindLabels,
  dineInFormLabels,
  lifecycleStatusLabels,
  operatorKindLabels,
  orderKindLabels,
} from '../model/businessChannelCodeLabels';
import {
  authenticationKindLabels,
  catalogStatusLabels,
  organizationNodeTypeLabels,
} from '../model/collaborationCodeLabels';

type Values = {
  templateName: string;
  templateCode: string;
  accessKind: 'INTERNAL' | 'EXTERNAL';
  operatorKind: 'PROJECT' | 'STORE';
  orderKind: 'DINE_IN' | 'TAKEAWAY' | 'GROUP_BUY';
  dineInForm?: 'POS' | 'QR' | 'KIOSK';
  providerCode?: string;
  storeVisibilityScope: BusinessChannelTemplateStoreVisibilityScope;
};

export function BusinessChannelTemplateDrawer({
  open,
  queryContext,
  projectRef,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  projectRef: string;
  template?: BusinessChannelTemplateView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof readExternalProviderCandidates>>>([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerProblem, setProviderProblem] = useState<string>();
  const [providerRefreshVersion, setProviderRefreshVersion] = useState(0);
  const [problem, setProblem] = useState<string>();
  const [selectedStores, setSelectedStores] = useState<EditableVisibleStore[]>([]);
  const [storeReadProblem, setStoreReadProblem] = useState<string>();
  const [storeReadReady, setStoreReadReady] = useState(true);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const visibleStoreGeneration = useAsyncGenerationGuard();
  const providerGeneration = useAsyncGenerationGuard();
  const storePickerTrigger = useRef<HTMLButtonElement>(null);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: value => {
      if (!value) {
        setStorePickerOpen(false);
        onClose();
      }
    },
    idempotencyKey: true,
    diagnosticOperationId: template
      ? OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsBusinessChannelTemplate
      : OPERATIONS_ADMIN_OPERATION_IDS.createOperationsBusinessChannelTemplate,
  });
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  const accessKind = Form.useWatch('accessKind', form);
  const operatorKind = Form.useWatch('operatorKind', form);
  const orderKind = Form.useWatch('orderKind', form);
  const storeVisibilityScope = Form.useWatch('storeVisibilityScope', form);
  const organizationCandidates = useOrganizationCandidates({
    open: open && storePickerOpen && operatorKind === 'STORE' && storeVisibilityScope === 'SELECTED_PROJECT_STORES',
    queryContext,
    subjectType: 'STORE',
    projectId: projectRef,
  });
  const setStoreSearch = organizationCandidates.setStoreSearch;
  const templateVoidedOrUnknown =
    Boolean(template) && (!isKnownClosedCode(lifecycleStatusLabels, template?.status) || template?.status === 'VOIDED');

  const loadSelectedStores = useCallback(
    (clearExisting: boolean) => {
      if (
        !template ||
        template.operatorKind !== 'STORE' ||
        template.storeVisibilityScope !== 'SELECTED_PROJECT_STORES'
      ) {
        setStoreReadReady(true);
        setStoreReadProblem(undefined);
        return;
      }
      if (clearExisting) setSelectedStores([]);
      setStoreReadReady(false);
      setStoreReadProblem(undefined);
      const requestGeneration = visibleStoreGeneration.begin();
      void readAllBusinessChannelTemplateVisibleStores(queryContext, template.templateRef)
        .then(stores => {
          if (!visibleStoreGeneration.isCurrent(requestGeneration)) return;
          setSelectedStores(stores);
          setStoreReadReady(true);
        })
        .catch(error => {
          if (!visibleStoreGeneration.isCurrent(requestGeneration)) return;
          setStoreReadProblem(operationsProblemOf(error).detail || '门店范围读取失败，请重试。');
          setStoreReadReady(false);
        });
    },
    [queryContext, template, visibleStoreGeneration],
  );

  useEffect(() => {
    if (!open) return;
    setProblem(undefined);
    lifecycle.reset();
    setStoreSearch('');
    form.setFieldsValue(
      template
        ? {
            templateName: template.templateName,
            templateCode: template.templateCode ?? '',
            accessKind: template.accessKind as Values['accessKind'],
            operatorKind: template.operatorKind as Values['operatorKind'],
            orderKind: template.orderKind as Values['orderKind'],
            dineInForm: template.dineInForm as Values['dineInForm'],
            providerCode: template.providerCode ?? undefined,
            storeVisibilityScope: template.operatorKind === 'STORE' ? template.storeVisibilityScope : null,
          }
        : {
            templateName: undefined,
            templateCode: undefined,
            accessKind: 'INTERNAL',
            operatorKind: 'PROJECT',
            orderKind: 'TAKEAWAY',
            dineInForm: undefined,
            providerCode: undefined,
            storeVisibilityScope: null,
          },
    );
    if (template?.operatorKind === 'STORE' && template.storeVisibilityScope === 'SELECTED_PROJECT_STORES') {
      loadSelectedStores(true);
    } else {
      setSelectedStores([]);
      setStoreReadReady(true);
      setStoreReadProblem(undefined);
    }
    return () => visibleStoreGeneration.invalidate();
  }, [form, lifecycle, loadSelectedStores, open, setStoreSearch, template, visibleStoreGeneration]);

  useEffect(() => {
    if (!open || accessKind !== 'EXTERNAL') {
      providerGeneration.invalidate();
      setProviders([]);
      setProviderLoading(false);
      setProviderProblem(undefined);
      return;
    }
    const capabilityClass =
      orderKind === 'DINE_IN' || orderKind === 'TAKEAWAY' || orderKind === 'GROUP_BUY' ? orderKind : undefined;
    if (!capabilityClass) {
      setProviders([]);
      setProviderLoading(false);
      setProviderProblem('当前订单类型无法读取外部接入档案。');
      return;
    }
    const requestGeneration = providerGeneration.begin();
    setProviders([]);
    setProviderLoading(true);
    setProviderProblem(undefined);
    void readExternalProviderCandidates(queryContext, capabilityClass, operatorKind)
      .then(nextProviders => {
        if (providerGeneration.isCurrent(requestGeneration)) setProviders(nextProviders);
      })
      .catch(error => {
        if (providerGeneration.isCurrent(requestGeneration)) {
          setProviders([]);
          setProviderProblem(operationsProblemOf(error).detail || '外部接入档案读取失败，请重试。');
        }
      })
      .finally(() => {
        if (providerGeneration.isCurrent(requestGeneration)) setProviderLoading(false);
      });
    return () => providerGeneration.invalidate();
  }, [accessKind, open, operatorKind, orderKind, providerGeneration, providerRefreshVersion, queryContext]);

  useEffect(() => {
    if (!open || operatorKind !== 'STORE' || storeVisibilityScope !== 'SELECTED_PROJECT_STORES') {
      setStorePickerOpen(false);
    }
  }, [open, operatorKind, storeVisibilityScope]);

  const save = async (values: Values) => {
    if (templateVoidedOrUnknown) {
      setProblem('当前模板状态无法识别或已作废，已停止保存。');
      return;
    }
    if (
      values.operatorKind === 'STORE' &&
      values.storeVisibilityScope === 'SELECTED_PROJECT_STORES' &&
      !storeReadReady
    ) {
      setProblem('门店范围尚未完整读取，无法安全保存，请重试读取。');
      return;
    }
    if (
      values.accessKind === 'EXTERNAL' &&
      (!values.providerCode || !providers.some(provider => provider.providerCode === values.providerCode))
    ) {
      setProblem('外部接入档案尚未完成读取或选择，无法保存。');
      return;
    }
    setProblem(undefined);
    lifecycle.setSubmitting(true);
    const desiredScope = values.operatorKind === 'STORE' ? values.storeVisibilityScope : null;
    const finalVisibleStoreRefs =
      desiredScope === 'SELECTED_PROJECT_STORES' ? selectedStores.map(store => wireUuid(store.storeRef)) : [];
    try {
      if (template) {
        await operationsClient.updateOperationsBusinessChannelTemplate(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey, templateRef: template.templateRef},
          {
            body: {
              templateName: values.templateName.trim(),
              expectedVersion: template.version,
              storeVisibilityScope: desiredScope,
              visibleStoreRefs: finalVisibleStoreRefs,
            },
            headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
          },
        );
      } else {
        await operationsClient.createOperationsBusinessChannelTemplate(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey},
          {
            body: {
              projectRef: wireUuid(projectRef),
              templateName: values.templateName.trim(),
              templateCode: values.templateCode.trim(),
              accessKind: values.accessKind,
              operatorKind: values.operatorKind,
              orderKind: values.orderKind,
              dineInForm: values.orderKind === 'DINE_IN' ? (values.dineInForm ?? null) : null,
              providerCode: values.accessKind === 'EXTERNAL' ? (values.providerCode ?? null) : null,
              storeVisibilityScope: desiredScope,
              visibleStoreRefs: finalVisibleStoreRefs,
            },
            headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
          },
        );
      }
      submission.reset();
      lifecycle.closeAfterSuccess();
      onSaved();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      size={600}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      title={template ? '编辑渠道模板' : '新建渠道模板'}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(businessChannelTemplateTestIds.cancel)}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={
              templateVoidedOrUnknown ||
              lifecycle.submitting ||
              !storeReadReady ||
              (accessKind === 'EXTERNAL' && (providerLoading || Boolean(providerProblem) || providers.length === 0))
            }
            onClick={() => form.submit()}
            {...testId(businessChannelTemplateTestIds.submit)}
          >
            保存
          </Button>
        </Space>
      }
    >
      {problem && <Alert type="error" showIcon title="保存失败" description={problem} style={{marginBottom: 16}} />}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={values => void save(values)}
        {...testId(businessChannelTemplateTestIds.templateForm)}
        onValuesChange={(changed: Partial<Values>, values: Values) => {
          lifecycle.markBusinessIntentChanged();
          if (changed.accessKind === 'INTERNAL') form.setFieldValue('providerCode', undefined);
          if (changed.accessKind === 'EXTERNAL') form.setFieldsValue({providerCode: undefined, dineInForm: undefined});

          if ('operatorKind' in changed) {
            if (values.operatorKind === 'PROJECT') {
              form.setFieldsValue({storeVisibilityScope: null});
              setSelectedStores([]);
              setStoreReadReady(true);
              if (values.orderKind === 'DINE_IN') {
                form.setFieldsValue({accessKind: 'INTERNAL', providerCode: undefined, dineInForm: undefined});
              }
            } else if (!values.storeVisibilityScope) {
              form.setFieldsValue({storeVisibilityScope: 'ALL_PROJECT_STORES'});
              setStoreReadReady(true);
            }
          }

          if ('orderKind' in changed) {
            if (values.orderKind !== 'DINE_IN') {
              form.setFieldValue('dineInForm', undefined);
            } else if (values.operatorKind === 'PROJECT') {
              form.setFieldsValue({accessKind: 'INTERNAL', providerCode: undefined});
              form.setFieldValue('dineInForm', undefined);
            } else {
              form.setFieldValue('dineInForm', undefined);
            }
          }
        }}
      >
        <Form.Item label="模板名称" name="templateName" rules={[{required: true, message: '请输入模板名称'}]}>
          <Input disabled={templateVoidedOrUnknown} />
        </Form.Item>
        <Form.Item label="模板编码" name="templateCode" rules={[{required: true, message: '请输入模板编码'}]}>
          <Input disabled={Boolean(template) || templateVoidedOrUnknown} />
        </Form.Item>
        <Form.Item label="接入类型" name="accessKind" rules={[{required: true}]}>
          <Radio.Group disabled={Boolean(template)} {...testId(businessChannelTemplateTestIds.accessKind)}>
            <Radio value="INTERNAL" {...testId(businessChannelTemplateTestIds.accessKindInternal)}>
              {accessKindLabels.INTERNAL}
            </Radio>
            <Radio
              value="EXTERNAL"
              disabled={operatorKind === 'PROJECT' && orderKind === 'DINE_IN'}
              {...testId(businessChannelTemplateTestIds.accessKindExternal)}
            >
              {accessKindLabels.EXTERNAL}
            </Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="经营主体" name="operatorKind" rules={[{required: true}]}>
          <Select
            disabled={Boolean(template)}
            options={Object.entries(operatorKindLabels).map(([value, label]) => ({value, label}))}
            {...testId(businessChannelTemplateTestIds.operatorKind)}
          />
        </Form.Item>
        {operatorKind === 'STORE' && (
          <Form.Item
            label="门店可见范围"
            name="storeVisibilityScope"
            rules={[{required: true, message: '请选择门店可见范围'}]}
          >
            <Radio.Group
              disabled={templateVoidedOrUnknown}
              {...testId(businessChannelTemplateTestIds.visibilityScopeGroup)}
            >
              <Space direction="vertical">
                <Radio value="ALL_PROJECT_STORES" {...testId(businessChannelTemplateTestIds.visibilityScopeAllOption)}>
                  当前项目全部门店可见
                </Radio>
                <Radio
                  value="SELECTED_PROJECT_STORES"
                  {...testId(businessChannelTemplateTestIds.visibilityScopeSelectedOption)}
                >
                  当前项目部分门店可见
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        )}
        {operatorKind === 'STORE' && storeVisibilityScope === 'ALL_PROJECT_STORES' && (
          <Typography.Paragraph type="secondary">
            当前项目的全部门店都可以在满足门店状态条件时使用此模板新建渠道；范围变更不会影响已创建渠道。
          </Typography.Paragraph>
        )}
        {operatorKind === 'STORE' && storeVisibilityScope === 'SELECTED_PROJECT_STORES' && (
          <Card
            size="small"
            title={`已选门店（${selectedStores.length}）`}
            extra={
              <Button
                ref={storePickerTrigger}
                type="link"
                disabled={templateVoidedOrUnknown || lifecycle.submitting}
                onClick={() => {
                  setStoreSearch('');
                  setStorePickerOpen(true);
                }}
                {...testId(businessChannelTemplateTestIds.visibleStoreAdd)}
              >
                添加门店
              </Button>
            }
          >
            {storeReadProblem && (
              <Alert
                type="warning"
                showIcon
                title="门店范围读取失败"
                description={storeReadProblem}
                action={
                  <Button
                    onClick={() => loadSelectedStores(false)}
                    disabled={lifecycle.submitting}
                    {...testId(businessChannelTemplateTestIds.visibleStoreEditReadRetry)}
                  >
                    重试
                  </Button>
                }
                style={{marginBottom: 12}}
              />
            )}
            {selectedStores.length === 0 ? (
              <Space direction="vertical" size={4}>
                <Typography.Text type="secondary">当前尚未选择门店。</Typography.Text>
                {storeReadReady && (
                  <Typography.Text type="secondary">
                    保存后当前不会出现在任何门店的新建候选中，可稍后添加门店
                  </Typography.Text>
                )}
              </Space>
            ) : (
              <Space direction="vertical" size={8} style={{display: 'flex', marginBottom: 16}}>
                {selectedStores.map(store => (
                  <div
                    key={store.storeRef}
                    style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}
                  >
                    <Space size={8} wrap>
                      <NameCodeText name={store.storeName} code={store.storeCode} />
                      {store.storeStatus === 'VOIDED' && (
                        <span {...testId(businessChannelTemplateTestIds.visibleStoreVoidedTag(store.storeRef))}>
                          <LifecycleStatusTag status={store.storeStatus} />
                        </span>
                      )}
                      {store.storeStatus === 'DISABLED' && <LifecycleStatusTag status={store.storeStatus} />}
                    </Space>
                    <Button
                      type="link"
                      disabled={templateVoidedOrUnknown || lifecycle.submitting}
                      onClick={() => {
                        lifecycle.markBusinessIntentChanged();
                        setSelectedStores(current => current.filter(item => item.storeRef !== store.storeRef));
                      }}
                      {...testId(businessChannelTemplateTestIds.visibleStoreRemove(store.storeRef))}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        )}
        <Form.Item label="订单类型" name="orderKind" rules={[{required: true}]}>
          <Select
            disabled={Boolean(template)}
            options={Object.entries(orderKindLabels).map(([value, label]) => ({value, label}))}
            optionRender={option => {
              const optionTestId =
                option.value === 'DINE_IN'
                  ? businessChannelTemplateTestIds.orderKindDineIn
                  : option.value === 'TAKEAWAY'
                    ? businessChannelTemplateTestIds.orderKindTakeaway
                    : businessChannelTemplateTestIds.orderKindGroupBuy;
              return <span {...testId(optionTestId)}>{option.label}</span>;
            }}
            {...testId(businessChannelTemplateTestIds.orderKind)}
          />
        </Form.Item>
        {orderKind === 'DINE_IN' && accessKind === 'INTERNAL' && (
          <Form.Item label="到店点餐形式" name="dineInForm" rules={[{required: true, message: '请选择到店点餐形式'}]}>
            <Select
              disabled={Boolean(template)}
              options={Object.entries(dineInFormLabels).map(([value, label]) => ({value, label}))}
              optionRender={option => {
                const optionTestId =
                  option.value === 'POS'
                    ? businessChannelTemplateTestIds.dineInFormPos
                    : option.value === 'QR'
                      ? businessChannelTemplateTestIds.dineInFormQr
                      : businessChannelTemplateTestIds.dineInFormKiosk;
                return <span {...testId(optionTestId)}>{option.label}</span>;
              }}
              {...testId(businessChannelTemplateTestIds.dineInForm)}
            />
          </Form.Item>
        )}
        {orderKind === 'DINE_IN' && accessKind === 'EXTERNAL' && (
          <Alert
            type="info"
            showIcon
            title="外部到店点餐"
            description="外部系统不使用 POS、扫码或自助机点餐形式。"
            {...testId(businessChannelTemplateTestIds.externalDineInInfo)}
          />
        )}
        {accessKind === 'EXTERNAL' && (
          <>
            <Form.Item
              label="外部接入档案"
              name="providerCode"
              rules={[{required: true, message: '请选择外部接入档案'}]}
            >
              <Select
                disabled={Boolean(template)}
                loading={providerLoading}
                showSearch
                optionFilterProp="label"
                options={providers.map(provider => ({
                  value: provider.providerCode,
                  label: (
                    <Space>
                      <span>{provider.displayName}</span>
                      <span>{closedCodeLabel(authenticationKindLabels, provider.authenticationKind)}</span>
                      <span>
                        {provider.bindableNodeTypes
                          .map(value => closedCodeLabel(organizationNodeTypeLabels, value))
                          .join('、') || '—'}
                      </span>
                      <Tag>{closedCodeLabel(catalogStatusLabels, provider.catalogStatus)}</Tag>
                    </Space>
                  ),
                  disabled:
                    !isKnownClosedCode(authenticationKindLabels, provider.authenticationKind) ||
                    !isKnownClosedCode(catalogStatusLabels, provider.catalogStatus) ||
                    provider.bindableNodeTypes.some(value => !isKnownClosedCode(organizationNodeTypeLabels, value)),
                }))}
                optionRender={option => (
                  <span {...testId(businessChannelTemplateTestIds.providerOption(String(option.value)))}>
                    {option.label}
                  </span>
                )}
                {...testId(businessChannelTemplateTestIds.provider)}
              />
            </Form.Item>
            {providerProblem && (
              <Alert
                type="warning"
                showIcon
                title="外部接入档案读取失败"
                description={providerProblem}
                action={
                  <Button
                    onClick={() => setProviderRefreshVersion(version => version + 1)}
                    disabled={providerLoading}
                    {...testId(businessChannelTemplateTestIds.providerRetry)}
                  >
                    重试
                  </Button>
                }
                {...testId(businessChannelTemplateTestIds.providerReadProblem)}
              />
            )}
            {!providerLoading && !providerProblem && providers.length === 0 && (
              <Typography.Text type="secondary" {...testId(businessChannelTemplateTestIds.providerEmpty)}>
                {orderKind === 'DINE_IN' ? '当前没有可用的外部到店点餐接入档案' : '当前没有可用的外部接入档案'}
              </Typography.Text>
            )}
          </>
        )}
      </Form>
      <BusinessChannelTemplateStorePickerModal
        open={open && storePickerOpen}
        selectedStores={selectedStores}
        candidateItems={organizationCandidates.items}
        candidateLoading={organizationCandidates.isFetching}
        candidateErrorMessage={
          organizationCandidates.error ? operationsProblemOf(organizationCandidates.error).detail : undefined
        }
        disabled={templateVoidedOrUnknown || lifecycle.submitting}
        onCandidateSearchChange={setStoreSearch}
        onCandidateScroll={event => organizationCandidates.onPopupScroll(event)}
        onCandidateRetry={() => void organizationCandidates.refetch()}
        onCancel={() => setStorePickerOpen(false)}
        onConfirm={stores => {
          const changed =
            stores.length !== selectedStores.length ||
            stores.some((store, index) => store.storeRef !== selectedStores[index]?.storeRef);
          if (changed) lifecycle.markBusinessIntentChanged();
          setSelectedStores(stores);
          setStorePickerOpen(false);
        }}
        onClosed={() => storePickerTrigger.current?.focus()}
      />
    </Drawer>
  );
}
