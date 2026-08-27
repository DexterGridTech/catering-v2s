import {Alert, Button, Card, Col, Input, InputNumber, Modal, Row, Select, Space, Switch, Typography} from 'antd';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {NameCodeText, testId, useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import type {CatalogCompositeComponent, CatalogDetail} from '../model/catalogModel';
import {catalogCentsToYuan, catalogYuanToCents, decodeItems} from '../model/catalogModel';
import {
  draftUuid,
  type CatalogCompositeComponentDraft,
  type CatalogCompositeGroupDraft,
} from '../model/catalogItemEditorDraftAdapters';
import {catalogEnumLabel, catalogEnumOptions} from '../model/catalogManifestLabels';
import type {CatalogCandidateRow, CatalogFieldRuntimeContext} from '../model/catalogFieldRuntime';
import {CatalogDescriptorPicker} from './CatalogDescriptorPicker';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {CompositeGroupsReadOnly, EmptySection} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionEditor, CatalogFactSectionView} from './CatalogFactSectionBoundary';
import {catalogBusinessName} from './catalogBusinessName';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';

function descriptorString(value: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function descriptorRow(value: CatalogCandidateRow | CatalogCandidateRow[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type CatalogItemCompositeEditorProps = {
  mode: 'view' | 'edit';
  manifest?: CatalogManifest;
  shapeKey: string;
  values: CatalogCompositeGroupDraft[];
  readOnlyValues: CatalogDetail['compositeGroups'];
  lockNotice?: ReactNode;
  onChange: (next: CatalogCompositeGroupDraft[]) => void;
  onDirty: () => void;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  currentItemCode?: string;
  version: number;
  createDraftRowId: (prefix: string) => string;
};

export function CatalogItemCompositeEditor(props: CatalogItemCompositeEditorProps) {
  if (props.mode === 'view') {
    return (
      <CatalogFactSectionView section="composite-content">
        <Space direction="vertical" style={{display: 'flex'}}>
          {props.lockNotice}
          <CompositeGroupsReadOnly values={props.readOnlyValues} />
        </Space>
      </CatalogFactSectionView>
    );
  }
  return (
    <CatalogFactSectionEditor section="composite-content">
      <CompositeGroupsEditor {...props} />
    </CatalogFactSectionEditor>
  );
}

function CompositeCandidatePicker({
  manifest,
  value,
  currentItemCode,
  queryContext,
  brandRef,
  onSelect,
  testIdValue,
}: {
  manifest?: CatalogManifest;
  value: {name: string; code: string};
  currentItemCode?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  onSelect: (item: {itemCode: string; itemName: string; itemRef: CatalogCompositeComponent['itemRef']}) => void;
  testIdValue: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        block
        style={{textAlign: 'left', height: 'auto', minHeight: 32, whiteSpace: 'normal'}}
        onClick={() => setOpen(true)}
        {...testId(testIdValue)}
      >
        {value.name ? catalogBusinessName(value.name, value.code, '商品名称暂时无法读取') : '选择商品'}
      </Button>
      {open ? (
        <CompositeCandidateSelectionModal
          manifest={manifest}
          currentItemCode={currentItemCode}
          queryContext={queryContext}
          brandRef={brandRef}
          onSelect={item => {
            onSelect(item);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          testIdValue={testIdValue}
        />
      ) : null}
    </>
  );
}

function CompositeCandidateSelectionModal({
  manifest,
  currentItemCode,
  queryContext,
  brandRef,
  onSelect,
  onCancel,
  testIdValue,
}: Omit<Parameters<typeof CompositeCandidatePicker>[0], 'value'> & {onCancel: () => void}) {
  const [keyword, setKeyword] = useState('');
  const candidateState = useCursorCandidates<ReturnType<typeof decodeItems>['items'][number]>({
    queryText: keyword,
    resetKey: `composite-candidate|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}`,
    pageSize: 20,
    keyOf: item => item.itemRef,
  });
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const itemRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItems(
        {},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(candidateState.debouncedQueryText ? {keyword: candidateState.debouncedQueryText} : {}),
            ...(candidateState.cursor ? {cursor: candidateState.cursor} : {}),
            candidateUsage: 'COMPOSITE_COMPONENT',
            excludeItemCode: currentItemCode,
            pageSize: candidateState.pageSize,
          },
          headers,
        },
      ),
    [
      candidateState.cursor,
      candidateState.debouncedQueryText,
      candidateState.pageSize,
      currentItemCode,
      headers,
      queryContext.scopeRef,
    ],
  );
  const itemsQuery = operationsRtk.useGetOperationsCatalogItemsQuery(itemRequest, {skip: !open});
  const page = decodeItems(itemsQuery.currentData);
  const acceptCandidatePage = candidateState.acceptPage;
  const candidatePageSize = candidateState.pageSize;
  useEffect(() => {
    if (!itemsQuery.currentData) return;
    acceptCandidatePage(page.items, {
      pageSize: candidatePageSize,
      total: page.total,
      nextCursor: page.cursor,
    });
  }, [acceptCandidatePage, candidatePageSize, itemsQuery.currentData, page.cursor, page.items, page.total]);
  const selectableItems = candidateState.items;
  return (
    <Modal open title="选择套餐内容" width={720} footer={null} onCancel={onCancel}>
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <Typography.Text type="secondary">先选择商品；如该商品有规格，可在下一步选择规格。</Typography.Text>
        <Input.Search
          autoFocus
          allowClear
          placeholder="按商品名称或编码搜索"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          loading={itemsQuery.isLoading || itemsQuery.isFetching}
        />
        {itemsQuery.isError ? <Alert type="error" showIcon message="可选商品暂时无法加载，请稍后重试。" /> : null}
        {!itemsQuery.isError && selectableItems.length === 0 ? (
          <Typography.Text type="secondary">暂无可选择的商品</Typography.Text>
        ) : (
          <Space direction="vertical" size={4} style={{display: 'flex'}}>
            {selectableItems.map(item => (
              <Button
                key={item.itemRef}
                block
                style={{height: 'auto', minHeight: 48, textAlign: 'left', whiteSpace: 'normal'}}
                onClick={() => {
                  onSelect({itemCode: item.code, itemName: item.name, itemRef: item.itemRef});
                }}
                {...testId(catalogTestIdControls.edit.related(testIdValue, `item-${item.code}`))}
              >
                <NameCodeText
                  name={catalogBusinessName(item.name, item.code, '商品名称暂时无法读取')}
                  code={item.code}
                />
                <Typography.Text type="secondary" style={{display: 'block', fontSize: 12}}>
                  {catalogEnumLabel(manifest, 'shapeKey', item.shapeKey)}
                </Typography.Text>
              </Button>
            ))}
          </Space>
        )}
        {candidateState.nextCursor ? (
          <Button
            onClick={() => candidateState.loadNext(itemsQuery.isFetching)}
            loading={itemsQuery.isFetching}
            {...testId(catalogTestIdControls.edit.related(testIdValue, 'next'))}
          >
            继续加载商品
          </Button>
        ) : null}
      </Space>
    </Modal>
  );
}

function CompositeSkuDescriptorPicker({
  manifest,
  shapeKey,
  value,
  skuName,
  itemCode,
  queryContext,
  brandRef,
  version,
  testIdValue,
  onChange,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  value: string;
  skuName?: string | null;
  itemCode: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  version: number;
  testIdValue: string;
  onChange: (value: string, skuCode?: string, skuName?: string) => void;
}) {
  const context = useMemo<CatalogFieldRuntimeContext>(
    () => ({
      scope: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), brandRef},
      readField: () => itemCode,
      readSection: () => [],
      sectionRevision: () => `${version}:${itemCode}`,
    }),
    [brandRef, itemCode, queryContext.scopeRef, version],
  );
  return (
    <CatalogDescriptorPicker
      manifest={manifest}
      shapeKey={shapeKey}
      fieldKey="compositeComponentSku"
      value={value}
      selectedLabel={skuName ? catalogBusinessName(skuName, undefined, '规格名称暂时无法读取') : undefined}
      context={context}
      disabled={!itemCode}
      disabledMessage={!itemCode ? '请先选择组件商品，再选择其规格。' : undefined}
      testIdValue={testIdValue}
      onChange={(next, rawRow) => {
        const row = descriptorRow(rawRow);
        onChange(
          descriptorString(next),
          typeof row?.skuCode === 'string' ? row.skuCode : undefined,
          typeof row?.skuName === 'string' ? row.skuName : undefined,
        );
      }}
    />
  );
}

type CompositeComponentsTableProps = {
  manifest?: CatalogManifest;
  shapeKey: string;
  group: CatalogCompositeGroupDraft;
  currentItemCode?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  version: number;
  updateComponent: (componentEditorId: string, patch: Partial<CatalogCompositeComponentDraft>) => void;
  moveComponent: (componentEditorId: string, offset: -1 | 1) => void;
  removeComponent: (componentEditorId: string) => void;
  onDirty: () => void;
};

/**
 * The persisted groups are arrays, but a person configures one group as a small list of contents.
 * Keep the array and whole-save boundary intact while making that task visible as a table.
 */
function CompositeComponentsTable({
  manifest,
  shapeKey,
  group,
  currentItemCode,
  queryContext,
  brandRef,
  version,
  updateComponent,
  moveComponent,
  removeComponent,
  onDirty,
}: CompositeComponentsTableProps) {
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}}>
      {group.components.length === 0 ? <EmptySection text="尚未添加套餐内容" /> : null}
      {group.components.map((component, index) => (
        <Card
          key={component.editorId}
          size="small"
          title={
            component.itemName
              ? catalogBusinessName(component.itemName, component.itemCode, '商品名称暂时无法读取')
              : `套餐内容 ${index + 1}`
          }
          extra={
            <Space size={2}>
              <Button size="small" disabled={index === 0} onClick={() => moveComponent(component.editorId, -1)}>
                上移
              </Button>
              <Button
                size="small"
                disabled={index === group.components.length - 1}
                onClick={() => moveComponent(component.editorId, 1)}
              >
                下移
              </Button>
              <Button
                danger
                type="link"
                onClick={() => {
                  removeComponent(component.editorId);
                  onDirty();
                }}
                {...testId(
                  catalogTestIdControls.edit.dynamic(
                    'composite-component',
                    'remove',
                    group.editorId,
                    component.editorId,
                  ),
                )}
              >
                移除
              </Button>
            </Space>
          }
        >
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Typography.Text strong>商品</Typography.Text>
              <CompositeCandidatePicker
                manifest={manifest}
                value={{name: component.itemName, code: component.itemCode}}
                currentItemCode={currentItemCode}
                queryContext={queryContext}
                brandRef={brandRef}
                testIdValue={catalogTestIdControls.edit.dynamic(
                  'composite-component',
                  'item',
                  group.editorId,
                  component.editorId,
                )}
                onSelect={item => {
                  updateComponent(component.editorId, {
                    ...item,
                    productSkuRef: null,
                    skuCode: null,
                    skuName: null,
                  });
                  onDirty();
                }}
              />
            </Col>
            <Col xs={24} lg={12}>
              <Typography.Text strong>规格</Typography.Text>
              <CompositeSkuDescriptorPicker
                manifest={manifest}
                shapeKey={shapeKey}
                value={String(component.productSkuRef ?? '')}
                skuName={component.skuName}
                itemCode={component.itemCode}
                queryContext={queryContext}
                brandRef={brandRef}
                version={version}
                testIdValue={catalogTestIdControls.edit.dynamic(
                  'composite-component',
                  'sku',
                  group.editorId,
                  component.editorId,
                )}
                onChange={(next, skuCode, skuName) => {
                  updateComponent(component.editorId, {
                    productSkuRef: next ? draftUuid(next) : null,
                    skuCode: skuCode ?? null,
                    skuName: skuName ?? null,
                  });
                  onDirty();
                }}
              />
            </Col>
            <Col xs={12} lg={6}>
              <Typography.Text strong>数量</Typography.Text>
              <Input
                aria-label="数量"
                value={component.quantity}
                onChange={event => {
                  updateComponent(component.editorId, {quantity: event.target.value});
                  onDirty();
                }}
                {...testId(
                  catalogTestIdControls.edit.dynamic(
                    'composite-component',
                    'quantity',
                    group.editorId,
                    component.editorId,
                  ),
                )}
              />
            </Col>
            <Col xs={12} lg={6}>
              <Typography.Text strong>单位</Typography.Text>
              <Input
                aria-label="单位"
                value={component.unit}
                onChange={event => {
                  updateComponent(component.editorId, {unit: event.target.value});
                  onDirty();
                }}
                {...testId(
                  catalogTestIdControls.edit.dynamic('composite-component', 'unit', group.editorId, component.editorId),
                )}
              />
            </Col>
            <Col xs={12} lg={6}>
              <Typography.Text strong>加价（元）</Typography.Text>
              <InputNumber
                aria-label="加价（元）"
                style={{width: '100%'}}
                value={catalogCentsToYuan(component.extraPrice)}
                min={0}
                precision={2}
                step={0.01}
                onChange={extraPrice => {
                  updateComponent(component.editorId, {extraPrice: catalogYuanToCents(extraPrice)});
                  onDirty();
                }}
                {...testId(
                  catalogTestIdControls.edit.dynamic(
                    'composite-component',
                    'price',
                    group.editorId,
                    component.editorId,
                  ),
                )}
              />
            </Col>
            <Col xs={12} lg={6}>
              <Typography.Text strong>提供状态</Typography.Text>
              <Select
                aria-label="内容状态"
                style={{width: '100%'}}
                value={component.status}
                options={catalogEnumOptions(manifest, 'catalogItemStatus').filter(
                  option => option.value === 'ENABLED' || option.value === 'DISABLED',
                )}
                onChange={status => {
                  updateComponent(component.editorId, {status});
                  onDirty();
                }}
                {...testId(
                  catalogTestIdControls.edit.dynamic(
                    'composite-component',
                    'status',
                    group.editorId,
                    component.editorId,
                  ),
                )}
              />
            </Col>
            <Col xs={12} lg={6}>
              <Space direction="vertical" size={2}>
                <Typography.Text strong>默认内容</Typography.Text>
                <Switch
                  aria-label="设为默认内容"
                  checked={component.default}
                  onChange={defaultValue => {
                    updateComponent(component.editorId, {default: defaultValue});
                    onDirty();
                  }}
                  {...testId(
                    catalogTestIdControls.edit.dynamic(
                      'composite-component',
                      'default',
                      group.editorId,
                      component.editorId,
                    ),
                  )}
                />
              </Space>
            </Col>
          </Row>
        </Card>
      ))}
    </Space>
  );
}

function CompositeGroupsEditor({
  manifest,
  shapeKey,
  values,
  onChange,
  onDirty,
  queryContext,
  brandRef,
  currentItemCode,
  version,
  createDraftRowId,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  values: CatalogCompositeGroupDraft[];
  onChange: (next: CatalogCompositeGroupDraft[]) => void;
  onDirty: () => void;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  currentItemCode?: string;
  version: number;
  createDraftRowId: (prefix: string) => string;
}) {
  // Select the first existing group during the initial render as well as after
  // subsequent draft changes.  An effect-only default leaves the detail pane
  // blank for the first paint and makes the user think the selected group has
  // no editable content.
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(() => values[0]?.editorId);
  useEffect(() => {
    if (selectedGroupId && values.some(group => group.editorId === selectedGroupId)) return;
    setSelectedGroupId(values[0]?.editorId);
  }, [selectedGroupId, values]);
  const commitGroups = (next: CatalogCompositeGroupDraft[]) =>
    onChange(
      next.map((group, groupIndex) => ({
        ...group,
        displayOrder: groupIndex,
        components: group.components.map((component, componentIndex) => ({...component, displayOrder: componentIndex})),
      })),
    );
  const updateGroup = (editorId: string, patch: Partial<CatalogCompositeGroupDraft>) =>
    commitGroups(values.map(group => (group.editorId === editorId ? {...group, ...patch} : group)));
  const updateComponent = (groupId: string, componentId: string, patch: Partial<CatalogCompositeComponentDraft>) =>
    commitGroups(
      values.map(group =>
        group.editorId === groupId
          ? {
              ...group,
              components: group.components.map(component =>
                component.editorId === componentId ? {...component, ...patch} : component,
              ),
            }
          : group,
      ),
    );
  const moveGroup = (editorId: string, offset: -1 | 1) => {
    const index = values.findIndex(group => group.editorId === editorId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    commitGroups(next);
    onDirty();
  };
  const moveComponent = (groupId: string, componentId: string, offset: -1 | 1) => {
    const group = values.find(entry => entry.editorId === groupId);
    const index = group?.components.findIndex(component => component.editorId === componentId) ?? -1;
    const target = index + offset;
    if (!group || index < 0 || target < 0 || target >= group.components.length) return;
    const components = [...group.components];
    [components[index], components[target]] = [components[target], components[index]];
    updateGroup(groupId, {components});
    onDirty();
  };
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemCompositeGroupsEditor)}
    >
      <Alert type="info" showIcon title="在此设置套餐内容；库存和制作信息请在相应商品中维护。" />
      <Button
        onClick={() => {
          const group: CatalogCompositeGroupDraft = {
            groupCode: '',
            groupName: '',
            selectionRule: 'FIXED',
            minSelections: 0,
            maxSelections: 0,
            displayOrder: values.length,
            editorId: createDraftRowId('group'),
            components: [],
          };
          commitGroups([...values, group]);
          setSelectedGroupId(group.editorId);
          onDirty();
        }}
        {...testId(catalogTestIds.static.itemCompositeGroupAdd)}
      >
        新增套餐分组
      </Button>
      {values.length === 0 && <EmptySection text="未维护套餐分组" />}
      {values.length > 0 && (
        <Space align="start" size={12} style={{display: 'flex'}}>
          <Card size="small" title="套餐分组" style={{width: 240, flex: '0 0 240px'}}>
            <Space direction="vertical" size={4} style={{display: 'flex'}}>
              {values.map((group, index) => (
                <Button
                  key={group.editorId}
                  type={group.editorId === selectedGroupId ? 'primary' : 'text'}
                  style={{height: 'auto', minHeight: 48, textAlign: 'left', whiteSpace: 'normal'}}
                  onClick={() => setSelectedGroupId(group.editorId)}
                >
                  <Typography.Text ellipsis={{tooltip: group.groupName || '未命名分组'}}>
                    {group.groupName || `套餐分组 ${index + 1}`}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {({FIXED: '固定包含', SINGLE: '单选', MULTIPLE: '多选'} as Record<string, string>)[
                      group.selectionRule
                    ] ?? '未设置'}
                    {' · '}
                    {group.components.length} 项内容
                  </Typography.Text>
                </Button>
              ))}
            </Space>
          </Card>
          <div style={{flex: 1, minWidth: 0}}>
            {(selectedGroupId ? values.filter(group => group.editorId === selectedGroupId) : []).map(group => {
              const groupIndex = values.findIndex(entry => entry.editorId === group.editorId);
              return (
                <Card
                  key={group.editorId}
                  size="small"
                  title={`套餐分组 ${groupIndex + 1}`}
                  extra={
                    <Space size={2}>
                      <Button size="small" disabled={groupIndex === 0} onClick={() => moveGroup(group.editorId, -1)}>
                        上移
                      </Button>
                      <Button
                        size="small"
                        disabled={groupIndex === values.length - 1}
                        onClick={() => moveGroup(group.editorId, 1)}
                      >
                        下移
                      </Button>
                      <Button
                        danger
                        type="link"
                        onClick={() => {
                          const next = values.filter(entry => entry.editorId !== group.editorId);
                          commitGroups(next);
                          setSelectedGroupId(next[0]?.editorId);
                          onDirty();
                        }}
                        {...testId(catalogTestIdControls.edit.dynamic('composite-group', 'remove', group.editorId))}
                      >
                        移除组
                      </Button>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={8} style={{display: 'flex'}}>
                    <Row gutter={[16, 12]}>
                      <Col xs={24} lg={8}>
                        <Typography.Text strong>分组名称</Typography.Text>
                        <Input
                          style={{width: '100%', marginTop: 4}}
                          value={group.groupName}
                          onChange={event => {
                            updateGroup(group.editorId, {groupName: event.target.value});
                            onDirty();
                          }}
                          {...testId(catalogTestIdControls.edit.dynamic('composite-group', 'name', group.editorId))}
                        />
                      </Col>
                      <Col xs={24} lg={8}>
                        <Typography.Text strong>选择方式</Typography.Text>
                        <Select
                          style={{width: '100%', marginTop: 4}}
                          value={group.selectionRule}
                          options={[
                            {value: 'FIXED', label: '固定包含'},
                            {value: 'SINGLE', label: '单选'},
                            {value: 'MULTIPLE', label: '多选'},
                          ]}
                          onChange={selectionRule => {
                            updateGroup(group.editorId, {selectionRule});
                            onDirty();
                          }}
                          {...testId(catalogTestIdControls.edit.dynamic('composite-group', 'rule', group.editorId))}
                        />
                      </Col>
                      <Col xs={24} lg={8}>
                        <Typography.Text strong>分组编码</Typography.Text>
                        <Input
                          style={{width: '100%', marginTop: 4}}
                          value={group.groupCode}
                          onChange={event => {
                            updateGroup(group.editorId, {groupCode: event.target.value});
                            onDirty();
                          }}
                          {...testId(catalogTestIdControls.edit.dynamic('composite-group', 'code', group.editorId))}
                        />
                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                          用于区分套餐分组。
                        </Typography.Text>
                      </Col>
                    </Row>
                    <Space style={{justifyContent: 'space-between', width: '100%'}}>
                      <Typography.Text type="secondary">先添加内容，再选择商品及其规格。</Typography.Text>
                      <Button
                        onClick={() => {
                          updateGroup(group.editorId, {
                            components: [
                              ...group.components,
                              {
                                itemCode: '',
                                itemName: '',
                                itemRef: draftUuid(),
                                editorId: createDraftRowId('component'),
                                productSkuRef: null,
                                skuCode: null,
                                skuName: null,
                                quantity: '1',
                                unit: '',
                                default: false,
                                extraPrice: null,
                                status: 'ENABLED',
                                displayOrder: group.components.length,
                              },
                            ],
                          });
                          onDirty();
                        }}
                        {...testId(catalogTestIdControls.edit.dynamic('composite-component', 'add', group.editorId))}
                      >
                        添加内容
                      </Button>
                    </Space>
                    <CompositeComponentsTable
                      manifest={manifest}
                      shapeKey={shapeKey}
                      group={group}
                      currentItemCode={currentItemCode}
                      queryContext={queryContext}
                      brandRef={brandRef}
                      version={version}
                      updateComponent={(componentEditorId, patch) =>
                        updateComponent(group.editorId, componentEditorId, patch)
                      }
                      moveComponent={(componentEditorId, offset) =>
                        moveComponent(group.editorId, componentEditorId, offset)
                      }
                      removeComponent={componentEditorId =>
                        updateGroup(group.editorId, {
                          components: group.components.filter(entry => entry.editorId !== componentEditorId),
                        })
                      }
                      onDirty={onDirty}
                    />
                  </Space>
                </Card>
              );
            })}
          </div>
        </Space>
      )}
    </Space>
  );
}
