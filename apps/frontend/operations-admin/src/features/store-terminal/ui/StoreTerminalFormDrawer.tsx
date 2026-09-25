import {CloseCircleOutlined, PlusOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Drawer, Form, Input, Modal, Radio, Select, Space, Tabs, Typography} from 'antd';
import type {FormInstance} from 'antd';
import type {ComponentProps} from 'react';
import {useEffect, useRef, useState} from 'react';
import {adminWideDrawerSurfaceProps, testId, type DrawerFormLifecycleResult} from '@catering-v2s/admin-ui-foundation';
import type {ApiProblem} from '../../../app/api/OperationsTransport';
import {operationsLogger} from '../../../app/api/OperationsTransport';
import type {StoreTerminalAreaCandidate, StoreTerminalTagCandidate} from '../../../app/api/generated/operations-edge';
import {
  STORE_TERMINAL_DEVICE_TYPES,
  addableFunctionsForDeviceType,
  nextFunctionIdentityAfterRemoval,
  newTerminalFunction,
  newTerminalPrinter,
  normalizeTerminalFunctionForm,
  normalizeTerminalPrinterForm,
  requireTerminalIdentity,
  storeTerminalFunctionLabels,
  storeTerminalFunctionMaxInstances,
  terminalFunctionIdentity,
  terminalPrinterIdentity,
  type StoreTerminalEditor,
  type StoreTerminalFormValues,
  type TerminalFunctionForm,
  type TerminalPrinterForm,
} from '../model/storeTerminalModel';
import {TerminalFunctionEditor, type TerminalCandidateState} from './TerminalFunctionEditor';
import {scenesReferencingPrinter, TerminalPrinterEditor, unbindPrinter} from './TerminalPrinterEditor';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

const EMPTY_FUNCTIONS: StoreTerminalFormValues['functions'] = [];

type FunctionListField = {key: number; name: number};
type FunctionListOperations = {
  add: (defaultValue?: StoreTerminalFormValues['functions'][number], insertIndex?: number) => void;
  remove: (index: number | number[]) => void;
};
type FunctionEditorSharedProps = Omit<
  ComponentProps<typeof TerminalFunctionEditor>,
  'index' | 'functionIdentity' | 'functionOrdinal' | 'onRemove'
>;
type TerminalFunctionCollectionEditorProps = FunctionEditorSharedProps & {
  fields: readonly FunctionListField[];
  operations: FunctionListOperations;
  availableFunctions: ReturnType<typeof addableFunctionsForDeviceType>;
  selectionResetKey: string;
};

/**
 * The selected function editor is the only mounted child editor. Keep submit
 * reading the preserved aggregate Form store so switching function rows does
 * not turn the other configured rows into empty request entries.
 */
export function preservedTerminalFormValues(form: FormInstance<StoreTerminalFormValues>): StoreTerminalFormValues {
  return form.getFieldsValue(true) as StoreTerminalFormValues;
}

export function handleStoreTerminalFormFinish(
  form: FormInstance<StoreTerminalFormValues>,
  onFinish: (values: StoreTerminalFormValues) => void,
): void {
  onFinish(preservedTerminalFormValues(form));
}

function TerminalFunctionCollectionEditor({
  fields,
  operations,
  availableFunctions,
  selectionResetKey,
  ...editorProps
}: TerminalFunctionCollectionEditorProps) {
  const [selectedFunctionIdentity, setSelectedFunctionIdentity] = useState<string>();
  const pendingFunctionsRef = useRef(new Map<number, StoreTerminalFormValues['functions'][number]>());

  useEffect(() => {
    setSelectedFunctionIdentity(undefined);
    pendingFunctionsRef.current.clear();
  }, [selectionResetKey]);

  const entries = fields.flatMap((field, fieldIndex) => {
    const storedFunction = editorProps.form.getFieldValue(['functions', field.name]) as
      Partial<StoreTerminalFormValues['functions'][number]> | undefined;
    // Form.List publishes its new field metadata before the complete default
    // value is observable through the form store. Keep the request-level row
    // that was just added as the authoritative snapshot during that short
    // window; if neither source has an identity yet, do not invent one from
    // the Form.List position. The pending request snapshot is installed
    // before add(), so the row becomes visible as soon as it is identifiable.
    const pendingFunction = pendingFunctionsRef.current.get(field.name);
    const currentFunction =
      normalizeTerminalFunctionForm(storedFunction) ?? normalizeTerminalFunctionForm(pendingFunction);
    if (!currentFunction) return [];
    const identity = terminalFunctionIdentity(currentFunction);
    requireTerminalIdentity(identity, 'function');
    const unboundedFunctionOrdinal =
      currentFunction && storeTerminalFunctionMaxInstances(currentFunction.functionKey) === null
        ? fields
            .slice(0, fieldIndex + 1)
            .map(
              item =>
                editorProps.form.getFieldValue(['functions', item.name]) as Partial<TerminalFunctionForm> | undefined,
            )
            .map(value => normalizeTerminalFunctionForm(value))
            .filter(value => value && storeTerminalFunctionMaxInstances(value.functionKey) === null).length
        : undefined;
    return [
      {
        field,
        currentFunction,
        identity,
        title: `${storeTerminalFunctionLabels[currentFunction.functionKey] ?? '功能'}${
          unboundedFunctionOrdinal ? ` ${unboundedFunctionOrdinal}` : ''
        }`,
        kitchenOrdinal: unboundedFunctionOrdinal,
      },
    ];
  });
  const activeEntry = entries.find(entry => entry.identity === selectedFunctionIdentity) ?? entries[0];
  const currentFunctions = entries.flatMap(entry => (entry.currentFunction ? [entry.currentFunction] : []));

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
              const nextIndex = fields.length;
              pendingFunctionsRef.current.set(nextIndex, next);
              operations.add(next);
              // Form.List registers the row structure, but a just-added
              // aggregate can publish only its field metadata for one render.
              // Re-assert the complete row in the Form store so the function
              // key, client identity and nested scene defaults remain the
              // authoritative draft consumed by the editor and submit.
              editorProps.form.setFieldValue(['functions', nextIndex], next);
              editorProps.form.setFieldValue(['functions', nextIndex, 'clientKey'], next.clientKey);
              setSelectedFunctionIdentity(next.clientKey);
              editorProps.onValuesChange();
            }}
            {...testId(storeTerminalTestIds.functionAdd)}
          />
          {!entries.length && <Typography.Text type="secondary">暂无功能，请先添加功能实例。</Typography.Text>}
        </Space>
      </Card>
      <div>
        {activeEntry ? (
          <TerminalFunctionEditor
            {...editorProps}
            key={activeEntry.field.key}
            index={activeEntry.field.name}
            onRemove={() => {
              pendingFunctionsRef.current.delete(activeEntry.field.name);
              setSelectedFunctionIdentity(nextFunctionIdentityAfterRemoval(currentFunctions, activeEntry.identity));
              operations.remove(activeEntry.field.name);
            }}
            functionOrdinal={activeEntry.kitchenOrdinal}
            functionIdentity={activeEntry.identity}
          />
        ) : (
          <Typography.Text type="secondary">请选择或添加功能实例。</Typography.Text>
        )}
      </div>
    </div>
  );
}

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
  problem,
  notice,
  onClearProblem,
  onRefreshDetail,
  areaQueryText,
  tagQueryText,
  onAreaQueryTextChange,
  onTagQueryTextChange,
  onConfigurationOpen,
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
  problem?: ApiProblem;
  notice?: {title: string; detail: string};
  onClearProblem: () => void;
  onRefreshDetail: () => void | Promise<void>;
  areaQueryText: string;
  tagQueryText: string;
  onAreaQueryTextChange: (value: string) => void;
  onTagQueryTextChange: (value: string) => void;
  onConfigurationOpen: () => void;
  candidateCacheKey: string;
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'functions'>('basic');
  const configurationOpenedKeyRef = useRef<string | undefined>(undefined);
  const pendingPrintersRef = useRef(new Map<number, TerminalPrinterForm>());
  const open = Boolean(editor);
  const editorKey = editor
    ? `${editor.mode}:${editor.contextKey}:${editor.terminal?.terminalRef ?? 'new'}`
    : undefined;
  const editorMode = editor?.mode;
  const deviceType = (Form.useWatch('deviceType', form) as string | undefined) ?? '';
  const watchedPrinters = Form.useWatch('printers', form) as StoreTerminalFormValues['printers'] | undefined;
  // The scene selectors use the same draft identity as the printer Form.List.
  // useWatch can publish a partial collection while a sibling printer field is
  // being committed; reading the form store first keeps clientKey/ref and the
  // option values in sync with the authoritative draft.
  const storedValues = form.getFieldsValue(true) as Partial<StoreTerminalFormValues>;
  const storedPrinters = storedValues.printers;
  const rawPrinterValues = Array.isArray(storedPrinters)
    ? storedPrinters
    : Array.isArray(watchedPrinters)
      ? watchedPrinters
      : [];
  const printerByIdentity = new Map<string, TerminalPrinterForm>();
  for (const value of rawPrinterValues) {
    const normalized = normalizeTerminalPrinterForm(value);
    const identity = terminalPrinterIdentity(normalized);
    if (normalized && identity) printerByIdentity.set(identity, normalized);
  }
  for (const pending of pendingPrintersRef.current.values()) {
    const identity = terminalPrinterIdentity(pending);
    if (identity && !printerByIdentity.has(identity)) printerByIdentity.set(identity, pending);
  }
  const printerValues = [...printerByIdentity.values()];
  const watchedFunctions = Form.useWatch('functions', form) as StoreTerminalFormValues['functions'] | undefined;
  // Form.List may briefly expose an object while a collection is mounted or
  // reconciled.  Keep all collection consumers on the array contract so a
  // transient value cannot replace the whole page with the error boundary.
  // useWatch is the render subscription; the complete Form store is the
  // authority for identities and collection membership.  Using only the
  // watcher here can reset a just-added function back to the previous item
  // before the watcher publishes the new collection.
  const storedFunctions = storedValues.functions;
  const functionValues = Array.isArray(storedFunctions)
    ? storedFunctions.filter((value): value is StoreTerminalFormValues['functions'][number] => Boolean(value))
    : Array.isArray(watchedFunctions)
      ? watchedFunctions.filter((value): value is StoreTerminalFormValues['functions'][number] => Boolean(value))
      : EMPTY_FUNCTIONS;
  const availableFunctions = addableFunctionsForDeviceType(deviceType, functionValues);

  useEffect(() => {
    setActiveTab('basic');
    pendingPrintersRef.current.clear();
    if (!editorKey) {
      configurationOpenedKeyRef.current = undefined;
      return;
    }
    if (editorMode === 'create' && configurationOpenedKeyRef.current !== editorKey) {
      configurationOpenedKeyRef.current = editorKey;
      onConfigurationOpen();
    }
  }, [editorKey, editorMode, onConfigurationOpen]);

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
    if (code === 'STORE_TERMINAL_RULE_INVALID' || code === 'STORE_TERMINAL_REFERENCE_INVALID') setActiveTab('functions');
    if (code === 'PLATFORM_COMMON_VERSION_CONFLICT' || code === 'PLATFORM_COMMON_RESULT_UNKNOWN') setActiveTab('basic');
  }, [form, problem]);

  const handleValuesChange = () => {
    onClearProblem();
    onValuesChange();
  };

  const handleFinish = () => {
    // Only the selected function editor is mounted. Ant Design's onFinish
    // payload therefore contains empty placeholders for unmounted Form.List
    // rows, while the preserved Form store contains the complete aggregate
    // draft (including functions configured before the user switched rows).
    // Submit the authoritative preserved store after Form has validated the
    // currently mounted controls so inactive function rows cannot be lost.
    handleStoreTerminalFormFinish(form, onFinish);
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
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={saveDisabled}
            onClick={() => form.submit()}
            {...testId(storeTerminalTestIds.formSave)}
          >
            保存终端
          </Button>
        </Space>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          closable
          title={problem.title || '终端保存失败'}
          description={problem.detail || '请检查输入后重试。'}
          onClose={onClearProblem}
          action={
            ['PLATFORM_COMMON_VERSION_CONFLICT', 'PLATFORM_COMMON_RESULT_UNKNOWN'].includes(
              String(problem.errorCode),
            ) ? (
              <Button
                onClick={() =>
                  problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN' ? onRetry() : void onRefreshDetail()
                }
              >
                {problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN' ? '重试原操作' : '重读详情'}
              </Button>
            ) : undefined
          }
          style={{marginTop: 16}}
        />
      )}
      {notice && !problem && (
        <Alert
          type="warning"
          showIcon
          closable
          title={notice.title}
          description={notice.detail}
          onClose={onClearProblem}
          style={{marginTop: 16}}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting || saveDisabled}
        onFinish={handleFinish}
        onFinishFailed={({errorFields}) => {
          operationsLogger.warn({
            event: 'frontend.store_terminal.form_validation_failed',
            phase: 'mutation.validation',
            outcome: 'REJECTED',
            diagnostic: {errorCount: errorFields.length},
          });
          const first = errorFields[0]?.name;
          if (first) {
            const root = Array.isArray(first) ? first[0] : first;
            setActiveTab(root === 'functions' ? 'functions' : 'basic');
            requestAnimationFrame(() => void form.scrollToField(first));
          }
        }}
        onValuesChange={handleValuesChange}
        style={{marginTop: 24}}
      >
        <Tabs
          activeKey={activeTab}
          onChange={key => setActiveTab(key as 'basic' | 'functions')}
          destroyOnHidden={false}
          items={[
            {
              key: 'basic',
              label: <span {...testId(storeTerminalTestIds.formTab('basic'))}>基本信息与打印机</span>,
              children: (
                <div style={{width: '100%'}}>
                  <section {...testId(storeTerminalTestIds.formSection('basic'))}>
                    <Typography.Title level={5}>基本信息</Typography.Title>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                        gap: '0 12px',
                      }}
                    >
                      <Form.Item
                        name="name"
                        label="终端名称"
                        rules={[{required: true, whitespace: true, message: '请输入终端名称'}]}
                      >
                        <Input maxLength={120} {...testId(storeTerminalTestIds.name)} />
                      </Form.Item>
                      <Form.Item
                        name="deviceType"
                        label="设备类型"
                        rules={[{required: true, message: '请选择设备类型'}]}
                      >
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
                    </div>
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
                    style={{marginTop: 16}}
                    {...testId(storeTerminalTestIds.formSection('printers'))}
                  >
                    <Typography.Title level={5}>打印机信息</Typography.Title>
                    <Form.List name="printers">
                      {(fields, {add, remove}) => (
                        <Space direction="vertical" size={8} style={{display: 'flex'}}>
                          {fields.map(field => {
                            // Form.List's collection watcher can lag behind a
                            // sibling field change. Read the authoritative Form
                            // store so a brand selection immediately enables its
                            // model and connection dependents.
                            const currentPrinter =
                              normalizeTerminalPrinterForm(
                                form.getFieldValue(['printers', field.name]) as
                                  | Partial<TerminalPrinterForm>
                                  | undefined,
                              ) ?? pendingPrintersRef.current.get(field.name);
                            if (!currentPrinter) return null;
                            const printerIdentity = terminalPrinterIdentity(currentPrinter);
                            requireTerminalIdentity(printerIdentity, 'printer');
                            const onRemove = () => {
                              const values = form.getFieldsValue(true) as StoreTerminalFormValues;
                              const printer = values.printers?.[field.name];
                              const rawPrinterKey = printer?.ref || printer?.clientKey;
                              const printerKey = typeof rawPrinterKey === 'string' ? rawPrinterKey : undefined;
                              if (!printerKey) {
                                pendingPrintersRef.current.delete(field.name);
                                remove(field.name);
                                onValuesChange();
                                return;
                              }
                              const impacted = scenesReferencingPrinter(values.functions ?? [], printerKey);
                              const removeAndUnbind = () => {
                                form.setFieldsValue({functions: unbindPrinter(values.functions ?? [], printerKey)});
                                pendingPrintersRef.current.delete(field.name);
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
                                okButtonProps: {
                                  ...testId(storeTerminalTestIds.printerRemoveConfirm(String(printerKey))),
                                },
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
                                identity={printerIdentity}
                                onRemove={onRemove}
                                onValuesChange={onValuesChange}
                              />
                            );
                          })}
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() => {
                              const nextPrinter = newTerminalPrinter();
                              const nextIndex = fields.length;
                              pendingPrintersRef.current.set(nextIndex, nextPrinter);
                              add(nextPrinter);
                              form.setFieldValue(['printers', nextIndex, 'clientKey'], nextPrinter.clientKey);
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
                </div>
              ),
            },
            {
              key: 'functions',
              label: <span {...testId(storeTerminalTestIds.formTab('functions'))}>功能与范围</span>,
              children: (
                <section {...testId(storeTerminalTestIds.formSection('functions'))}>
                  <Typography.Title level={5}>功能与范围</Typography.Title>
                  <Alert
                    type="info"
                    showIcon
                    message="先定义打印机，再为每个功能选择范围和打印场景；每个打印场景可独立选择多个同等地位的打印机。"
                    style={{marginBottom: 12}}
                  />
                  <Form.List name="functions">
                    {(fields, operations) => (
                      <TerminalFunctionCollectionEditor
                        fields={fields}
                        operations={operations}
                        availableFunctions={availableFunctions}
                        selectionResetKey={`${editor?.mode ?? 'closed'}:${editor?.terminal?.terminalRef ?? 'new'}`}
                        form={form}
                        printerValues={printerValues}
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
                        onValuesChange={onValuesChange}
                        areaQueryText={areaQueryText}
                        tagQueryText={tagQueryText}
                        onAreaQueryTextChange={onAreaQueryTextChange}
                        onTagQueryTextChange={onTagQueryTextChange}
                      />
                    )}
                  </Form.List>
                </section>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}
