import {Alert, Button, Checkbox, Descriptions, Drawer, Empty, Input, List, Skeleton, Space, Steps, Tabs, Tag, Typography} from 'antd';
import {adminWideDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {BrandCopyCandidatePage, CatalogInventoryEnvelope} from '../../../app/api/generated/catalog-inventory-edge';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {catalogCopyVersionRows, decodeBrandCopyReadback, decodeBrandCopyScopes, decodeCandidates, decodePreflight, type BrandCopyReadback, type BrandCopyScope, type CatalogCopyReferenceMapping, type CopyPreflight} from '../model/catalogModel';

type Props = {open: boolean; queryContext: OperationsPageProps['queryContext']; brandRef?: string; onClose: () => void; onCompleted: () => void};

export function BrandCatalogCopyDrawer({open, queryContext, brandRef, onClose, onCompleted}: Props) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [preflight, setPreflight] = useState<CopyPreflight>();
  const [readback, setReadback] = useState<BrandCopyReadback>();
  const [confirmed, setConfirmed] = useState(false);
  const [problem, setProblem] = useState<string>();
  const submission = useSubmissionLifecycle();
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const candidatesRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsBrandCatalogCopyCandidates({}, {query: {dataNodeRef: queryContext.scopeRef ?? '', ...(keyword.trim() ? {keyword: keyword.trim()} : {})}, headers}), [headers, keyword, queryContext.scopeRef]);
  const candidatesQuery = operationsRtk.useGetOperationsBrandCatalogCopyCandidatesQuery(candidatesRequest, {skip: !open});
  const candidates = decodeCandidates(candidatesQuery.data as CatalogInventoryEnvelope | undefined);
  const scopes = decodeBrandCopyScopes(candidatesQuery.data as CatalogInventoryEnvelope<BrandCopyCandidatePage> | undefined);
  const [preflightCopy, preflightState] = operationsRtk.usePreflightOperationsBrandCatalogCopyMutation();
  const [executeCopy, executeState] = operationsRtk.useExecuteOperationsBrandCatalogCopyMutation();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '复制预检和已选择商品尚未提交。', dirtyGuardTestIds: {confirm: testId('catalog-copy-dirty-discard'), cancel: testId('catalog-copy-dirty-continue')}, diagnosticOperationId: 'brand-catalog-copy'});
  useEffect(() => { if (!open) { setStep(0); setSelected([]); setKeyword(''); setPreflight(undefined); setReadback(undefined); setConfirmed(false); setProblem(undefined); lifecycle.reset(); submission.reset(); } }, [lifecycle, open, submission]);

  const runPreflight = async () => {
    setProblem(undefined);
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const response = await preflightCopy(catalogInventoryRtkRequest.preflightOperationsBrandCatalogCopy({}, {headers: {...(headers ?? {}), 'Idempotency-Key': globalThis.crypto.randomUUID()}, body: {dataNodeRef, selectedItemCodes: selected, targetDataNodeRef: dataNodeRef}})).unwrap();
      const next = decodePreflight(response as CatalogInventoryEnvelope);
      if (!next) throw new Error('COPY_PREFLIGHT_SHAPE_MISSING');
      setPreflight(next); setConfirmed(false); setReadback(undefined); setStep(2); lifecycle.setDirty(true);
    } catch (error) { setProblem(error instanceof Error && error.message === 'COPY_PREFLIGHT_SHAPE_MISSING' ? '复制预检返回不完整，请重试。' : operationsProblemOf(error).detail); }
  };
  const execute = async () => {
    if (!preflight) return;
    setProblem(undefined);
    try {
      const versionRows = catalogCopyVersionRows(preflight.objectVersions);
      if (!versionRows.length) throw new Error('COPY_PREFLIGHT_CATALOG_VERSIONS_MISSING');
      const expectedSourceVersion = Math.max(...versionRows.map((row) => Number(row.sourceVersion ?? 0)), 0);
      const expectedTargetVersion = Math.max(...versionRows.map((row) => Number(row.targetVersion ?? 0)), 0);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const response = await executeCopy(catalogInventoryRtkRequest.executeOperationsBrandCatalogCopy({}, {headers: {...(headers ?? {}), 'Idempotency-Key': submission.getIdempotencyKey()}, body: {dataNodeRef, selectedItemCodes: selected, targetDataNodeRef: dataNodeRef, preflightDigest: preflight.preflightDigest, expectedSourceVersion, expectedTargetVersion}})).unwrap();
      const next = decodeBrandCopyReadback(response as CatalogInventoryEnvelope);
      if (!next) throw new Error('COPY_READBACK_SHAPE_MISSING');
      lifecycle.reset(); submission.reset(); setReadback(next); setStep(4);
    } catch (error) {
      const feedback = operationsProblemOf(error);
      setProblem(error instanceof Error && error.message === 'COPY_PREFLIGHT_CATALOG_VERSIONS_MISSING' ? '预检未返回目录来源或目标版本，请重新生成预检。' : feedback.detail);
      if ((feedback.errorCode as string) === 'STALE_COPY_PREFLIGHT') { setConfirmed(false); setStep(2); }
    }
  };

  return <Drawer title="从品牌复制到门店" open={open} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} destroyOnHidden={false} maskClosable={!lifecycle.dirty} {...adminWideDrawerSurfaceProps} {...testId('catalog-brand-copy-drawer')}>
    <Steps current={step} items={[{title: '来源范围'}, {title: '选择商品'}, {title: '差异预检'}, {title: '确认执行'}, {title: '复制结果'}]} style={{marginBottom: 24}}/>
    {problem && <Alert type="error" showIcon title="品牌复制未完成" description={problem} style={{marginBottom: 16}} {...testId('catalog-copy-problem')}/>} 
    {step === 0 && <>
      <Descriptions size="small" bordered column={1} items={[{key: 'source', label: '来源范围', children: scopes.sourceScope ? scopeText(scopes.sourceScope) : '由组织事实确定'}, {key: 'target', label: '目标范围', children: scopes.targetScope ? scopeText(scopes.targetScope) : '当前门店'}]}/>
      <Input allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="按商品名称或编码搜索品牌商品" style={{marginTop: 16}} {...testId('catalog-brand-copy-source-keyword')}/>
      {candidatesQuery.isLoading ? <Skeleton active/> : candidates.length ? <Checkbox.Group value={selected} onChange={(values) => { setSelected(values as string[]); lifecycle.setDirty(true); submission.markBusinessIntentChanged(); }} style={{width: '100%'}}>
        <List dataSource={candidates} renderItem={(item) => <List.Item><Checkbox value={item.code} {...testId(`catalog-copy-candidate-${item.code}`)}><NameCodeText name={item.name} code={item.code}/> <Tag>{item.shapeKey}</Tag></Checkbox></List.Item>}/>
      </Checkbox.Group> : <Empty description="当前品牌没有可复制商品"/>}
      <Space style={{marginTop: 16}}><Button onClick={lifecycle.requestClose}>取消</Button><Button type="primary" disabled={!selected.length} onClick={() => setStep(1)} {...testId('catalog-brand-copy-selection-next')}>下一步：确认范围</Button></Space>
    </>}
    {step === 1 && <>
      <Alert type="info" showIcon title="来源与目标已由组织事实确定" description="品牌商品只从当前总公司+品牌复制到当前门店，不提供手工改写来源选择器。"/>
      <List size="small" dataSource={selected.map((code) => candidates.find((item) => item.code === code)).filter(Boolean)} renderItem={(item) => item ? <List.Item><NameCodeText name={item.name} code={item.code}/> <Tag>{item.shapeKey}</Tag></List.Item> : null}/>
      <Space style={{marginTop: 16}}><Button onClick={() => setStep(0)}>返回选择</Button><Button type="primary" loading={preflightState.isLoading} onClick={() => void runPreflight()} {...testId('catalog-copy-preflight')}>生成差异预检</Button></Space>
    </>}
    {step === 2 && preflight && <>
      <Descriptions size="small" bordered column={4} items={[{key: 'selected', label: '起始商品', children: `${preflight.selectedCount}/${preflight.selectedLimit}`}, {key: 'closure', label: '闭包对象', children: `${preflight.closureCount}/${preflight.closureLimit}`}, {key: 'blocking', label: '阻断', children: preflight.blockingCount}, {key: 'confirmations', label: '需确认', children: preflight.confirmationRequiredCount}]}/>
      <Tabs style={{marginTop: 16}} items={[
        {key: 'items', label: '商品与结构', children: <ClosureItemList rows={preflight.closureItems}/>},
        {key: 'mapping', label: '引用映射', children: <ReferenceMappingList rows={preflight.referenceMappings}/>},
        {key: 'inventory', label: '库存与BOM', children: <CompatibilityList rows={preflight.compatibilityResults.filter((row) => row.objectType.includes('STOCK') || row.objectType.includes('BOM'))}/>},
        {key: 'production', label: '生产提示', children: <CompatibilityList rows={preflight.compatibilityResults.filter((row) => row.objectType.includes('PRODUCTION'))}/>},
      ]} {...testId('catalog-inventory-copy-preflight')}/>
      <Checkbox checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); submission.markBusinessIntentChanged(); }} disabled={preflight.blockingCount > 0} {...testId('catalog-copy-confirm')}>我已核对所有可确认差异与引用映射</Checkbox>
      {preflight.blockingCount > 0 && <Alert type="warning" showIcon title="仍有阻断项，清零后才能执行复制" style={{marginTop: 12}}/>}
      <Space style={{marginTop: 16}}><Button onClick={() => { setStep(1); setPreflight(undefined); setConfirmed(false); }}>返回选择</Button><Button type="primary" disabled={preflight.blockingCount > 0} onClick={() => setStep(3)} {...testId('catalog-brand-copy-preflight-next')}>下一步：确认执行</Button></Space>
    </>}
    {step === 3 && preflight && <>
      <Descriptions size="small" bordered column={2} items={[{key: 'selected', label: '起始商品', children: `${preflight.selectedCount}/${preflight.selectedLimit}`}, {key: 'closure', label: '闭包对象', children: `${preflight.closureCount}/${preflight.closureLimit}`}, {key: 'digest', label: '预检摘要', children: preflight.preflightDigest}]}/>
      <Checkbox checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); submission.markBusinessIntentChanged(); }} disabled={preflight.blockingCount > 0} {...testId('catalog-copy-confirm')}>我已核对所有可确认差异与引用映射</Checkbox>
      <Space style={{marginTop: 16}}><Button onClick={() => setStep(2)}>返回预检</Button><Button type="primary" disabled={preflight.blockingCount > 0 || !confirmed} loading={executeState.isLoading} onClick={() => void execute()} {...testId('catalog-copy-execute')}>确认并原子复制</Button></Space>
    </>}
    {step === 4 && readback && <>
      <Alert type="success" showIcon title="品牌商品已复制" description="目录、库存定义、BOM、生产提示与引用已按 owner readback 完成处理。" {...testId('catalog-copy-result')}/>
      <Tabs style={{marginTop: 16}} items={[{key: 'created', label: `新建 ${readback.created.length}`, children: <ReadbackRows rows={readback.created}/>}, {key: 'reused', label: `复用 ${readback.reused.length}`, children: <ReadbackRows rows={readback.reused}/>}, {key: 'mapping', label: `引用映射 ${readback.referenceMappings.length}`, children: <ReferenceMappingList rows={readback.referenceMappings}/>}, {key: 'owners', label: 'Owner readback', children: <OwnerReadbackList rows={readback.ownerReadbacks}/>}]}/>
      <Button type="primary" onClick={() => { onCompleted(); onClose(); }} {...testId('catalog-copy-result-close')}>完成</Button>
    </>}
  </Drawer>;
}

function scopeText(scope: BrandCopyScope) { return `${scope.ownerType} / ${scope.ownerRef} / ${scope.brandRef}`; }

function ClosureItemList({rows}: {rows: CopyPreflight['closureItems']}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异"/>;
  return <List size="small" dataSource={rows} renderItem={(row) => <List.Item><Space size={8}><Tag>{row.objectType}</Tag><Typography.Text code>{row.code}</Typography.Text><Typography.Text>{row.name}</Typography.Text><Tag>{row.action}</Tag></Space></List.Item>}/>;
}

function CompatibilityList({rows}: {rows: CopyPreflight['compatibilityResults']}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异"/>;
  return <List size="small" dataSource={rows} renderItem={(row) => <List.Item><Space size={8}><Tag>{row.objectType}</Tag><Tag>{row.result}</Tag><Typography.Text>{row.reason || '—'}</Typography.Text></Space></List.Item>}/>;
}

function ReferenceMappingList({rows}: {rows: CatalogCopyReferenceMapping[]}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异"/>;
  return <List size="small" dataSource={rows} renderItem={(row) => <List.Item><Space size={8} wrap><Tag>{row.objectType}</Tag><Typography.Text code>{row.targetCode}</Typography.Text>{row.targetSkuCode && <Tag>SKU：{row.targetSkuCode}</Tag>}{row.targetOptionValueCode && <Tag>选项：{row.targetOptionValueCode}</Tag>}</Space></List.Item>}/>;
}

function ReadbackRows({rows}: {rows: Array<{objectType: string; code: string}>}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异"/>;
  return <List size="small" dataSource={rows} renderItem={(row) => <List.Item><Space size={8}><Tag>{row.objectType}</Tag><Typography.Text code>{row.code}</Typography.Text></Space></List.Item>}/>;
}

function OwnerReadbackList({rows}: {rows: BrandCopyReadback['ownerReadbacks']}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异"/>;
  return <List size="small" dataSource={rows} renderItem={(row) => <List.Item><Space size={8}><Typography.Text>{row.owner}</Typography.Text><Tag>{row.status}</Tag><Typography.Text type="secondary">v{row.version}</Typography.Text></Space></List.Item>}/>;
}
