import {CloseCircleOutlined, PlusOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Divider, Drawer, Form, Input, Modal, Radio, Select, Space, Steps, Typography} from 'antd';
import type {FormInstance} from 'antd';
import {useEffect, useRef, useState} from 'react';
import {adminWideDrawerSurfaceProps, testId, type DrawerFormLifecycleResult} from '@catering-v2s/admin-ui-foundation';
import type {ApiProblem} from '../../../app/api/OperationsTransport';
import type {StoreTerminalAreaCandidate, StoreTerminalTagCandidate} from '../../../app/api/generated/operations-edge';
import {
  STORE_TERMINAL_DEVICE_TYPES,
  addableFunctionsForDeviceType,
  nextFunctionIdentityAfterRemoval,
  newTerminalFunction,
  newTerminalPrinter,
  resolveFunctionSelection,
  storeTerminalFunctionLabels,
  terminalFunctionIdentity,
  type StoreTerminalEditor,
  type StoreTerminalFormValues,
  type TerminalPrinterForm,
} from '../model/storeTerminalModel';
import {TerminalFunctionEditor, type TerminalCandidateState} from './TerminalFunctionEditor';
import {scenesReferencingPrinter, TerminalPrinterEditor, unbindPrinter} from './TerminalPrinterEditor';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export function StoreTerminalFormDrawer({
  editor,
  form,
  lifecycle,
  areaCandidates,
  tagCandidates,
  areasLoading,
  tagsLoading,
  areaCandidateError,
  tagCandidateError,
  onRetryAreaCandidates,
  onRetryTagCandidates,
  onFinish,
  onRetry,
  onValuesChange,
  saveDisabled = false,
  recoveryPending = false,
  problem,
  onClearProblem,
  onRefreshDetail,
  areaQueryText,
  tagQueryText,
  onAreaQueryTextChange,
  onTagQueryTextChange,
  candidateCacheKey,
}: {
  editor?: StoreTerminalEditor;
  form: FormInstance<StoreTerminalFormValues>;
  lifecycle: DrawerFormLifecycleResult;
  areaCandidates: TerminalCandidateState<StoreTerminalAreaCandidate>;
  tagCandidates: TerminalCandidateState<StoreTerminalTagCandidate>;
  areasLoading: boolean;
  tagsLoading: boolean;
  areaCandidateError?: unknown;
  tagCandidateError?: unknown;
  onRetryAreaCandidates: () => void;
  onRetryTagCandidates: () => void;
  onFinish: (values: StoreTerminalFormValues) => void;
  onRetry: () => void;
  onValuesChange: () => void;
  saveDisabled?: boolean;
  recoveryPending?: boolean;
  problem?: ApiProblem;
  onClearProblem: () => void;
  onRefreshDetail: () => void | Promise<void>;
  areaQueryText: string;
  tagQueryText: string;
  onAreaQueryTextChange: (value: string) => void;
  onTagQueryTextChange: (value: string) => void;
  candidateCacheKey: string;
}) {
  const [step, setStep] = useState(0);
  const [section, setSection] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const open = Boolean(editor);
  const deviceType = (Form.useWatch('deviceType', form) as string | undefined) ?? '';
  const functionValues = (Form.useWatch('functions', form) as StoreTerminalFormValues['functions'] | undefined) ?? [];
  const availableFunctions = addableFunctionsForDeviceType(deviceType, functionValues);
  const [selectedFunctionIdentity, setSelectedFunctionIdentity] = useState<string>();

  useEffect(() => {
    setSelectedFunctionIdentity(current => resolveFunctionSelection(functionValues, current));
  }, [functionValues]);

  useEffect(() => {
    setSelectedFunctionIdentity(undefined);
  }, [editor?.mode, editor?.terminal?.terminalRef]);

  const selectSection = (nextSection: number) => {
    setSection(nextSection);
    const sectionKey = ['basic', 'printers', 'functions'][nextSection];
    if (!sectionKey) return;
    requestAnimationFrame(() => {
      const target = sectionRefs.current[sectionKey];
      target?.scrollIntoView({block: 'start'});
      target?.focus({preventScroll: true});
    });
  };

  const sectionNav = (sectionKey: string, index: number, label: string) => (
    <span
      {...testId(storeTerminalTestIds.formSectionNav(sectionKey))}
      role="button"
      tabIndex={0}
      onClick={event => {
        event.stopPropagation();
        selectSection(index);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          selectSection(index);
        }
      }}
    >
      {label}
    </span>
  );

  useEffect(() => {
    setStep(editor?.mode === 'edit' ? 1 : 0);
    setSection(0);
  }, [editor]);

  useEffect(() => {
    if (!problem) return;
    const code = String(problem.errorCode);
    const message = problem.detail || '请检查输入后重试。';
    const field =
      code === 'STORE_TERMINAL_NAME_CONFLICT'
        ? 'name'
        : code === 'STORE_TERMINAL_ACTIVATION_CODE_CONFLICT'
          ? 'activationCode'
          : undefined;
    if (field) {
      form.setFields([{name: field, errors: [message]}]);
      requestAnimationFrame(() => void form.scrollToField(field));
    }
    if (code === 'STORE_TERMINAL_RULE_INVALID' || code === 'STORE_TERMINAL_REFERENCE_INVALID') setSection(2);
    if (
      code === 'STORE_TERMINAL_VERSION_CONFLICT' ||
      code === 'PLATFORM_COMMON_VERSION_CONFLICT' ||
      code === 'PLATFORM_COMMON_RESULT_UNKNOWN'
    )
      setSection(0);
  }, [form, problem]);

  const handleValuesChange = () => {
    onClearProblem();
    onValuesChange();
  };

  return (
    <Drawer
      open={open}
      title={editor?.mode === 'create' ? '新建终端' : `${editor?.terminal?.name ?? '终端'} · 编辑终端`}
      destroyOnHidden
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      {...testId(storeTerminalTestIds.formDrawer)}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(storeTerminalTestIds.formCancel)}
          >
            取消
          </Button>
          {editor?.mode === 'create' && step > 0 && (
            <Button
              onClick={() => setStep(0)}
              disabled={lifecycle.submitting}
              {...testId(storeTerminalTestIds.formBack)}
            >
              上一步
            </Button>
          )}
          {step === 0 ? (
            <Button
              type="primary"
              onClick={() =>
                void form
                  .validateFields(['deviceType'])
                  .then(() => setStep(1))
                  .catch(() => undefined)
              }
              {...testId(storeTerminalTestIds.formNext)}
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              loading={lifecycle.submitting}
              disabled={saveDisabled || recoveryPending}
              onClick={() => form.submit()}
              {...testId(storeTerminalTestIds.formSave)}
            >
              保存终端
            </Button>
          )}
        </Space>
      }
    >
      <Steps
        current={step}
        items={[{title: '基本信息'}, {title: '打印机、功能与范围'}]}
        {...testId(storeTerminalTestIds.formStep)}
      />
      {problem && (
        <Alert
          type="error"
          showIcon
          closable
          title={problem.title || '终端保存失败'}
          description={problem.detail || '请检查输入后重试。'}
          onClose={onClearProblem}
          action={
            [
              'STORE_TERMINAL_VERSION_CONFLICT',
              'PLATFORM_COMMON_VERSION_CONFLICT',
              'PLATFORM_COMMON_RESULT_UNKNOWN',
            ].includes(String(problem.errorCode)) ? (
              <Button
                onClick={() =>
                  problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN' ? onRetry() : void onRefreshDetail()
                }
              >
                {problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN' ? '按原意图重试' : '重读详情'}
              </Button>
            ) : undefined
          }
          style={{marginTop: 16}}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting || saveDisabled || recoveryPending}
        onFinish={onFinish}
        onFinishFailed={({errorFields}) => {
          const first = errorFields[0]?.name;
          if (first) void form.scrollToField(first);
        }}
        onValuesChange={handleValuesChange}
        style={{marginTop: 24}}
      >
        {step === 0 ? (
          <>
            <Form.Item label="设备类型" name="deviceType" rules={[{required: true, message: '请选择设备类型'}]}>
              <Radio.Group {...testId(storeTerminalTestIds.deviceType)}>
                {STORE_TERMINAL_DEVICE_TYPES.map(value => (
                  <Radio
                    key={value.key}
                    value={value.key}
                    {...testId(storeTerminalTestIds.deviceTypeOption(value.key))}
                  >
                    {value.label}
                    <Typography.Text type="secondary" style={{marginInlineStart: 8}}>
                      {value.description}
                    </Typography.Text>
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
            <Typography.Text type="secondary">先选择终端承载的设备形态，下一步再填写完整规则。</Typography.Text>
          </>
        ) : (
          <>
            <div style={{display: 'grid', gridTemplateColumns: '144px minmax(0, 1fr)', gap: 24, alignItems: 'start'}}>
              <Steps
                direction="vertical"
                current={section}
                onChange={selectSection}
                items={[
                  {
                    title: sectionNav('basic', 0, '基本信息'),
                  },
                  {
                    title: sectionNav('printers', 1, '打印机信息'),
                  },
                  {
                    title: sectionNav('functions', 2, '功能与范围'),
                  },
                ]}
                {...testId(storeTerminalTestIds.formSections)}
              />
              <div>
                <section
                  data-section="basic"
                  tabIndex={-1}
                  ref={node => {
                    sectionRefs.current.basic = node;
                  }}
                  {...testId(storeTerminalTestIds.formSection('basic'))}
                >
                  <Typography.Title level={5}>基本信息</Typography.Title>
                  <Form.Item
                    name="name"
                    label="终端名称"
                    rules={[{required: true, whitespace: true, message: '请输入终端名称'}]}
                  >
                    <Input maxLength={120} {...testId(storeTerminalTestIds.name)} />
                  </Form.Item>
                  <Form.Item name="deviceType" label="设备类型" rules={[{required: true, message: '请选择设备类型'}]}>
                    <Radio.Group {...testId(storeTerminalTestIds.deviceType)}>
                      {STORE_TERMINAL_DEVICE_TYPES.map(value => (
                        <Radio
                          key={value.key}
                          value={value.key}
                          {...testId(storeTerminalTestIds.deviceTypeOption(value.key))}
                        >
                          {value.label}
                          <Typography.Text type="secondary" style={{marginInlineStart: 8}}>
                            {value.description}
                          </Typography.Text>
                        </Radio>
                      ))}
                    </Radio.Group>
                  </Form.Item>
                  {editor?.mode === 'create' && (
                    <Form.Item
                      name="activationCode"
                      label="激活码（选填）"
                      extra="不填写则由系统自动生成；填写时请输入 8 位数字。"
                      rules={[{pattern: /^$|^\d{8}$/, message: '请输入 8 位数字激活码，或留空自动生成'}]}
                    >
                      <Input
                        maxLength={8}
                        placeholder="可不填，系统自动生成"
                        {...testId(storeTerminalTestIds.activationCode)}
                        suffix={
                          <Button
                            type="text"
                            size="small"
                            aria-label="清空激活码"
                            icon={<CloseCircleOutlined />}
                            onClick={() => {
                              form.setFieldValue('activationCode', undefined);
                              handleValuesChange();
                            }}
                            {...testId(storeTerminalTestIds.activationCodeClear)}
                          />
                        }
                      />
                    </Form.Item>
                  )}
                </section>

                <section
                  data-section="printers"
                  style={{marginTop: 24}}
                  tabIndex={-1}
                  ref={node => {
                    sectionRefs.current.printers = node;
                  }}
                  {...testId(storeTerminalTestIds.formSection('printers'))}
                >
                  <Typography.Title level={5}>打印机信息</Typography.Title>
                  <Form.List name="printers">
                    {(fields, {add, remove}) => (
                      <Space direction="vertical" size={12} style={{display: 'flex'}}>
                        {fields.map(field => {
                          const currentPrinter = form.getFieldValue(['printers', field.name]) as
                            TerminalPrinterForm | undefined;
                          const onRemove = () => {
                            const values = form.getFieldsValue(true) as StoreTerminalFormValues;
                            const printer = values.printers?.[field.name];
                            const printerKey = printer?.ref || printer?.clientKey;
                            if (!printerKey) {
                              remove(field.name);
                              onValuesChange();
                              return;
                            }
                            const impacted = scenesReferencingPrinter(values.functions ?? [], printerKey);
                            const removeAndUnbind = () => {
                              form.setFieldsValue({functions: unbindPrinter(values.functions ?? [], printerKey)});
                              remove(field.name);
                              onValuesChange();
                            };
                            if (!impacted.length) {
                              removeAndUnbind();
                              return;
                            }
                            Modal.confirm({
                              title: '移除已被场景使用的打印机？',
                              content: `该打印机已被${impacted.join('、')}引用，确认后将同时解除这些场景的打印机绑定。`,
                              okText: '确认移除并解绑',
                              cancelText: '取消',
                              okButtonProps: {...testId(storeTerminalTestIds.printerRemoveConfirm(String(printerKey)))},
                              cancelButtonProps: {
                                ...testId(storeTerminalTestIds.printerRemoveCancel(String(printerKey))),
                              },
                              onOk: removeAndUnbind,
                            });
                          };
                          return (
                            <TerminalPrinterEditor
                              key={field.key}
                              form={form}
                              index={field.name}
                              identity={String(currentPrinter?.ref ?? currentPrinter?.clientKey ?? field.key)}
                              onRemove={onRemove}
                              onValuesChange={onValuesChange}
                            />
                          );
                        })}
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => {
                            add(newTerminalPrinter());
                            onValuesChange();
                          }}
                          {...testId(storeTerminalTestIds.printerAdd)}
                        >
                          新增打印机
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </section>

                <Divider />
                <section
                  data-section="functions"
                  tabIndex={-1}
                  ref={node => {
                    sectionRefs.current.functions = node;
                  }}
                  {...testId(storeTerminalTestIds.formSection('functions'))}
                >
                  <Typography.Title level={5}>功能与范围</Typography.Title>
                  <Alert
                    type="info"
                    showIcon
                    message="先定义打印机，再为每个功能选择范围和打印场景；每个打印场景可独立选择多个同等地位的打印机。"
                    style={{marginBottom: 12}}
                  />
                  <Form.List name="functions">
                    {(fields, {add, remove}) => {
                      const entries = fields.map((field, fieldIndex) => {
                        const currentFunction = form.getFieldValue(['functions', field.name]) as
                          | StoreTerminalFormValues['functions'][number]
                          | undefined;
                        const kitchenOrdinal =
                          currentFunction?.functionKey === 'KITCHEN_PRINT'
                            ? functionValues
                                .slice(0, fieldIndex + 1)
                                .filter(value => value.functionKey === 'KITCHEN_PRINT').length
                            : undefined;
                        return {
                          field,
                          currentFunction,
                          identity: terminalFunctionIdentity(currentFunction, `function-${field.key}`),
                          title: `${storeTerminalFunctionLabels[currentFunction?.functionKey ?? ''] ?? '功能'}${
                            kitchenOrdinal ? ` ${kitchenOrdinal}` : ''
                          }`,
                          kitchenOrdinal,
                        };
                      });
                      const activeEntry =
                        entries.find(entry => entry.identity === selectedFunctionIdentity) ?? entries[0];
                      const currentFunctions = entries.flatMap(entry =>
                        entry.currentFunction ? [entry.currentFunction] : [],
                      );

                      return (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(190px, 0.32fr) minmax(0, 1fr)',
                            gap: 12,
                            alignItems: 'start',
                          }}
                        >
                          <Card size="small" title="功能实例" {...testId(storeTerminalTestIds.functionList)}>
                            <Space direction="vertical" size={6} style={{display: 'flex'}}>
                              {entries.map(entry => (
                                <Button
                                  key={entry.identity}
                                  block
                                  type={entry.identity === activeEntry?.identity ? 'primary' : 'text'}
                                  style={{textAlign: 'left'}}
                                  aria-pressed={entry.identity === activeEntry?.identity}
                                  onClick={() => setSelectedFunctionIdentity(entry.identity)}
                                  {...testId(storeTerminalTestIds.functionNav(entry.identity))}
                                >
                                  {entry.title}
                                </Button>
                              ))}
                              <Select
                                value={undefined}
                                placeholder="新增功能"
                                disabled={!availableFunctions.length}
                                options={availableFunctions.map(value => ({value: value.key, label: value.label}))}
                                onChange={value => {
                                  const next = newTerminalFunction(value as never);
                                  add(next);
                                  setSelectedFunctionIdentity(next.clientKey);
                                  onValuesChange();
                                }}
                                {...testId(storeTerminalTestIds.functionAdd)}
                              />
                              {!entries.length && (
                                <Typography.Text type="secondary">暂无功能，请先添加功能实例。</Typography.Text>
                              )}
                            </Space>
                          </Card>
                          <div>
                            {activeEntry ? (
                              <TerminalFunctionEditor
                                key={activeEntry.field.key}
                                form={form}
                                index={activeEntry.field.name}
                                onRemove={() => {
                                  setSelectedFunctionIdentity(
                                    nextFunctionIdentityAfterRemoval(currentFunctions, activeEntry.identity),
                                  );
                                  remove(activeEntry.field.name);
                                }}
                                deviceType={deviceType}
                                areaCandidates={areaCandidates}
                                tagCandidates={tagCandidates}
                                areasLoading={areasLoading}
                                tagsLoading={tagsLoading}
                                areaCandidateError={areaCandidateError}
                                tagCandidateError={tagCandidateError}
                                onRetryAreaCandidates={onRetryAreaCandidates}
                                onRetryTagCandidates={onRetryTagCandidates}
                                areaReferences={editor?.terminal?.areaReferences ?? []}
                                tagReferences={editor?.terminal?.tagReferences ?? []}
                                candidateCacheKey={candidateCacheKey}
                                functionOrdinal={activeEntry.kitchenOrdinal}
                                functionIdentity={activeEntry.identity}
                                onValuesChange={onValuesChange}
                                areaQueryText={areaQueryText}
                                tagQueryText={tagQueryText}
                                onAreaQueryTextChange={onAreaQueryTextChange}
                                onTagQueryTextChange={onTagQueryTextChange}
                              />
                            ) : (
                              <Typography.Text type="secondary">请选择或添加功能实例。</Typography.Text>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  </Form.List>
                </section>
              </div>
            </div>
          </>
        )}
      </Form>
    </Drawer>
  );
}
