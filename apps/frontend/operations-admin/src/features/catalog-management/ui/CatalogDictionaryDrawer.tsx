import {Alert, Button, Drawer, Form, Input, Modal, Select, Space, Table, Tabs, Tag} from 'antd';
import {adminWideDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {CatalogDictionaryView, CatalogInventoryEnvelope, ProductionTagPage} from '../../../app/api/generated/catalog-inventory-edge';
import type {OperationsPageProps} from '../../../app/routing/model';

export type ProductionTagKind = 'PRODUCTION' | 'PACKAGE' | 'LABEL' | 'HANDOFF' | 'REVIEW' | 'OTHER';
export type ProductionTagCandidate = {code: string; name: string; tagKind?: ProductionTagKind; owner: 'fulfillment-production'};
type Props = {
  open: boolean;
  initialKind?: DictionaryKind;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWrite: boolean;
  quickManage?: boolean;
  onCreated?: (candidate: ProductionTagCandidate) => void;
  onClose: () => void;
};
export type DictionaryKind = 'TAG' | 'SALES_UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';
type FormValues = {code: string; name: string; tagKind?: ProductionTagKind};
type VoidAvailability = {canVoid: boolean; blockingReferences: Array<{referenceKind: string; referenceRef: string}>; dependentFacts: Array<{factKind: string; factRef: string}>};
type DictionaryRow = {code: string; name: string; tagKind?: ProductionTagKind; status: string; version: number; linkedProductCount?: number; voidAvailability?: VoidAvailability};

function voidReason(value?: VoidAvailability) {
  if (!value || value.canVoid) return undefined;
  const references = value.blockingReferences.map((entry) => `${entry.referenceKind}:${entry.referenceRef}`);
  const facts = value.dependentFacts.map((entry) => `${entry.factKind}:${entry.factRef}`);
  return [...references, ...facts].join('；') || '存在 owner 阻断事实';
}

const productionTagKindOptions: Array<{value: ProductionTagKind; label: string}> = [
  {value: 'PRODUCTION', label: '制作'}, {value: 'PACKAGE', label: '打包'}, {value: 'LABEL', label: '标签'},
  {value: 'HANDOFF', label: '交接'}, {value: 'REVIEW', label: '复核'}, {value: 'OTHER', label: '其他'},
];
const productionTagKindLabel = (value?: ProductionTagKind) => productionTagKindOptions.find((option) => option.value === value)?.label ?? value ?? '—';

const dictionaryTabs: Array<{key: Exclude<DictionaryKind, 'PRODUCTION_TAG'>; label: string}> = [
  {key: 'TAG', label: '商品标签'},
  {key: 'SALES_UNIT', label: '销售单位'},
  {key: 'SKU_ATTRIBUTE', label: 'SKU 销售属性'},
  {key: 'SKU_ATTRIBUTE_VALUE', label: '属性值'},
];

export function CatalogDictionaryDrawer({open, initialKind = 'TAG', queryContext, brandRef, canWrite, quickManage = false, onCreated, onClose}: Props) {
  const [kind, setKind] = useState<DictionaryKind>(initialKind);
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const [editingCode, setEditingCode] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [rebuildFrom, setRebuildFrom] = useState<DictionaryRow>();
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const isProduction = kind === 'PRODUCTION_TAG';
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '字典新建内容尚未保存。', dirtyGuardTestIds: {confirm: testId('catalog-dictionary-dirty-discard'), cancel: testId('catalog-dictionary-dirty-continue')}, diagnosticOperationId: isProduction ? 'production-tag-quick-manage' : 'catalog-dictionary'});
  const dictionaryRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogDictionary({dictionaryKind: kind === 'PRODUCTION_TAG' ? 'TAG' : kind}, {query: {dataNodeRef: queryContext.scopeRef ?? ''}, headers}), [headers, kind, queryContext.scopeRef]);
  const dictionaryQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(dictionaryRequest, {skip: !open || isProduction});
  const productionRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsProductionTags({}, {query: {dataNodeRef: queryContext.scopeRef ?? ''}, headers}), [headers, queryContext.scopeRef]);
  const productionQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionRequest, {skip: !open || !isProduction});
  const [createEntry, createEntryState] = operationsRtk.useCreateOperationsCatalogDictionaryEntryMutation();
  const [createTag, createTagState] = operationsRtk.useCreateOperationsProductionTagMutation();
  const [updateEntry, updateEntryState] = operationsRtk.useUpdateOperationsCatalogDictionaryEntryMutation();
  const [reorderEntry, reorderEntryState] = operationsRtk.useReorderOperationsCatalogDictionaryEntryMutation();
  const [transitionEntry, transitionEntryState] = operationsRtk.useTransitionOperationsCatalogDictionaryEntryStatusMutation();
  const [updateTag, updateTagState] = operationsRtk.useUpdateOperationsProductionTagMutation();
  const [transitionTag, transitionTagState] = operationsRtk.useTransitionOperationsProductionTagStatusMutation();
  // The owner edge returns the page payload in envelope.data; generated page
  // readbacks retain their historical revision/data wrapper, so the UI reads
  // the actual wire boundary rather than assuming a second nested data field.
  const dictionaryData = (dictionaryQuery.data as CatalogInventoryEnvelope | undefined)?.data as CatalogDictionaryView['data'] | undefined;
  const productionData = (productionQuery.data as CatalogInventoryEnvelope | undefined)?.data as ProductionTagPage['data'] | undefined;
  useEffect(() => { if (open) setKind(initialKind); }, [initialKind, open]);
  useEffect(() => { if (!open) { setEditingCode(undefined); setEditingName(''); setRebuildFrom(undefined); setProblem(undefined); } }, [open]);
  useEffect(() => {
    if (!rebuildFrom) return;
    form.resetFields();
    form.setFieldsValue({name: rebuildFrom.name, ...(isProduction ? {tagKind: rebuildFrom.tagKind ?? 'PRODUCTION'} : {})});
    lifecycle.setDirty(true);
  }, [form, isProduction, lifecycle, rebuildFrom]);

  const create = async () => {
    try {
      const values = await form.validateFields();
      lifecycle.setSubmitting(true);
      setProblem(undefined);
      const code = values.code.trim();
      const name = values.name.trim();
      if (isProduction) {
        const tagKind = values.tagKind ?? 'PRODUCTION';
        const response = await createTag(catalogInventoryRtkRequest.createOperationsProductionTag({}, {headers: {...headers, 'Idempotency-Key': lifecycle.getIdempotencyKey()}, body: {dataNodeRef: queryContext.scopeRef ?? undefined, code, tagKind, name}})).unwrap();
        const readback = (response as CatalogInventoryEnvelope).result as {code?: string; name?: string} | undefined;
        const candidate: ProductionTagCandidate = {code: readback?.code ?? code, name: readback?.name ?? name, tagKind, owner: 'fulfillment-production'};
        onCreated?.(candidate);
        await productionQuery.refetch();
        form.resetFields();
        lifecycle.reset();
        if (quickManage) onClose();
      } else {
        await createEntry(catalogInventoryRtkRequest.createOperationsCatalogDictionaryEntry({dictionaryKind: kind}, {headers: {...headers, 'Idempotency-Key': lifecycle.getIdempotencyKey()}, body: {dictionaryKind: kind, code, name}})).unwrap();
        form.resetFields();
        lifecycle.reset();
        await dictionaryQuery.refetch();
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(operationsProblemOf(error).detail || '字典保存未完成，请重试。');
      lifecycle.setSubmitting(false);
    }
  };

  const refreshRows = async () => { if (isProduction) await productionQuery.refetch(); else await dictionaryQuery.refetch(); };
  const saveName = async (row: DictionaryRow) => {
    const name = editingName.trim();
    if (!name) { setProblem('名称不能为空。'); return; }
    try {
      setProblem(undefined);
      const requestHeaders = {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()};
      if (isProduction) {
        await updateTag(catalogInventoryRtkRequest.updateOperationsProductionTag({tagCode: row.code}, {headers: requestHeaders, body: {tagCode: row.code, expectedVersion: row.version, tagKind: row.tagKind ?? 'OTHER', name}})).unwrap();
      } else {
        await updateEntry(catalogInventoryRtkRequest.updateOperationsCatalogDictionaryEntry({dictionaryKind: kind, entryCode: row.code}, {headers: requestHeaders, body: {dictionaryKind: kind, entryCode: row.code, expectedVersion: row.version, name}})).unwrap();
      }
      setEditingCode(undefined); setEditingName(''); await refreshRows();
    } catch (error) { setProblem(operationsProblemOf(error).detail || '字典名称更新未完成，请重试。'); }
  };
  const changeStatus = async (row: DictionaryRow) => {
    if (row.status === 'VOIDED') return;
    const targetStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    try {
      setProblem(undefined);
      const requestHeaders = {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()};
      if (isProduction) {
        await transitionTag(catalogInventoryRtkRequest.transitionOperationsProductionTagStatus({tagCode: row.code}, {headers: requestHeaders, body: {tagCode: row.code, expectedVersion: row.version, targetStatus}})).unwrap();
      } else {
        await transitionEntry(catalogInventoryRtkRequest.transitionOperationsCatalogDictionaryEntryStatus({dictionaryKind: kind, entryCode: row.code}, {headers: requestHeaders, body: {dictionaryKind: kind, entryCode: row.code, expectedVersion: row.version, targetStatus}})).unwrap();
      }
      await refreshRows();
    } catch (error) { setProblem(operationsProblemOf(error).detail || '字典状态更新未完成，请重试。'); }
  };
  const voidAndPrepareRebuild = (row: DictionaryRow) => {
    if (!row.voidAvailability?.canVoid) return;
    Modal.confirm({
      title: `作废并重建“${row.name}”`,
      content: '将先把旧记录置为作废并永久保留原编码，然后用新编码创建一条记录。旧编码不会释放。',
      okText: '作废并继续重建',
      cancelText: '取消',
      onOk: async () => {
        try {
          setProblem(undefined);
          const requestHeaders = {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()};
          if (isProduction) {
            await transitionTag(catalogInventoryRtkRequest.transitionOperationsProductionTagStatus({tagCode: row.code}, {headers: requestHeaders, body: {tagCode: row.code, expectedVersion: row.version, targetStatus: 'VOIDED'}})).unwrap();
          } else {
            await transitionEntry(catalogInventoryRtkRequest.transitionOperationsCatalogDictionaryEntryStatus({dictionaryKind: kind, entryCode: row.code}, {headers: requestHeaders, body: {dictionaryKind: kind, entryCode: row.code, expectedVersion: row.version, targetStatus: 'VOIDED'}})).unwrap();
          }
          setRebuildFrom(row);
          await refreshRows();
        } catch (error) {
          setProblem(operationsProblemOf(error).detail || '作废未完成，请重试。');
          throw error;
        }
      },
    });
  };
  const moveRow = async (index: number, offset: -1 | 1) => {
    if (isProduction) return;
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    const orderedCodes = rows.map((row) => row.code);
    [orderedCodes[index], orderedCodes[target]] = [orderedCodes[target], orderedCodes[index]];
    try {
      setProblem(undefined);
      await reorderEntry(catalogInventoryRtkRequest.reorderOperationsCatalogDictionaryEntry({dictionaryKind: kind}, {headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()}, body: {dictionaryKind: kind, orderedCodes}})).unwrap();
      await refreshRows();
    } catch (error) { setProblem(operationsProblemOf(error).detail || '字典顺序更新未完成，请重试。'); }
  };

  const rows: DictionaryRow[] = isProduction
    ? (productionData?.entries ?? []).map((entry) => ({code: entry.code, name: entry.name, tagKind: entry.tagKind, status: entry.status, version: entry.version, linkedProductCount: entry.linkedProductCount, voidAvailability: entry.voidAvailability}))
    : (dictionaryData?.entries ?? []).map((entry) => ({code: entry.code, name: entry.name, status: entry.status, version: entry.version, voidAvailability: entry.voidAvailability}));
  const title = quickManage ? '快速创建商品处理标签 · 生产履约域' : isProduction ? '商品处理标签 · 生产履约域' : '商品字典与关联维护';
  return <Drawer title={title} open={open} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} destroyOnHidden={false} maskClosable={!lifecycle.dirty} {...adminWideDrawerSurfaceProps} {...testId(quickManage ? 'catalog-production-tag-quick-manage-drawer' : 'catalog-dictionary-drawer')}>
    {problem && <Alert type="error" showIcon title="字典操作未完成" description={problem} style={{marginBottom: 16}} {...testId('catalog-dictionary-problem')}/>} 
    {isProduction ? <>
      <Alert type="info" showIcon title="生产履约 owner" description={`当前作用域：${queryContext.scopeRef || '未选择门店'}${brandRef ? ` · 品牌 ${brandRef}` : ''}；创建成功后只回填发起 quickManage 的当前字段。`} style={{marginBottom: 16}} {...testId('catalog-production-tag-owner')}/>
      {!quickManage && <div {...testId('catalog-dictionary-tabs')}><Tag color="blue">商品处理标签独立入口</Tag></div>}
    </> : <Tabs activeKey={kind} onChange={(next) => setKind(next as DictionaryKind)} items={dictionaryTabs.map((tab) => ({key: tab.key, label: tab.label}))} {...testId('catalog-dictionary-tabs')}/>} 
    {!quickManage && <Table size="small" rowKey="code" loading={dictionaryQuery.isLoading || productionQuery.isLoading} dataSource={rows} pagination={false} columns={[
      {title: '名称 / 编码', key: 'identity', render: (_: unknown, row: DictionaryRow) => editingCode === row.code ? <Space><Input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus {...testId(`catalog-dictionary-edit-name-${row.code}`)}/><Button type="link" loading={updateEntryState.isLoading || updateTagState.isLoading} onClick={() => void saveName(row)}>保存</Button><Button type="link" onClick={() => { setEditingCode(undefined); setEditingName(''); }}>取消</Button></Space> : <NameCodeText name={row.name} code={row.code}/>},
      ...(isProduction ? [{title: '类型', dataIndex: 'tagKind', render: (value: ProductionTagKind) => productionTagKindLabel(value)}] : []),
      {title: '状态', dataIndex: 'status', render: (value: string, row: DictionaryRow) => value === 'VOIDED' ? <Tag color="red">已作废</Tag> : <Button type="link" onClick={() => void changeStatus(row)} loading={transitionEntryState.isLoading || transitionTagState.isLoading}><Tag color={value === 'ENABLED' ? 'green' : 'default'}>{value}</Tag></Button>},
      {title: '引用数', dataIndex: 'linkedProductCount', render: (value: number | undefined) => value ?? '—'},
      {key: 'actions', render: (_: unknown, row: DictionaryRow, index: number) => <Space>
        {row.status !== 'VOIDED' && <Button type="link" onClick={() => { setEditingCode(row.code); setEditingName(row.name); }} {...testId(`catalog-dictionary-edit-${row.code}`)}>编辑名称</Button>}
        {row.status !== 'VOIDED' && <Button type="link" danger disabled={!row.voidAvailability?.canVoid} title={voidReason(row.voidAvailability)} onClick={() => voidAndPrepareRebuild(row)} {...testId(`catalog-dictionary-void-rebuild-${row.code}`)}>作废并重建</Button>}
        {!isProduction && <><Button type="link" disabled={index === 0 || row.status === 'VOIDED'} onClick={() => void moveRow(index, -1)} loading={reorderEntryState.isLoading}>上移</Button><Button type="link" disabled={index === rows.length - 1 || row.status === 'VOIDED'} onClick={() => void moveRow(index, 1)} loading={reorderEntryState.isLoading}>下移</Button></>}
      </Space>},
    ]} {...testId('catalog-dictionary-table')}/>} 
    {canWrite && <Form form={form} layout="inline" style={{marginTop: 16}} onValuesChange={() => lifecycle.setDirty(true)}>
      {rebuildFrom && <Alert type="warning" showIcon title="正在重建作废记录" description={`旧编码 ${rebuildFrom.code} 已永久保留，请输入新的唯一编码后创建。`} style={{width: '100%', marginBottom: 12}} {...testId('catalog-dictionary-rebuild-notice')}/>} 
      <Form.Item name="code" rules={[{required: true, message: '请输入编码'}, {pattern: /^[A-Z0-9][A-Z0-9_-]*$/, message: '编码格式不正确'}]}><Input placeholder="编码（创建后不可修改）" {...testId('catalog-dictionary-code')}/></Form.Item>
      {isProduction && <Form.Item name="tagKind" initialValue="PRODUCTION" rules={[{required: true, message: '请选择标签类型'}]}><Select style={{width: 140}} options={productionTagKindOptions} placeholder="标签类型" {...testId('catalog-production-tag-kind')}/></Form.Item>}
      <Form.Item name="name" rules={[{required: true, message: '请输入名称'}]}><Input placeholder="名称" {...testId('catalog-dictionary-name')}/></Form.Item>
      <Button type="primary" loading={createEntryState.isLoading || createTagState.isLoading || lifecycle.submitting} onClick={() => void create()} {...testId(quickManage ? 'catalog-production-tag-quick-manage-create' : 'catalog-dictionary-create')}>{quickManage ? '创建并回填当前字段' : '新建'}</Button>
    </Form>}
    {!canWrite && <TypographyHint text="当前账号没有编辑商品库能力，只读查看字典。"/>}
  </Drawer>;
}

function TypographyHint({text}: {text: string}) { return <div style={{marginTop: 16, color: 'rgba(0,0,0,.45)'}}>{text}</div>; }
