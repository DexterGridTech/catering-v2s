import {Alert, Button, Drawer, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip} from 'antd';
import {adminWideDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {canMoveDictionaryRow} from '../model/dictionaryOrdering';
import {catalogEnumLabel, catalogEnumOptions} from '../model/catalogManifestLabels';
import {catalogDictionaryCodeConflict, productionTagCandidateFromReadback, type CatalogDictionaryCodeConflict, type CatalogProductionTagCandidate} from '../model/catalogModel';

export type ProductionTagKind = 'PRODUCTION' | 'PACKAGE' | 'LABEL' | 'HANDOFF' | 'REVIEW' | 'OTHER';
export type ProductionTagCandidate = CatalogProductionTagCandidate;
export type CatalogDictionaryQuickManageCandidate = {entryRef: string; code: string; name: string};
type Props = {
  open: boolean;
  initialKind?: DictionaryKind;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWrite: boolean;
  quickManage?: boolean;
  onCreated?: (candidate: ProductionTagCandidate) => void;
  onDictionaryCreated?: (candidate: CatalogDictionaryQuickManageCandidate) => void;
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

const dictionaryTabs: Array<{key: DictionaryKind; label: string}> = [
  {key: 'TAG', label: '商品标签'},
  {key: 'SALES_UNIT', label: '销售单位'},
  {key: 'SKU_ATTRIBUTE', label: 'SKU 销售属性'},
  {key: 'SKU_ATTRIBUTE_VALUE', label: '属性值'},
  {key: 'PRODUCTION_TAG', label: '生产标签'},
];

export function CatalogDictionaryDrawer({open, initialKind = 'TAG', queryContext, brandRef, canWrite, quickManage = false, onCreated, onDictionaryCreated, onClose}: Props) {
  const [kind, setKind] = useState<DictionaryKind>(initialKind);
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const [codeAvailability, setCodeAvailability] = useState<{code: string; available: boolean; occupiedBy?: CatalogDictionaryCodeConflict}>();
  const [checkingCode, setCheckingCode] = useState(false);
  const [editingCode, setEditingCode] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [rebuildFrom, setRebuildFrom] = useState<DictionaryRow>();
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const isProduction = kind === 'PRODUCTION_TAG';
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '字典新建内容尚未保存。', dirtyGuardTestIds: {confirm: testId('catalog-dictionary-dirty-discard'), cancel: testId('catalog-dictionary-dirty-continue')}, diagnosticOperationId: isProduction ? 'production-tag-quick-manage' : 'catalog-dictionary'});
  const manifestRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogShapeManifest({}, {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers}), [headers, queryContext.scopeRef]);
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {skip: !open || !queryContext.scopeRef});
  const manifest = manifestQuery.currentData?.data;
  const productionTagKindOptions = useMemo(() => catalogEnumOptions(manifest, 'productionTagKind'), [manifest]);
  const productionTagKindLabel = (value?: ProductionTagKind) => catalogEnumLabel(manifest, 'productionTagKind', value);
  const dictionaryRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogDictionary({dictionaryKind: kind === 'PRODUCTION_TAG' ? 'TAG' : kind}, {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers}), [headers, kind, queryContext.scopeRef]);
  const dictionaryQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(dictionaryRequest, {skip: !open || isProduction});
  const productionRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsProductionTags({}, {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers}), [headers, queryContext.scopeRef]);
  const productionQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionRequest, {skip: !open || !isProduction});
  const [createEntry, createEntryState] = operationsRtk.useCreateOperationsCatalogDictionaryEntryMutation();
  const [createTag, createTagState] = operationsRtk.useCreateOperationsProductionTagMutation();
  const [updateEntry, updateEntryState] = operationsRtk.useUpdateOperationsCatalogDictionaryEntryMutation();
  const [reorderEntry, reorderEntryState] = operationsRtk.useReorderOperationsCatalogDictionaryEntryMutation();
  const [transitionEntry, transitionEntryState] = operationsRtk.useTransitionOperationsCatalogDictionaryEntryStatusMutation();
  const [updateTag, updateTagState] = operationsRtk.useUpdateOperationsProductionTagMutation();
  const [transitionTag, transitionTagState] = operationsRtk.useTransitionOperationsProductionTagStatusMutation();
  const dictionaryData = dictionaryQuery.data?.data;
  const productionData = productionQuery.data?.data;
  useEffect(() => { if (open) setKind(initialKind); }, [initialKind, open]);
  useEffect(() => {
    if (!open) {
      setEditingCode(undefined);
      setEditingName('');
      setRebuildFrom(undefined);
      setProblem(undefined);
      setCodeAvailability(undefined);
    }
  }, [open]);
  useEffect(() => { setCodeAvailability(undefined); }, [kind]);
  useEffect(() => {
    if (!rebuildFrom) return;
    form.resetFields();
    form.setFieldsValue({name: rebuildFrom.name, ...(isProduction ? {tagKind: rebuildFrom.tagKind ?? 'PRODUCTION'} : {})});
    lifecycle.setDirty(true);
  }, [form, isProduction, lifecycle, rebuildFrom]);

  const checkCodeAvailability = async (rawCode: string | undefined) => {
    const code = rawCode?.trim().toUpperCase() ?? '';
    if (!code || !/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
      setCodeAvailability(undefined);
      return undefined;
    }
    setCheckingCode(true);
    try {
      const refreshed = isProduction ? await productionQuery.refetch() : await dictionaryQuery.refetch();
      const entries = refreshed.data?.data.entries ?? [];
      const occupiedBy = catalogDictionaryCodeConflict(entries, code);
      const occupied = Boolean(occupiedBy);
      setCodeAvailability({code, available: !occupied, occupiedBy});
      form.setFields([{name: 'code', errors: occupied ? ['当前编码已被现有条目占用。'] : []}]);
      return !occupied;
    } catch {
      setCodeAvailability(undefined);
      return undefined;
    } finally {
      setCheckingCode(false);
    }
  };

  const create = async () => {
    try {
      const values = await form.validateFields();
      const available = await checkCodeAvailability(values.code);
      if (available === false) throw new Error('DICTIONARY_CODE_UNAVAILABLE');
      if (available === undefined) throw new Error('DICTIONARY_CODE_AVAILABILITY_UNKNOWN');
      lifecycle.setSubmitting(true);
      setProblem(undefined);
      const code = values.code.trim();
      const name = values.name.trim();
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (isProduction) {
        const tagKind = values.tagKind ?? 'PRODUCTION';
        const response = await createTag(catalogInventoryRtkRequest.createOperationsProductionTag({}, {headers: {...headers, 'Idempotency-Key': lifecycle.getIdempotencyKey()}, body: {dataNodeRef, code, tagKind, name}})).unwrap();
        const readback = response.result;
        const candidate = productionTagCandidateFromReadback(readback, {code, name, tagKind});
        if (!candidate) {
          setProblem('生产标签创建回读缺少 tagRef，未回填到商品。');
          lifecycle.setSubmitting(false);
          return;
        }
        onCreated?.(candidate);
        await productionQuery.refetch();
        form.resetFields();
        lifecycle.reset();
        if (quickManage) onClose();
      } else {
        await createEntry(catalogInventoryRtkRequest.createOperationsCatalogDictionaryEntry({dictionaryKind: kind}, {headers: {...headers, 'Idempotency-Key': lifecycle.getIdempotencyKey()}, body: {dataNodeRef, dictionaryKind: kind, code, name}})).unwrap();
        form.resetFields();
        lifecycle.reset();
        const refreshed = await dictionaryQuery.refetch();
        if (quickManage) {
          const created = refreshed.data?.data.entries.find((entry) => entry.code === code);
          if (!created) {
            setProblem('字典创建已成功，但回读缺少新条目的身份，未自动回填当前字段。');
            lifecycle.setSubmitting(false);
            return;
          }
          onDictionaryCreated?.({entryRef: created.entryRef, code: created.code, name: created.name});
          onClose();
        }
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const feedback = operationsProblemOf(error);
      if (!isProduction && feedback.errorCode === 'DUPLICATE_CODE') {
        form.setFields([{name: 'code', errors: [feedback.detail || '当前作用域中已存在相同编码。']}]);
        setProblem(undefined);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(error instanceof Error && error.message === 'DICTIONARY_CODE_UNAVAILABLE' ? '当前作用域中已存在该编码。' : error instanceof Error && error.message === 'DICTIONARY_CODE_AVAILABILITY_UNKNOWN' ? '暂时无法确认编码是否可用，请重试。' : feedback.detail || '字典保存未完成，请重试。');
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
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (isProduction) {
        await updateTag(catalogInventoryRtkRequest.updateOperationsProductionTag({tagCode: row.code}, {headers: requestHeaders, body: {dataNodeRef, tagCode: row.code, expectedVersion: row.version, tagKind: row.tagKind ?? 'OTHER', name}})).unwrap();
      } else {
        await updateEntry(catalogInventoryRtkRequest.updateOperationsCatalogDictionaryEntry({dictionaryKind: kind, entryCode: row.code}, {headers: requestHeaders, body: {dataNodeRef, dictionaryKind: kind, entryCode: row.code, expectedVersion: row.version, name}})).unwrap();
      }
      setEditingCode(undefined); setEditingName(''); await refreshRows();
    } catch (error) { setProblem(operationsProblemOf(error).detail || '字典名称更新未完成，请重试。'); }
  };
  const changeStatus = async (row: DictionaryRow) => {
    if (row.status === 'VOIDED') return;
    const targetStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    Modal.confirm({
      title: `${targetStatus === 'DISABLED' ? '停用' : '启用'}“${row.name}”？`,
      content: targetStatus === 'DISABLED' ? '停用后新建商品的候选列表不会再展示该条目，已经保存的引用不受影响。' : '启用后该条目会重新出现在候选列表中。',
      okText: `确认${targetStatus === 'DISABLED' ? '停用' : '启用'}`,
      cancelText: '取消',
      onOk: async () => {
        try {
          setProblem(undefined);
          const requestHeaders = {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()};
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          if (isProduction) {
            await transitionTag(catalogInventoryRtkRequest.transitionOperationsProductionTagStatus({tagCode: row.code}, {headers: requestHeaders, body: {dataNodeRef, tagCode: row.code, expectedVersion: row.version, targetStatus}})).unwrap();
          } else {
            await transitionEntry(catalogInventoryRtkRequest.transitionOperationsCatalogDictionaryEntryStatus({dictionaryKind: kind, entryCode: row.code}, {headers: requestHeaders, body: {dataNodeRef, dictionaryKind: kind, entryCode: row.code, expectedVersion: row.version, targetStatus}})).unwrap();
          }
          await refreshRows();
        } catch (error) { setProblem(operationsProblemOf(error).detail || '字典状态更新未完成，请重试。'); throw error; }
      },
    });
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
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          if (isProduction) {
            await transitionTag(catalogInventoryRtkRequest.transitionOperationsProductionTagStatus({tagCode: row.code}, {headers: requestHeaders, body: {dataNodeRef, tagCode: row.code, expectedVersion: row.version, targetStatus: 'VOIDED'}})).unwrap();
          } else {
            await transitionEntry(catalogInventoryRtkRequest.transitionOperationsCatalogDictionaryEntryStatus({dictionaryKind: kind, entryCode: row.code}, {headers: requestHeaders, body: {dataNodeRef, dictionaryKind: kind, entryCode: row.code, expectedVersion: row.version, targetStatus: 'VOIDED'}})).unwrap();
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
    if (isProduction || !canMoveDictionaryRow(rows, index, offset)) return;
    const target = index + offset;
    const orderedCodes = rows.map((row) => row.code);
    [orderedCodes[index], orderedCodes[target]] = [orderedCodes[target], orderedCodes[index]];
    try {
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      await reorderEntry(catalogInventoryRtkRequest.reorderOperationsCatalogDictionaryEntry({dictionaryKind: kind}, {headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()}, body: {dataNodeRef, dictionaryKind: kind, orderedCodes}})).unwrap();
      await refreshRows();
    } catch (error) { setProblem(operationsProblemOf(error).detail || '字典顺序更新未完成，请重试。'); }
  };

  const rows: DictionaryRow[] = isProduction
    ? (productionData?.entries ?? []).map((entry) => ({code: entry.code, name: entry.name, tagKind: entry.tagKind, status: entry.status, version: entry.version, linkedProductCount: entry.linkedProductCount, voidAvailability: entry.voidAvailability}))
    : (dictionaryData?.entries ?? []).map((entry) => ({code: entry.code, name: entry.name, status: entry.status, version: entry.version, voidAvailability: entry.voidAvailability}));
  const readOnlyReason = canWrite ? undefined : '当前账号只有查看商品库的权限，不能修改字典。';
  const title = quickManage ? `快速创建${isProduction ? '商品处理标签' : (dictionaryTabs.find((tab) => tab.key === kind)?.label ?? '字典条目')}` : isProduction ? '商品处理标签 · 生产履约域' : '商品字典与关联维护';
  return <Drawer title={title} open={open} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} destroyOnHidden={false} maskClosable={!lifecycle.dirty} {...adminWideDrawerSurfaceProps} {...testId(quickManage ? 'catalog-production-tag-quick-manage-drawer' : 'catalog-dictionary-drawer')}>
    {problem && <Alert type="error" showIcon title="字典操作未完成" description={problem} style={{marginBottom: 16}} {...testId('catalog-dictionary-problem')}/>} 
    {isProduction ? <>
      <Alert type="info" showIcon title="生产履约 owner" description={`当前作用域：${queryContext.scopeRef || '未选择门店'}${brandRef ? ` · 品牌 ${brandRef}` : ''}；创建成功后只回填发起 quickManage 的当前字段。`} style={{marginBottom: 16}} {...testId('catalog-production-tag-owner')}/>
      {!quickManage && <div {...testId('catalog-dictionary-tabs')}><Tag color="blue">商品处理标签独立入口</Tag></div>}
    </> : quickManage ? <Alert type="info" showIcon title="商品字典 owner" description={`当前作用域：${queryContext.scopeRef || '未选择门店'}${brandRef ? ` · 品牌 ${brandRef}` : ''}；创建成功后只回填发起 quickManage 的当前字段。`} style={{marginBottom: 16}} {...testId('catalog-dictionary-owner')}/> : <Tabs activeKey={kind} onChange={(next) => setKind(next as DictionaryKind)} items={dictionaryTabs.map((tab) => ({key: tab.key, label: tab.label}))} {...testId('catalog-dictionary-tabs')}/>}
    {!quickManage && <Table size="small" rowKey="code" loading={dictionaryQuery.isLoading || productionQuery.isLoading} dataSource={rows} pagination={false} columns={[
      {title: '名称 / 编码', key: 'identity', render: (_: unknown, row: DictionaryRow) => editingCode === row.code && canWrite ? <Space><Input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus {...testId(`catalog-dictionary-edit-name-${row.code}`)}/><Button type="link" loading={updateEntryState.isLoading || updateTagState.isLoading} onClick={() => void saveName(row)}>保存</Button><Button type="link" onClick={() => { setEditingCode(undefined); setEditingName(''); }}>取消</Button></Space> : <NameCodeText name={row.name} code={row.code}/>},
      ...(isProduction ? [{title: '类型', dataIndex: 'tagKind', render: (value: ProductionTagKind) => productionTagKindLabel(value)}] : []),
      {title: '状态', dataIndex: 'status', render: (value: string, row: DictionaryRow) => value === 'VOIDED' ? <Tag color="red">{catalogEnumLabel(manifest, 'dictionaryEntryStatus', value)}</Tag> : withMutationReason(<Button type="link" disabled={!canWrite} onClick={() => void changeStatus(row)} loading={transitionEntryState.isLoading || transitionTagState.isLoading}><Tag color={value === 'ENABLED' ? 'green' : 'default'}>{catalogEnumLabel(manifest, 'dictionaryEntryStatus', value)}</Tag></Button>, !canWrite, readOnlyReason)},
      {title: '版本', dataIndex: 'version', width: 80},
      {title: '引用数', dataIndex: 'linkedProductCount', render: (value: number | undefined) => value ?? '—'},
      {key: 'actions', render: (_: unknown, row: DictionaryRow, index: number) => <Space>
        {row.status !== 'VOIDED' && withMutationReason(<Button type="link" disabled={!canWrite} onClick={() => { setEditingCode(row.code); setEditingName(row.name); }} {...testId(`catalog-dictionary-edit-${row.code}`)}>编辑名称</Button>, !canWrite, readOnlyReason)}
        {row.status !== 'VOIDED' && (() => { const reason = canWrite ? voidReason(row.voidAvailability) : readOnlyReason; const disabled = !canWrite || !row.voidAvailability?.canVoid; const button = <Button type="link" danger disabled={disabled} onClick={() => voidAndPrepareRebuild(row)} {...testId(`catalog-dictionary-void-rebuild-${row.code}`)}>作废并重建</Button>; return withMutationReason(button, disabled, reason); })()}
        {!isProduction && <>{withMutationReason(<Button type="link" disabled={!canWrite || !canMoveDictionaryRow(rows, index, -1)} onClick={() => void moveRow(index, -1)} loading={reorderEntryState.isLoading}>上移</Button>, !canWrite, readOnlyReason)}{withMutationReason(<Button type="link" disabled={!canWrite || !canMoveDictionaryRow(rows, index, 1)} onClick={() => void moveRow(index, 1)} loading={reorderEntryState.isLoading}>下移</Button>, !canWrite, readOnlyReason)}</>}
      </Space>},
    ]} {...testId('catalog-dictionary-table')}/>} 
    {canWrite && <Form form={form} layout="inline" style={{marginTop: 16}} onValuesChange={() => lifecycle.setDirty(true)}>
      {rebuildFrom && <Alert type="warning" showIcon title="正在重建作废记录" description={`旧编码 ${rebuildFrom.code} 已永久保留，请输入新的唯一编码后创建。`} style={{width: '100%', marginBottom: 12}} {...testId('catalog-dictionary-rebuild-notice')}/>} 
      <Form.Item name="code" validateStatus={codeAvailability?.available === false ? 'error' : codeAvailability?.available === true ? 'success' : undefined} help={codeAvailability?.available === false ? <span>当前编码已被 <NameCodeText name={codeAvailability.occupiedBy?.name ?? '现有条目'} code={codeAvailability.occupiedBy?.code}/>{' '}占用。</span> : codeAvailability?.available === true ? '编码可用。' : undefined} rules={[{required: true, message: '请输入编码'}, {pattern: /^[A-Z0-9][A-Z0-9_-]*$/, message: '编码格式不正确'}]}><Input placeholder="编码（创建后不可修改）" onChange={() => setCodeAvailability(undefined)} onBlur={() => { void checkCodeAvailability(form.getFieldValue('code')); }} suffix={checkingCode ? '校验中…' : undefined} {...testId('catalog-dictionary-code')}/></Form.Item>
      {isProduction && <Form.Item name="tagKind" initialValue="PRODUCTION" rules={[{required: true, message: '请选择标签类型'}]}><Select style={{width: 140}} loading={manifestQuery.isLoading} options={productionTagKindOptions} placeholder="标签类型" {...testId('catalog-production-tag-kind')}/></Form.Item>}
      <Form.Item name="name" rules={[{required: true, message: '请输入名称'}]}><Input placeholder="名称" {...testId('catalog-dictionary-name')}/></Form.Item>
      <Button type="primary" loading={createEntryState.isLoading || createTagState.isLoading || lifecycle.submitting} onClick={() => void create()} {...testId(quickManage ? 'catalog-production-tag-quick-manage-create' : 'catalog-dictionary-create')}>{quickManage ? '创建并回填当前字段' : '新建'}</Button>
    </Form>}
    {!canWrite && <TypographyHint text="当前账号没有编辑商品库能力，只读查看字典。"/>}
  </Drawer>;
}

function TypographyHint({text}: {text: string}) { return <div style={{marginTop: 16, color: 'rgba(0,0,0,.45)'}}>{text}</div>; }

function withMutationReason(content: ReactNode, disabled: boolean, reason?: string) {
  if (!disabled || !reason) return content;
  return <Tooltip title={reason}><span style={{display: 'inline-block'}}>{content}</span></Tooltip>;
}
