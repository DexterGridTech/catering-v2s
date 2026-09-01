import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Flex,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {ProList} from '@ant-design/pro-components';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState, type ReactNode} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogOrderOptionConfig} from '../model/catalogModel';
import {catalogCentsToYuan, catalogYuanToCents} from '../model/catalogModel';
import {buildAdditivePreparationEffect} from '../model/catalogItemEditorDraftAdapters';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {EmptySection, OrderOptionConfigurationsReadOnly} from './CatalogItemReadOnlyPresenters';

function money(value: number | null) {
  return value === null ? '—' : `¥${(value / 100).toFixed(2)}`;
}

/** Owns option-definition selection, option configuration and additive preparation effects. */
export function CatalogItemOrderOptionsEditor({
  locked,
  values,
  readOnlyValues,
  scopeRef,
  brandRef,
  onChange,
  onDirty,
  onOpenOrderOptionLibrary,
  lockedNotice,
}: {
  locked: boolean;
  values: CatalogOrderOptionConfig[];
  readOnlyValues: CatalogOrderOptionConfig[];
  scopeRef?: string;
  brandRef?: string;
  onChange: (next: CatalogOrderOptionConfig[]) => void;
  onDirty: () => void;
  onOpenOrderOptionLibrary: () => void;
  lockedNotice: ReactNode;
}) {
  const [selectedDefinitionRef, setSelectedDefinitionRef] = useState<string>();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDefinitionRefs, setPendingDefinitionRefs] = useState<string[]>([]);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogOrderOptionDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const candidateRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogOrderOptionDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? ''), candidateUsage: 'ITEM_ASSIGNMENT'}, headers},
      ),
    [headers, scopeRef],
  );
  const query = operationsRtk.useListOperationsCatalogOrderOptionDefinitionsQuery(request, {skip: !scopeRef || locked});
  const candidateQuery = operationsRtk.useListOperationsCatalogOrderOptionDefinitionsQuery(candidateRequest, {
    skip: !scopeRef || locked,
  });
  if (locked)
    return (
      <Space direction="vertical" style={{display: 'flex'}}>
        {lockedNotice}
        <OrderOptionConfigurationsReadOnly values={readOnlyValues} />
      </Space>
    );
  const candidateDefinitions = candidateQuery.currentData?.data.definitions ?? [];
  const availableDefinitions = candidateDefinitions.filter(
    definition => !values.some(value => value.definitionRef === definition.definitionRef),
  );
  const normalize = (next: CatalogOrderOptionConfig[]) =>
    next.map((config, configIndex) => ({
      ...config,
      displayOrder: configIndex,
      values: config.values.map(value => ({
        ...value,
        preparationEffect: value.preparationEffect
          ? {
              ...value.preparationEffect,
              definitionValueRef: value.definitionValueRef,
              optionGroupDisplayOrder: configIndex,
              optionValueDisplayOrder: value.displayOrder,
            }
          : null,
      })),
    }));
  const commit = (next: CatalogOrderOptionConfig[]) => {
    onChange(normalize(next));
    onDirty();
  };
  const activeDefinitionRef = values.some(config => config.definitionRef === selectedDefinitionRef)
    ? selectedDefinitionRef
    : values[0]?.definitionRef;
  const activeConfig = values.find(config => config.definitionRef === activeDefinitionRef);
  const add = () => {
    const chosen = new Set(pendingDefinitionRefs);
    const additions = candidateDefinitions
      .filter(
        definition =>
          chosen.has(definition.definitionRef) &&
          !values.some(value => value.definitionRef === definition.definitionRef),
      )
      .map(definition => ({
        definitionRef: definition.definitionRef,
        name: definition.name,
        selectionMode: definition.selectionMode,
        displayOrder: values.length,
        required: false,
        minSelectionCount: definition.selectionMode === 'MULTIPLE' ? 0 : null,
        maxSelectionCount: null,
        values: definition.values.map(value => ({
          definitionValueRef: value.valueRef,
          name: value.name,
          displayOrder: value.displayOrder,
          defaultValue: false,
          extraPrice: null,
          bomVersion: definition.version,
          preparationEffect: null,
        })),
      }));
    if (additions.length) {
      commit([...values, ...additions]);
      setSelectedDefinitionRef(additions[0].definitionRef);
    }
    setAddOpen(false);
  };
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const remove = (definitionRef: string) => {
    const index = values.findIndex(config => config.definitionRef === definitionRef);
    const next = values.filter(config => config.definitionRef !== definitionRef);
    if (activeDefinitionRef === definitionRef)
      setSelectedDefinitionRef(next[Math.min(index, next.length - 1)]?.definitionRef);
    commit(next);
  };
  const updateActive = (patch: Partial<CatalogOrderOptionConfig>) =>
    commit(
      values.map(config => (config.definitionRef === activeConfig?.definitionRef ? {...config, ...patch} : config)),
    );
  const updateValue = (valueRef: string, patch: Partial<CatalogOrderOptionConfig['values'][number]>) =>
    updateActive({
      values: (activeConfig?.values ?? []).map(value =>
        value.definitionValueRef === valueRef ? {...value, ...patch} : value,
      ),
    });
  return (
    <Space direction="vertical" style={{display: 'flex'}} size="middle">
      <Flex align="center" gap="small" wrap style={{width: '100%'}}>
        <Button
          type="primary"
          onClick={() => {
            setPendingDefinitionRefs([]);
            setAddOpen(true);
          }}
          disabled={!availableDefinitions.length}
          loading={query.isFetching || candidateQuery.isFetching}
          {...testId(catalogTestIds.static.itemOrderOptionLibraryAdd)}
        >
          添加点单选项
        </Button>
        <Button
          size="small"
          onClick={onOpenOrderOptionLibrary}
          style={{marginInlineStart: 'auto'}}
          {...testId(catalogTestIds.static.itemOrderOptionLibraryManage)}
        >
          维护点单选项
        </Button>
      </Flex>
      <Modal
        title="添加点单选项"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={add}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
        {...testId(catalogTestIds.static.itemOrderOptionLibraryAddModal)}
      >
        {availableDefinitions.length ? (
          <Checkbox.Group
            value={pendingDefinitionRefs}
            onChange={refs => setPendingDefinitionRefs(refs.map(String))}
            style={{display: 'flex', flexDirection: 'column', gap: 12}}
            options={availableDefinitions.map(definition => ({
              label: definition.name,
              value: definition.definitionRef,
            }))}
          />
        ) : (
          <EmptySection text="没有可添加的点单选项。" />
        )}
      </Modal>
      {values.length === 0 ? (
        <EmptySection text="请先从点单选项库添加点单选项。" />
      ) : (
        <Row gutter={[12, 12]} align="top">
          <Col xs={24} lg={7}>
            <Card size="small" title="已添加的点单选项">
              <ProList<CatalogOrderOptionConfig>
                rowKey="definitionRef"
                dataSource={values}
                cardProps={false}
                search={false}
                toolBarRender={false}
                pagination={false}
                split
                onItem={config => ({onClick: () => setSelectedDefinitionRef(config.definitionRef)})}
                metas={{
                  title: {
                    dataIndex: 'name',
                    render: (_, config) => (
                      <Button
                        type={config.definitionRef === activeDefinitionRef ? 'link' : 'text'}
                        style={{paddingInline: 0}}
                      >
                        {config.name}
                      </Button>
                    ),
                  },
                  actions: {
                    dataIndex: 'definitionRef',
                    render: (_, config, index) => (
                      <Space size={0}>
                        <Button
                          type="link"
                          disabled={index === 0}
                          onClick={event => {
                            event.stopPropagation();
                            move(index, -1);
                          }}
                        >
                          上移
                        </Button>
                        <Button
                          type="link"
                          disabled={index === values.length - 1}
                          onClick={event => {
                            event.stopPropagation();
                            move(index, 1);
                          }}
                        >
                          下移
                        </Button>
                        <Button
                          type="link"
                          danger
                          onClick={event => {
                            event.stopPropagation();
                            remove(config.definitionRef);
                          }}
                        >
                          移除
                        </Button>
                      </Space>
                    ),
                  },
                }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" title="本商品设置">
              {activeConfig && (
                <Space direction="vertical" style={{display: 'flex'}} size="middle">
                  <Space wrap>
                    <Typography.Text strong>{activeConfig.name}</Typography.Text>
                    <Tag>
                      {activeConfig.selectionMode === 'SINGLE'
                        ? '单选'
                        : `多选${activeConfig.maxSelectionCount === 1 ? '（最多 1 项）' : ''}`}
                    </Tag>
                    <Switch
                      checked={activeConfig.required}
                      checkedChildren="必选"
                      unCheckedChildren="可不选"
                      onChange={required => updateActive({required})}
                    />
                  </Space>
                  {activeConfig.selectionMode === 'MULTIPLE' && (
                    <Space wrap>
                      <Typography.Text>最少可选</Typography.Text>
                      <InputNumber
                        min={0}
                        value={activeConfig.minSelectionCount}
                        onChange={minSelectionCount => updateActive({minSelectionCount})}
                      />
                      <Typography.Text>最多可选</Typography.Text>
                      <InputNumber
                        min={1}
                        value={activeConfig.maxSelectionCount}
                        onChange={maxSelectionCount => updateActive({maxSelectionCount})}
                      />
                    </Space>
                  )}
                  <Divider style={{margin: 0}} />
                  {activeConfig.values.map(value => (
                    <Card key={value.definitionValueRef} size="small" title={value.name}>
                      <Space direction="vertical" style={{display: 'flex'}} size="small">
                        <Space wrap>
                          <Switch
                            checked={value.defaultValue}
                            checkedChildren="默认"
                            unCheckedChildren="非默认"
                            onChange={defaultValue => updateValue(value.definitionValueRef, {defaultValue})}
                          />
                          <Typography.Text>加价（元）</Typography.Text>
                          <InputNumber
                            min={0}
                            precision={2}
                            prefix="¥"
                            value={catalogCentsToYuan(value.extraPrice)}
                            onChange={extraPrice =>
                              updateValue(value.definitionValueRef, {extraPrice: catalogYuanToCents(extraPrice)})
                            }
                          />
                        </Space>
                        <Divider style={{margin: '4px 0'}} />
                        <Typography.Text strong>制作变化（可选）</Typography.Text>
                        <Typography.Text type="secondary">
                          这些变化会添加到商品或规格的制作信息中；多项说明会按点单选项顺序呈现。
                        </Typography.Text>
                        <InputNumber
                          min={0}
                          precision={0}
                          addonBefore="增加制作时长（秒）"
                          value={value.preparationEffect?.preparationSecondsDelta ?? undefined}
                          placeholder="填写零或正整数"
                          onChange={preparationSecondsDelta =>
                            updateValue(value.definitionValueRef, {
                              preparationEffect: buildAdditivePreparationEffect(
                                {
                                  definitionValueRef: value.definitionValueRef,
                                  optionGroupDisplayOrder: activeConfig.displayOrder,
                                  optionValueDisplayOrder: value.displayOrder,
                                },
                                value.preparationEffect,
                                {preparationSecondsDelta: preparationSecondsDelta ?? null},
                              ),
                            })
                          }
                          {...testId(
                            catalogTestIdControls.edit.dynamic(
                              'option-preparation',
                              'seconds',
                              value.definitionValueRef,
                            ),
                          )}
                        />
                        <Typography.Text strong>追加制作说明</Typography.Text>
                        <Input.TextArea
                          maxLength={1000}
                          showCount
                          value={value.preparationEffect?.instruction ?? ''}
                          placeholder="例如：最后加冰"
                          onChange={event =>
                            updateValue(value.definitionValueRef, {
                              preparationEffect: buildAdditivePreparationEffect(
                                {
                                  definitionValueRef: value.definitionValueRef,
                                  optionGroupDisplayOrder: activeConfig.displayOrder,
                                  optionValueDisplayOrder: value.displayOrder,
                                },
                                value.preparationEffect,
                                {instruction: event.target.value || null},
                              ),
                            })
                          }
                          {...testId(
                            catalogTestIdControls.edit.dynamic(
                              'option-preparation',
                              'instruction',
                              value.definitionValueRef,
                            ),
                          )}
                        />
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={7}>
            <Card size="small" title="顾客端显示效果">
              <Space direction="vertical" style={{display: 'flex'}} size="small">
                {values.map(config => (
                  <Card
                    key={config.definitionRef}
                    size="small"
                    title={
                      <Space>
                        <Typography.Text strong>{config.name}</Typography.Text>
                        <Tag>{config.selectionMode === 'SINGLE' ? '单选' : '多选'}</Tag>
                      </Space>
                    }
                  >
                    <Typography.Text type="secondary">
                      {config.selectionMode === 'SINGLE'
                        ? '请选择一项'
                        : `可选 ${config.minSelectionCount ?? 0} 至 ${config.maxSelectionCount ?? config.values.length} 项`}
                    </Typography.Text>
                    <Space wrap size={[4, 4]} style={{marginTop: 8}}>
                      {config.values.map(value => (
                        <Space key={value.definitionValueRef} wrap>
                          <Tag color={value.defaultValue ? 'blue' : undefined}>
                            {value.name}
                            {value.defaultValue ? '（默认）' : ''}
                          </Tag>
                          {value.extraPrice !== null && (
                            <Typography.Text type="secondary">加价 {money(value.extraPrice)}</Typography.Text>
                          )}
                          {value.preparationEffect && <Tag color="green">有制作变化</Tag>}
                        </Space>
                      ))}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  );
}
