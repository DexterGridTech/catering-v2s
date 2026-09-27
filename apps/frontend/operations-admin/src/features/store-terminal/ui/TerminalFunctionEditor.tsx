import {Alert, Button, Card, Checkbox, Form, Input, Select, Space, Typography} from 'antd';
import type {FormInstance} from 'antd';
import {useEffect, useRef} from 'react';
import {NameCodeText, testId, type CursorCandidatesState} from '@catering-v2s/admin-ui-foundation';
import type {
  StoreTerminalAreaCandidate,
  StoreTerminalAreaReference,
  StoreTerminalTagCandidate,
  StoreTerminalTagReference,
} from '../../../app/api/generated/operations-edge';
import {STORE_TERMINAL_ORDER_TYPES, STORE_TERMINAL_RANGE_KEYS} from '../../../app/api/generated/storeTerminalRules';
import {
  allowedRangesForFunction,
  clearTerminalSceneConfiguration,
  functionOptionsForDeviceType,
  normalizeTerminalFunctionForm,
  scenePrinterKeysForDisplay,
  terminalSceneDraftHasInvalidCollections,
  terminalPrinterIdentity,
  scenesForFunction,
  storeTerminalFunctionLabels,
  storeTerminalFunctionMaxInstances,
  storeTerminalRangeLabels,
  type StoreTerminalConfigurationFormValues,
  type StoreTerminalFormValues,
  type StoreTerminalFunctionKey,
  type TerminalPrinterForm,
  type TerminalSceneForm,
} from '../model/storeTerminalModel';
import {TerminalSceneEditor} from './TerminalSceneEditor';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export type TerminalCandidateState<T> = Pick<
  CursorCandidatesState<T>,
  'items' | 'onPopupScroll' | 'nextCursor' | 'total' | 'debouncedQueryText'
>;

const ALL = '__ALL__';
type Candidate = StoreTerminalAreaCandidate | StoreTerminalTagCandidate;

export function normalizeCandidateSelection(value: readonly string[]) {
  return value.includes(ALL) ? [ALL] : [...value];
}

export function terminalFunctionDraftHasSceneChanges(
  scenes: Record<string, Partial<TerminalSceneForm> | undefined> | undefined,
  knownPrinterKeys: readonly string[],
) {
  const allowedOrderTypeKeys = STORE_TERMINAL_ORDER_TYPES.map(orderType => orderType.key);
  return Object.values(scenes ?? {}).some(scene => {
    if (terminalSceneDraftHasInvalidCollections(scene, allowedOrderTypeKeys, knownPrinterKeys)) {
      return true;
    }
    return (
      (Array.isArray(scene?.orderTypes) && scene.orderTypes.length > 0) ||
      (Array.isArray(scene?.printerKeys) && scene.printerKeys.length > 0)
    );
  });
}

export function updateFunctionRange(
  form: FormInstance<StoreTerminalFormValues>,
  index: number,
  patch: Partial<
    Pick<
      StoreTerminalConfigurationFormValues['functions'][number],
      'tableAreaAll' | 'tableAreaRefs' | 'productionTagAll' | 'productionTagRefs'
    >
  >,
) {
  // Update the two draft fields at their actual Form.List paths. Replacing the
  // complete functions collection made the second dynamic row publish a stale
  // controlled Select value after an option click (the visible option changed,
  // but the Select reverted to its placeholder). A field-path write preserves
  // the row identity and lets Form.useWatch converge on the same value that
  // the owner will receive on submit.
  if (patch.tableAreaAll !== undefined) form.setFieldValue(['functions', index, 'tableAreaAll'], patch.tableAreaAll);
  if (patch.tableAreaRefs !== undefined) form.setFieldValue(['functions', index, 'tableAreaRefs'], patch.tableAreaRefs);
  if (patch.productionTagAll !== undefined)
    form.setFieldValue(['functions', index, 'productionTagAll'], patch.productionTagAll);
  if (patch.productionTagRefs !== undefined)
    form.setFieldValue(['functions', index, 'productionTagRefs'], patch.productionTagRefs);
}

/**
 * Registers aggregate range values with Ant Design Form without coercing their
 * boolean/array types through an Input.  These values are controlled by the
 * candidate Selects, but Form.List must own their paths so a sibling render
 * cannot discard a successful selection.
 */
function HiddenFormValue({value: _value}: {value?: unknown}) {
  return <span hidden />;
}

function candidateLabel(item: StoreTerminalAreaCandidate | StoreTerminalTagCandidate) {
  return <NameCodeText name={item.name} code={item.code} />;
}

function referenceLabel(reference: StoreTerminalAreaReference | StoreTerminalTagReference) {
  const suffix =
    'areaType' in reference
      ? ` · ${reference.areaType === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA ? '桌台区' : reference.areaType} · ${
          reference.status === 'ENABLED' ? '启用' : reference.status === 'DISABLED' ? '停用' : '作废'
        }`
      : ` · ${reference.status === 'ENABLED' ? '启用' : reference.status === 'DISABLED' ? '停用' : '作废'}`;
  return (
    <span>
      <NameCodeText name={reference.name} code={reference.code} />
      {suffix}
    </span>
  );
}

function CandidateSelect({
  value,
  onChange,
  state,
  loading,
  type,
  queryText,
  onQueryTextChange,
  references,
  cacheKey,
  testIdValue,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  state: TerminalCandidateState<StoreTerminalAreaCandidate> | TerminalCandidateState<StoreTerminalTagCandidate>;
  loading: boolean;
  type: 'area' | 'tag';
  queryText: string;
  onQueryTextChange: (value: string) => void;
  references: readonly (StoreTerminalAreaReference | StoreTerminalTagReference)[];
  cacheKey: string;
  testIdValue: string;
  error?: unknown;
}) {
  const cachedCandidates = useRef(new Map<string, Candidate>());
  const cacheKeyRef = useRef(cacheKey);
  if (cacheKeyRef.current !== cacheKey) {
    cachedCandidates.current.clear();
    cacheKeyRef.current = cacheKey;
  }
  for (const item of state.items) {
    cachedCandidates.current.set(String('areaRef' in item ? item.areaRef : item.tagRef), item);
  }
  const referenceByRef = new Map(
    references.map(item => [String('areaRef' in item ? item.areaRef : item.tagRef), item]),
  );
  const options = state.items.map(item => ({
    value: String('areaRef' in item ? item.areaRef : item.tagRef),
    label: (() => {
      const reference = referenceByRef.get(String('areaRef' in item ? item.areaRef : item.tagRef));
      return reference ? referenceLabel(reference) : candidateLabel(item);
    })(),
  }));
  const known = new Set(options.map(option => option.value));
  const retained = value
    .filter(item => item !== ALL && !known.has(item))
    .map(item => {
      const reference = referenceByRef.get(item);
      const candidate = cachedCandidates.current.get(item);
      return {
        value: item,
        label: reference
          ? referenceLabel(reference)
          : candidate
            ? candidateLabel(candidate)
            : `当前引用（${item}，需重新核对）`,
      };
    });
  return (
    <Select
      mode="multiple"
      showSearch
      optionFilterProp="label"
      value={value}
      options={[{value: ALL, label: type === 'area' ? '全部桌台区' : '全部生产标签'}, ...retained, ...options]}
      loading={loading}
      placeholder={type === 'area' ? '请选择桌台区' : '请选择生产标签'}
      searchValue={queryText}
      filterOption={false}
      onSearch={onQueryTextChange}
      onChange={next => onChange(normalizeCandidateSelection(next))}
      onPopupScroll={event => state.onPopupScroll(event, loading)}
      notFoundContent={
        loading
          ? '候选加载中…'
          : error
            ? '读取失败，请重试。'
            : state.total === 0 && !state.debouncedQueryText
              ? type === 'area'
                ? '请先在“门店桌台与二维码”维护桌台区；若来源页未开通或无权限，请联系管理员。'
                : '请先在“门店商品管理”维护生产标签；若来源页未开通或无权限，请联系管理员。'
              : '暂无匹配项'
      }
      {...testId(testIdValue)}
    />
  );
}

function RangeEditor({
  form,
  index,
  functionKey,
  areaCandidates,
  tagCandidates,
  areasLoading,
  tagsLoading,
  areaQueryText,
  tagQueryText,
  onAreaQueryTextChange,
  onTagQueryTextChange,
  areaCandidateError,
  tagCandidateError,
  onRetryAreaCandidates,
  onRetryTagCandidates,
  areaReferences,
  tagReferences,
  candidateCacheKey,
  functionIdentity,
  onValuesChange,
}: {
  form: FormInstance<StoreTerminalFormValues>;
  index: number;
  functionKey: string;
  areaCandidates: TerminalCandidateState<StoreTerminalAreaCandidate>;
  tagCandidates: TerminalCandidateState<StoreTerminalTagCandidate>;
  areasLoading: boolean;
  tagsLoading: boolean;
  areaQueryText: string;
  tagQueryText: string;
  onAreaQueryTextChange: (value: string) => void;
  onTagQueryTextChange: (value: string) => void;
  areaCandidateError?: unknown;
  tagCandidateError?: unknown;
  onRetryAreaCandidates: () => void;
  onRetryTagCandidates: () => void;
  areaReferences: readonly StoreTerminalAreaReference[];
  tagReferences: readonly StoreTerminalTagReference[];
  candidateCacheKey: string;
  functionIdentity: string;
  onValuesChange: () => void;
}) {
  const allowed = allowedRangesForFunction(functionKey);
  const hasSelectableRanges = allowed.length > 0;
  const watchedSelected = Form.useWatch(['functions', index, 'selectedRangeKeys'], form) as string[] | undefined;
  // Keep the aggregate values subscribed even though the visible controls are
  // CandidateSelects.  The hidden bridges below register the paths without
  // converting booleans/arrays into Input strings.
  const watchedAreaAll = Form.useWatch(['functions', index, 'tableAreaAll'], {
    form,
    preserve: true,
  }) as boolean | undefined;
  const watchedAreaRefs = Form.useWatch(['functions', index, 'tableAreaRefs'], {
    form,
    preserve: true,
  }) as string[] | undefined;
  const watchedTagAll = Form.useWatch(['functions', index, 'productionTagAll'], {
    form,
    preserve: true,
  }) as boolean | undefined;
  const watchedTagRefs = Form.useWatch(['functions', index, 'productionTagRefs'], {
    form,
    preserve: true,
  }) as string[] | undefined;
  // These values are the controlled draft state for the range selectors. Do
  // not replace the subscribed snapshot with a one-off getFieldsValue call:
  // Form.List can publish that call before the nested CandidateSelect write is
  // observable, which makes a successful selection render as the placeholder.
  const selected = Array.isArray(watchedSelected)
    ? watchedSelected.filter(value => typeof value === 'string' && value.length > 0)
    : [];
  const areaAll = Boolean(watchedAreaAll);
  const areaRefs = Array.isArray(watchedAreaRefs)
    ? watchedAreaRefs.filter(value => typeof value === 'string' && value.length > 0)
    : [];
  const tagAll = Boolean(watchedTagAll);
  const tagRefs = Array.isArray(watchedTagRefs)
    ? watchedTagRefs.filter(value => typeof value === 'string' && value.length > 0)
    : [];
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}}>
      {hasSelectableRanges && (
        <>
          <Form.Item name={[index, 'selectedRangeKeys']} label="范围">
            <Checkbox.Group {...testId(storeTerminalTestIds.rangeGroup(functionIdentity))}>
              {allowed.map(key => (
                <Checkbox key={key} value={key} {...testId(storeTerminalTestIds.rangeOption(functionIdentity, key))}>
                  {storeTerminalRangeLabels[key] ?? key}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
          {selected.includes(STORE_TERMINAL_RANGE_KEYS.TABLE_AREA) && (
            <Form.Item label="桌台区">
              <CandidateSelect
                type="area"
                value={areaAll ? [ALL] : areaRefs}
                state={areaCandidates}
                loading={areasLoading}
                queryText={areaQueryText}
                onQueryTextChange={onAreaQueryTextChange}
                references={areaReferences}
                cacheKey={candidateCacheKey}
                testIdValue={storeTerminalTestIds.areaCandidates(functionIdentity)}
                error={areaCandidateError}
                onChange={next => {
                  const all = next.includes(ALL);
                  updateFunctionRange(form, index, {
                    tableAreaAll: all,
                    tableAreaRefs: all ? [] : next,
                  });
                  onValuesChange();
                }}
              />
              {Boolean(areaCandidateError) && (
                <Alert
                  type="error"
                  showIcon
                  title="桌台区读取失败"
                  description="请重试后保留当前选择。"
                  action={
                    <Button
                      size="small"
                      onClick={onRetryAreaCandidates}
                      {...testId(storeTerminalTestIds.areaCandidatesRetry(functionIdentity))}
                    >
                      重试
                    </Button>
                  }
                />
              )}
            </Form.Item>
          )}
        </>
      )}
      <Form.Item name={[index, 'tableAreaAll']} hidden>
        <HiddenFormValue />
      </Form.Item>
      <Form.Item name={[index, 'tableAreaRefs']} hidden>
        <HiddenFormValue />
      </Form.Item>
      <Form.Item name={[index, 'productionTagAll']} hidden>
        <HiddenFormValue />
      </Form.Item>
      <Form.Item name={[index, 'productionTagRefs']} hidden>
        <HiddenFormValue />
      </Form.Item>
      {hasSelectableRanges && selected.includes(STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG) && (
        <Form.Item label="生产标签">
          <CandidateSelect
            type="tag"
            value={tagAll ? [ALL] : tagRefs}
            state={tagCandidates}
            loading={tagsLoading}
            queryText={tagQueryText}
            onQueryTextChange={onTagQueryTextChange}
            references={tagReferences}
            cacheKey={candidateCacheKey}
            testIdValue={storeTerminalTestIds.tagCandidates(functionIdentity)}
            error={tagCandidateError}
            onChange={next => {
              const all = next.includes(ALL);
              updateFunctionRange(form, index, {
                productionTagAll: all,
                productionTagRefs: all ? [] : next,
              });
              onValuesChange();
            }}
          />
          {Boolean(tagCandidateError) && (
            <Alert
              type="error"
              showIcon
              title="生产标签读取失败"
              description="请重试后保留当前选择。"
              action={
                <Button
                  size="small"
                  onClick={onRetryTagCandidates}
                  {...testId(storeTerminalTestIds.tagCandidatesRetry(functionIdentity))}
                >
                  重试
                </Button>
              }
            />
          )}
        </Form.Item>
      )}
      {hasSelectableRanges &&
        selected.some(
          key =>
            !new Set<string>([STORE_TERMINAL_RANGE_KEYS.TABLE_AREA, STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG]).has(key),
        ) && <Typography.Text type="secondary">已选择的其他范围按系统规则生效，无需再指定对象。</Typography.Text>}
    </Space>
  );
}

export type TerminalFunctionEditorProps = {
  form: FormInstance<StoreTerminalFormValues>;
  index: number;
  deviceType: string;
  areaCandidates: TerminalCandidateState<StoreTerminalAreaCandidate>;
  tagCandidates: TerminalCandidateState<StoreTerminalTagCandidate>;
  areasLoading: boolean;
  tagsLoading: boolean;
  areaQueryText: string;
  tagQueryText: string;
  onAreaQueryTextChange: (value: string) => void;
  onTagQueryTextChange: (value: string) => void;
  areaCandidateError?: unknown;
  tagCandidateError?: unknown;
  onRetryAreaCandidates: () => void;
  onRetryTagCandidates: () => void;
  areaReferences: readonly StoreTerminalAreaReference[];
  tagReferences: readonly StoreTerminalTagReference[];
  candidateCacheKey: string;
  printerValues: readonly TerminalPrinterForm[];
  functionOrdinal?: number;
  functionIdentity: string;
  onRemove: () => void;
  onValuesChange: () => void;
};

export function TerminalFunctionEditor({
  form,
  index,
  deviceType,
  areaCandidates,
  tagCandidates,
  areasLoading,
  tagsLoading,
  areaQueryText,
  tagQueryText,
  onAreaQueryTextChange,
  onTagQueryTextChange,
  areaCandidateError,
  tagCandidateError,
  onRetryAreaCandidates,
  onRetryTagCandidates,
  areaReferences,
  tagReferences,
  candidateCacheKey,
  printerValues,
  functionOrdinal,
  functionIdentity,
  onRemove,
  onValuesChange,
}: TerminalFunctionEditorProps) {
  const watchedFunctionKey = Form.useWatch(['functions', index, 'functionKey'], form) as string | undefined;
  // Form.List can mount this editor in the same render that adds the row. In
  // that render useWatch may not have observed the registered field yet;
  // resolve the current row from the form store so the editor does not show a
  // blank function or hide its ranges/scenes until another interaction.
  const functionKey =
    (form.getFieldValue(['functions', index, 'functionKey']) as string | undefined) ?? watchedFunctionKey ?? '';
  const functionSupported = functionOptionsForDeviceType(deviceType).some(value => value.key === functionKey);
  const scenes = scenesForFunction(functionKey as StoreTerminalFunctionKey);
  const knownPrinterKeys = printerValues
    .map(printer => terminalPrinterIdentity(printer))
    .filter(
      (identity): identity is string =>
        typeof identity === 'string' && identity.length > 0 && identity === identity.trim(),
    );
  useEffect(() => {
    const rawFunction = form.getFieldValue(['functions', index]) as
      (Partial<StoreTerminalFormValues['functions'][number]> & {scenes?: Record<string, unknown>}) | undefined;
    const current = normalizeTerminalFunctionForm(rawFunction);
    if (!current) return;
    const staleSceneKeys = scenes
      .filter(scene => {
        const value = current.scenes[scene.key];
        const display = scenePrinterKeysForDisplay(value?.printerKeys);
        const rawValue = rawFunction?.scenes?.[scene.key];
        return (
          value &&
          !value.selected &&
          !terminalSceneDraftHasInvalidCollections(
            rawValue,
            STORE_TERMINAL_ORDER_TYPES.map(orderType => orderType.key),
            knownPrinterKeys,
          ) &&
          ((Array.isArray(value.orderTypes) && value.orderTypes.length > 0) ||
            (display.valid && display.keys.length > 0))
        );
      })
      .map(scene => scene.key);
    if (!staleSceneKeys.length) return;
    const nextScenes = {...current.scenes};
    for (const sceneKey of staleSceneKeys) {
      nextScenes[sceneKey] = clearTerminalSceneConfiguration(current, sceneKey).scenes[sceneKey];
    }
    form.setFieldValue(['functions', index], {...current, scenes: nextScenes});
    onValuesChange();
  }, [form, functionKey, index, knownPrinterKeys, onValuesChange, scenes]);

  const functionTitle = `${storeTerminalFunctionLabels[functionKey] ?? '功能'}${
    storeTerminalFunctionMaxInstances(functionKey) === null && functionOrdinal ? ` ${functionOrdinal}` : ''
  }`;

  return (
    <Card
      size="small"
      type="inner"
      title={functionTitle}
      extra={
        <Button
          danger
          type="link"
          onClick={() => {
            onRemove();
            onValuesChange();
          }}
          {...testId(storeTerminalTestIds.functionRemove(functionIdentity))}
        >
          移除
        </Button>
      }
      {...testId(storeTerminalTestIds.function(functionIdentity))}
    >
      <Form.Item name={[index, 'ref']} hidden>
        <Input />
      </Form.Item>
      <Form.Item name={[index, 'clientKey']} hidden>
        <Input />
      </Form.Item>
      <Form.Item name={[index, 'functionKey']} hidden>
        <Input />
      </Form.Item>
      <Form.Item label="功能" required>
        <Typography.Text strong {...testId(storeTerminalTestIds.functionType(functionIdentity))}>
          {storeTerminalFunctionLabels[functionKey] ?? functionKey}
        </Typography.Text>
      </Form.Item>
      {!functionSupported && functionKey && (
        <Alert type="warning" showIcon message="当前设备类型不支持此功能，请移除此功能后再保存。" />
      )}
      <RangeEditor
        form={form}
        index={index}
        functionKey={functionKey}
        areaCandidates={areaCandidates}
        tagCandidates={tagCandidates}
        areasLoading={areasLoading}
        tagsLoading={tagsLoading}
        areaCandidateError={areaCandidateError}
        tagCandidateError={tagCandidateError}
        onRetryAreaCandidates={onRetryAreaCandidates}
        onRetryTagCandidates={onRetryTagCandidates}
        areaReferences={areaReferences}
        tagReferences={tagReferences}
        candidateCacheKey={candidateCacheKey}
        functionIdentity={functionIdentity}
        onValuesChange={onValuesChange}
        areaQueryText={areaQueryText}
        tagQueryText={tagQueryText}
        onAreaQueryTextChange={onAreaQueryTextChange}
        onTagQueryTextChange={onTagQueryTextChange}
      />
      {scenes.length > 0 && (
        <>
          <Form.Item label="选择打印场景" {...testId(storeTerminalTestIds.scenePicker(functionIdentity))}>
            <Space wrap>
              {scenes.map(scene => (
                <Form.Item
                  key={scene.key}
                  name={[index, 'scenes', scene.key, 'selected']}
                  valuePropName="checked"
                  noStyle
                >
                  <Checkbox {...testId(storeTerminalTestIds.sceneToggle(functionIdentity, scene.key))}>
                    {scene.label}
                  </Checkbox>
                </Form.Item>
              ))}
            </Space>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previous, next) => previous.functions?.[index]?.scenes !== next.functions?.[index]?.scenes}
          >
            {() => {
              const currentScenes = form.getFieldValue(['functions', index, 'scenes']) as
                Record<string, TerminalSceneForm> | undefined;
              const selectedScenes = scenes.filter(scene => currentScenes?.[scene.key]?.selected === true);
              return selectedScenes.length === 0 ? (
                <Typography.Text type="secondary">
                  未选择打印场景；如需配置订单类型和打印机，请先勾选场景。
                </Typography.Text>
              ) : (
                selectedScenes.map(scene => (
                  <TerminalSceneEditor
                    key={scene.key}
                    form={form}
                    index={index}
                    functionIdentity={functionIdentity}
                    scene={scene}
                    printerValues={printerValues}
                    showToggle={false}
                  />
                ))
              );
            }}
          </Form.Item>
        </>
      )}
    </Card>
  );
}
