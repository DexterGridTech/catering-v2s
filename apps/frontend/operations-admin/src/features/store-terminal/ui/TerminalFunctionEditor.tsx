import {Alert, Button, Card, Checkbox, Divider, Form, Modal, Select, Space, Typography} from 'antd';
import type {FormInstance} from 'antd';
import {useRef} from 'react';
import {NameCodeText, testId, type CursorCandidatesState} from '@catering-v2s/admin-ui-foundation';
import type {
  StoreTerminalAreaCandidate,
  StoreTerminalAreaReference,
  StoreTerminalTagCandidate,
  StoreTerminalTagReference,
} from '../../../app/api/generated/operations-edge';
import {
  allowedRangesForFunction,
  clearTerminalSceneConfiguration,
  functionOptionsForDeviceType,
  scenesForFunction,
  storeTerminalFunctionLabels,
  storeTerminalRangeLabels,
  type StoreTerminalFormValues,
  type TerminalSceneForm,
  replaceTerminalFunctionConfiguration,
} from '../model/storeTerminalModel';
import {TerminalSceneEditor} from './TerminalSceneEditor';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

export type TerminalCandidateState<T> = Pick<
  CursorCandidatesState<T>,
  'items' | 'onPopupScroll' | 'nextCursor' | 'total' | 'debouncedQueryText'
>;

const ALL = '__ALL__';
type Candidate = StoreTerminalAreaCandidate | StoreTerminalTagCandidate;

function candidateLabel(item: StoreTerminalAreaCandidate | StoreTerminalTagCandidate) {
  return <NameCodeText name={item.name} code={item.code} />;
}

function referenceLabel(reference: StoreTerminalAreaReference | StoreTerminalTagReference) {
  const suffix =
    'areaType' in reference
      ? ` · ${reference.areaType === 'TABLE_AREA' ? '桌台区' : reference.areaType} · ${
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
      onChange={next => onChange(next.includes(ALL) ? [ALL] : next)}
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
  const selected = (Form.useWatch(['functions', index, 'selectedRangeKeys'], form) as string[] | undefined) ?? [];
  const areaAll = Boolean(Form.useWatch(['functions', index, 'tableAreaAll'], form));
  const areaRefs = (Form.useWatch(['functions', index, 'tableAreaRefs'], form) as string[] | undefined) ?? [];
  const tagAll = Boolean(Form.useWatch(['functions', index, 'productionTagAll'], form));
  const tagRefs = (Form.useWatch(['functions', index, 'productionTagRefs'], form) as string[] | undefined) ?? [];
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}}>
      <Form.Item name={['functions', index, 'selectedRangeKeys']} label="范围">
        <Checkbox.Group {...testId(storeTerminalTestIds.rangeGroup(functionIdentity))}>
          {allowed.map(key => (
            <Checkbox key={key} value={key} {...testId(storeTerminalTestIds.rangeOption(functionIdentity, key))}>
              {storeTerminalRangeLabels[key] ?? key}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Form.Item>
      {selected.includes('TABLE_AREA') && (
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
              form.setFieldValue(['functions', index, 'tableAreaAll'], all);
              form.setFieldValue(['functions', index, 'tableAreaRefs'], all ? [] : next);
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
      {selected.includes('PRODUCTION_TAG') && (
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
              form.setFieldValue(['functions', index, 'productionTagAll'], all);
              form.setFieldValue(['functions', index, 'productionTagRefs'], all ? [] : next);
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
      {selected.some(key => !['TABLE_AREA', 'PRODUCTION_TAG'].includes(key)) && (
        <Typography.Text type="secondary">已选择的其他范围按系统规则生效，无需再指定对象。</Typography.Text>
      )}
    </Space>
  );
}

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
  functionOrdinal,
  functionIdentity,
  onRemove,
  onValuesChange,
}: {
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
  functionOrdinal?: number;
  functionIdentity: string;
  onRemove: () => void;
  onValuesChange: () => void;
}) {
  const functionKey = (Form.useWatch(['functions', index, 'functionKey'], form) as string | undefined) ?? '';
  const printerValues = (Form.useWatch('printers', form) as StoreTerminalFormValues['printers'] | undefined) ?? [];
  const functionSupported = functionOptionsForDeviceType(deviceType).some(value => value.key === functionKey);
  const scenes = scenesForFunction(functionKey);
  const sceneValues =
    (Form.useWatch(['functions', index, 'scenes'], form) as Record<string, TerminalSceneForm> | undefined) ?? {};
  const selectedScenes = scenes.filter(scene => sceneValues[scene.key]?.selected === true);

  const replaceScenes = (nextFunctionKey: string) => {
    const current = form.getFieldValue(['functions', index]) as StoreTerminalFormValues['functions'][number];
    form.setFieldValue(['functions', index], replaceTerminalFunctionConfiguration(current, nextFunctionKey));
    onValuesChange();
  };

  const functionTitle = `${storeTerminalFunctionLabels[functionKey] ?? '功能'}${
    functionKey === 'KITCHEN_PRINT' && functionOrdinal ? ` ${functionOrdinal}` : ''
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
      <Form.Item label="功能" required>
        <Select
          value={functionKey || undefined}
          options={functionOptionsForDeviceType(deviceType, functionKey).map(value => ({
            value: value.key,
            label: value.label,
          }))}
          onChange={(nextFunctionKey: string) => {
            const currentFunction = form.getFieldValue(['functions', index]) as
              StoreTerminalFormValues['functions'][number] | undefined;
            const currentScenes = form.getFieldValue(['functions', index, 'scenes']) as
              Record<string, TerminalSceneForm> | undefined;
            const hasDraft =
              Object.values(currentScenes ?? {}).some(
                scene => scene.orderTypes.length > 0 || scene.printerKeys.length > 0,
              ) ||
              Boolean(
                currentFunction &&
                (currentFunction.selectedRangeKeys.length > 0 ||
                  currentFunction.tableAreaRefs.length > 0 ||
                  currentFunction.productionTagRefs.length > 0),
              );
            if (!hasDraft) {
              replaceScenes(nextFunctionKey);
              return;
            }
            Modal.confirm({
              title: '切换功能并清空当前场景配置？',
              content: '当前功能已有订单类型或打印机绑定，切换后这些不适用的场景配置将被清空。',
              okText: '确认切换',
              cancelText: '取消',
              okButtonProps: {...testId(storeTerminalTestIds.functionChangeConfirm(functionIdentity))},
              cancelButtonProps: {...testId(storeTerminalTestIds.functionChangeCancel(functionIdentity))},
              onOk: () => replaceScenes(nextFunctionKey),
            });
          }}
          {...testId(storeTerminalTestIds.functionSelect(functionIdentity))}
        />
      </Form.Item>
      {!functionSupported && functionKey && (
        <Alert type="warning" showIcon message="当前设备类型不支持此功能，请移除或更换设备类型后再保存。" />
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
      <Divider>打印场景</Divider>
      <Form.Item label="选择打印场景" {...testId(storeTerminalTestIds.scenePicker(functionIdentity))}>
        <Space wrap>
          {scenes.map(scene => (
            <Form.Item
              key={scene.key}
              name={['functions', index, 'scenes', scene.key, 'selected']}
              valuePropName="checked"
              getValueFromEvent={(event: {target: {checked: boolean}}) => {
                if (!event.target.checked) {
                  const current = form.getFieldValue(['functions', index]) as
                    StoreTerminalFormValues['functions'][number] | undefined;
                  if (current) {
                    form.setFieldValue(['functions', index], clearTerminalSceneConfiguration(current, scene.key));
                    onValuesChange();
                  }
                }
                return event.target.checked;
              }}
              noStyle
            >
              <Checkbox {...testId(storeTerminalTestIds.sceneToggle(functionIdentity, scene.key))}>
                {scene.label}
              </Checkbox>
            </Form.Item>
          ))}
        </Space>
      </Form.Item>
      {selectedScenes.length === 0 ? (
        <Typography.Text type="secondary">未选择打印场景；如需配置订单类型和打印机，请先勾选场景。</Typography.Text>
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
      )}
    </Card>
  );
}
