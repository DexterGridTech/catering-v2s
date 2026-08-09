import {Alert, Button, Checkbox, Descriptions, Divider, Drawer, Empty, Input, List, Skeleton, Space, Steps, Tag, Typography} from 'antd';
import {adminWideDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {CatalogInventoryEnvelope, LocalCopyCandidatePage, LocalCopyPreflight, LocalCopyReadback} from '../../../app/api/generated/catalog-inventory-edge';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {
  decodeLocalCopyCandidatePage,
  decodeLocalCopyPreflight,
  decodeLocalCopyReadback,
  type LocalCopyPreflightData,
  type LocalCopyReadbackData,
  type LocalCopyScope,
  LOCAL_COPY_SCOPE_OPTIONS,
} from '../model/catalogModel';

type Props = {open: boolean; sourceItemCode: string; queryContext: OperationsPageProps['queryContext']; brandRef?: string; onClose: () => void; onCompleted: () => void};
type WizardStep = 'source-scope' | 'source-item' | 'copy-scope' | 'bom-mapping' | 'preview';

const LOCAL_COPY_STEPS: Array<{key: WizardStep; title: string}> = [
  {key: 'source-scope', title: '来源范围'},
  {key: 'source-item', title: '来源商品'},
  {key: 'copy-scope', title: '复制范围'},
  {key: 'bom-mapping', title: 'BOM映射'},
  {key: 'preview', title: '预览确认'},
];

const DEFAULT_LOCAL_COPY_SCOPES: LocalCopyScope[] = LOCAL_COPY_SCOPE_OPTIONS.map(({value}) => value);

const LOCAL_COPY_SCOPE_DEPENDENCIES: Array<[LocalCopyScope, LocalCopyScope[]]> = [
  ['SKU_BOM', ['SKU_STRUCTURE']],
  ['OPTION_VALUE_BOM', ['ORDER_OPTIONS']],
];

export function LocalCatalogCopyDrawer({open, sourceItemCode, queryContext, brandRef, onClose, onCompleted}: Props) {
  // The detail drawer opens this journey for the current item. The selected
  // candidate is therefore the source and sourceItemCode is the immutable target.
  const targetItemCode = sourceItemCode;
  const [step, setStep] = useState<WizardStep>('source-scope');
  const [selectedSourceItemCode, setSelectedSourceItemCode] = useState<string>();
  const [sourceKeyword, setSourceKeyword] = useState('');
  const [selectedSections, setSelectedSections] = useState<LocalCopyScope[]>(DEFAULT_LOCAL_COPY_SCOPES);
  const [preflight, setPreflight] = useState<LocalCopyPreflightData>();
  const [readback, setReadback] = useState<LocalCopyReadbackData>();
  const [referenceMappingsSnapshot, setReferenceMappingsSnapshot] = useState<LocalCopyPreflightData['referenceMappings']>([]);
  const [preflightPending, setPreflightPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [stale, setStale] = useState(false);
  const [problem, setProblem] = useState<string>();
  const submission = useSubmissionLifecycle();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: (next) => { if (!next) onClose(); },
    dirtyMessage: '本库复制预检和选择尚未提交。',
    dirtyGuardTestIds: {confirm: testId('catalog-local-copy-dirty-discard'), cancel: testId('catalog-local-copy-dirty-continue')},
    diagnosticOperationId: 'local-catalog-copy',
  });
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const candidateRequest = useMemo(() => {
    const query: Record<string, string> = {dataNodeRef: queryContext.scopeRef ?? ''};
    const keyword = sourceKeyword.trim();
    if (keyword) query.keyword = keyword;
    return catalogInventoryRtkRequest.getOperationsLocalCatalogCopyCandidates({}, {query, headers});
  }, [headers, queryContext.scopeRef, sourceKeyword]);
  const candidatesQuery = operationsRtk.useGetOperationsLocalCatalogCopyCandidatesQuery(candidateRequest, {skip: !open});
  const candidatePage = decodeLocalCopyCandidatePage(candidatesQuery.data as CatalogInventoryEnvelope<LocalCopyCandidatePage> | undefined);
  const candidates = useMemo(
    () => (candidatePage?.items ?? []).filter((item) => item.code !== targetItemCode),
    [candidatePage?.items, targetItemCode],
  );
  const [preflightCopy] = operationsRtk.usePreflightOperationsLocalCatalogCopyMutation();
  const [executeCopy, executeState] = operationsRtk.useExecuteOperationsLocalCatalogCopyMutation();

  useEffect(() => {
    if (!open) {
      setStep('source-scope');
      setSelectedSourceItemCode(undefined);
      setSourceKeyword('');
      setSelectedSections(DEFAULT_LOCAL_COPY_SCOPES);
      setPreflight(undefined);
      setReadback(undefined);
      setReferenceMappingsSnapshot([]);
      setPreflightPending(false);
      setConfirmed(false);
      setStale(false);
      setProblem(undefined);
      lifecycle.reset();
      submission.reset();
    }
  }, [lifecycle, open, submission]);

  const runPreflight = async () => {
    if (!selectedSourceItemCode || selectedSections.length === 0) {
      setProblem('请选择来源商品和至少一个复制范围。');
      return;
    }
    setProblem(undefined);
    setStale(false);
    setReadback(undefined);
    setPreflight(undefined);
    setConfirmed(false);
    setPreflightPending(true);
    setStep('bom-mapping');
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const response = await preflightCopy(catalogInventoryRtkRequest.preflightOperationsLocalCatalogCopy({}, {
        headers: {...(headers ?? {}), 'Idempotency-Key': globalThis.crypto.randomUUID()},
        body: {dataNodeRef, sourceItemCode: selectedSourceItemCode, targetItemCode, selectedSections},
      })).unwrap();
      const value = decodeLocalCopyPreflight(response as CatalogInventoryEnvelope<LocalCopyPreflight>);
      if (!value) throw new Error('COPY_PREFLIGHT_SHAPE_MISSING');
      setPreflight(value);
      setReferenceMappingsSnapshot(value.referenceMappings);
      lifecycle.setDirty(true);
    } catch (error) {
      setProblem(error instanceof Error && error.message === 'COPY_PREFLIGHT_SHAPE_MISSING' ? '本库复制预检返回不完整，请重试。' : operationsProblemOf(error).detail);
    } finally {
      setPreflightPending(false);
    }
  };

  const expectedVersions = (value: LocalCopyPreflightData) => {
    // Local preflight returns one version row for the selected source object;
    // that row carries both the source and current-target versions.
    const versionRow = value.objectVersions.find((row) => row.code === selectedSourceItemCode) ?? value.objectVersions[0];
    if (!versionRow) throw new Error('COPY_PREFLIGHT_VERSIONS_MISSING');
    return {expectedSourceVersion: versionRow.sourceVersion, expectedTargetVersion: versionRow.targetVersion};
  };

  const execute = async () => {
    if (!preflight || !selectedSourceItemCode || preflight.blockingCount > 0 || !confirmed) return;
    try {
      setProblem(undefined);
      const versions = expectedVersions(preflight);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const response = await executeCopy(catalogInventoryRtkRequest.executeOperationsLocalCatalogCopy({}, {
        headers: {...(headers ?? {}), 'Idempotency-Key': submission.getIdempotencyKey()},
        body: {dataNodeRef, sourceItemCode: selectedSourceItemCode, targetItemCode, preflightDigest: preflight.preflightDigest, ...versions},
      })).unwrap();
      const value = decodeLocalCopyReadback(response as CatalogInventoryEnvelope<LocalCopyReadback>);
      if (!value) throw new Error('COPY_READBACK_SHAPE_MISSING');
      lifecycle.reset();
      submission.reset();
      setReadback(value);
      // Keep the preview/readback open. The caller only closes after the user
      // explicitly acknowledges the owner result.
    } catch (error) {
      const feedback = operationsProblemOf(error);
      const errorCode = feedback.errorCode as string;
      if (error instanceof Error && error.message === 'COPY_PREFLIGHT_VERSIONS_MISSING') {
        setProblem('预检未返回来源或目标版本，请重新生成预检。');
        return;
      }
      if (error instanceof Error && error.message === 'COPY_READBACK_SHAPE_MISSING') {
        setProblem('复制已提交但 readback 返回不完整，请保留当前预览并重试读取。');
        return;
      }
      setProblem(feedback.detail);
      if (errorCode === 'STALE_COPY_PREFLIGHT') {
        // Keep the safe source/scope/mapping choices. Only the digest-bound
        // preflight is discarded; the user can regenerate it from this point.
        setPreflight(undefined);
        setReadback(undefined);
        setConfirmed(false);
        setStale(true);
        submission.markBusinessIntentChanged();
        setStep('bom-mapping');
      }
    }
  };

  const candidateLoading = candidatesQuery.isLoading || (candidatesQuery.isFetching && !candidatePage);
  const stepIndex = LOCAL_COPY_STEPS.findIndex(({key}) => key === step);
  const sourceScope = candidatePage?.sourceScope;
  const targetScope = candidatePage?.targetScope;
  const selectedSource = candidates.find((item) => item.code === selectedSourceItemCode);

  return <Drawer title="从已有商品复制配置" open={open} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} destroyOnHidden={false} maskClosable={!lifecycle.dirty} {...adminWideDrawerSurfaceProps} {...testId('catalog-local-copy-drawer')}>
    <Steps current={stepIndex} items={LOCAL_COPY_STEPS.map(({key, title}) => ({key, title}))} style={{marginBottom: 24}} {...testId('catalog-local-copy-steps')}/>
    {problem && <Alert type="error" showIcon title="本库复制未完成" description={problem} style={{marginBottom: 16}} {...testId('catalog-local-copy-problem')}/>} 
    {step === 'source-scope' && <SourceScopeStep sourceScope={sourceScope} targetScope={targetScope} targetItemCode={targetItemCode} onNext={() => setStep('source-item')} />}
    {step === 'source-item' && <SourceItemStep
      targetItemCode={targetItemCode}
      candidates={candidates}
      selectedSourceItemCode={selectedSourceItemCode}
      sourceKeyword={sourceKeyword}
      candidateLoading={candidateLoading}
      candidateError={candidatesQuery.isError}
      onRetry={() => void candidatesQuery.refetch()}
      onKeywordChange={(value) => { setSourceKeyword(value); setSelectedSourceItemCode(undefined); setPreflight(undefined); setReadback(undefined); setReferenceMappingsSnapshot([]); setStale(false); }}
      onSelect={(code) => { setSelectedSourceItemCode(code); setPreflight(undefined); setReadback(undefined); setReferenceMappingsSnapshot([]); setStale(false); lifecycle.setDirty(true); }}
      onBack={() => setStep('source-scope')}
      onNext={() => setStep('copy-scope')}
    />}
    {step === 'copy-scope' && <CopyScopeStep
      selectedSections={selectedSections}
      selectedSource={selectedSource}
      targetItemCode={targetItemCode}
      onChange={(values) => { setSelectedSections(values); setPreflight(undefined); setReadback(undefined); setReferenceMappingsSnapshot([]); setStale(false); lifecycle.setDirty(true); }}
      onBack={() => setStep('source-item')}
      onNext={() => void runPreflight()}
      loading={preflightPending}
    />}
    {step === 'bom-mapping' && <BomMappingStep
      preflight={preflight}
      stale={stale}
      referenceMappingsSnapshot={referenceMappingsSnapshot}
      loading={preflightPending}
      onBack={() => { setStep('copy-scope'); setPreflight(undefined); setConfirmed(false); }}
      onNext={() => setStep('preview')}
      onRetry={() => void runPreflight()}
    />}
    {step === 'preview' && <PreviewStep
      preflight={preflight}
      readback={readback}
      confirmed={confirmed}
      executeLoading={executeState.isLoading}
      onConfirm={setConfirmed}
      onBack={() => setStep('bom-mapping')}
      onExecute={() => void execute()}
      onComplete={onCompleted}
    />}
  </Drawer>;
}

function SourceScopeStep({sourceScope, targetScope, targetItemCode, onNext}: {sourceScope?: LocalCopyPreflightData['sourceScope']; targetScope?: LocalCopyPreflightData['targetScope']; targetItemCode: string; onNext: () => void}) {
  return <>
    <Alert type="info" showIcon title="同一商品库内复制" description="先确认来源与当前目标商品属于同一 owner 范围；不会新建商品，也不会跨 owner 或递归复制。" {...testId('catalog-local-copy-source-scope')}/>
    <Descriptions size="small" bordered column={1} style={{marginTop: 16}} items={[
      {key: 'source', label: '来源范围', children: sourceScope ? `${sourceScope.ownerType} / ${sourceScope.ownerRef} / ${sourceScope.brandRef}` : '当前商品库（候选接口返回后确认）'},
      {key: 'target', label: '目标范围', children: targetScope ? `${targetScope.ownerType} / ${targetScope.ownerRef} / ${targetScope.brandRef}` : '当前商品库'},
      {key: 'target-item', label: '当前目标商品', children: <NameCodeText name="当前打开商品" code={targetItemCode || '—'}/>},
    ]}/>
    <Space wrap style={{marginTop: 16}}><Button onClick={onNext} type="primary" {...testId('catalog-local-copy-source-scope-next')}>下一步：选择来源商品</Button></Space>
  </>;
}

function SourceItemStep({targetItemCode, candidates, selectedSourceItemCode, sourceKeyword, candidateLoading, candidateError, onRetry, onKeywordChange, onSelect, onBack, onNext}: {
  targetItemCode: string;
  candidates: LocalCopyCandidatePage['data']['items'];
  selectedSourceItemCode?: string;
  sourceKeyword: string;
  candidateLoading: boolean;
  candidateError: boolean;
  onRetry: () => void;
  onKeywordChange: (value: string) => void;
  onSelect: (code: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return <>
    <Typography.Paragraph type="secondary">来源商品只从当前商品库选择；当前打开的 {targetItemCode || '目标商品'} 不会出现在来源列表中。</Typography.Paragraph>
    <Input allowClear value={sourceKeyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="按来源商品名称或编码搜索" style={{marginBottom: 12}} {...testId('catalog-local-copy-source-keyword')}/>
    {candidateLoading && <Skeleton active {...testId('catalog-local-copy-candidates-loading')}/>} 
    {!candidateLoading && candidateError && <Alert type="error" title="来源商品加载失败" description="请重试候选查询；已选择的范围不会被清除。" action={<Button size="small" onClick={onRetry}>重试</Button>} {...testId('catalog-local-copy-candidates-error')}/>} 
    {!candidateLoading && !candidateError && !candidates.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前商品库没有可复制来源" {...testId('catalog-local-copy-candidates-empty')}/>} 
    {!candidateLoading && !candidateError && candidates.length > 0 && <List size="small" dataSource={candidates} {...testId('catalog-local-copy-candidates')} renderItem={(item) => <List.Item>
      <Checkbox checked={selectedSourceItemCode === item.code} onChange={() => onSelect(item.code)} {...testId(`catalog-local-copy-source-${item.code}`)}>
        <Space size={8}><NameCodeText name={item.name} code={item.code}/><Tag>{item.compatibilityHint || item.shapeKey}</Tag><Tag>{item.status}</Tag></Space>
      </Checkbox>
    </List.Item>}/>} 
    <Space wrap style={{marginTop: 16}}><Button onClick={onBack}>返回范围</Button><Button type="primary" disabled={!selectedSourceItemCode} onClick={onNext} {...testId('catalog-local-copy-source-item-next')}>下一步：选择复制范围</Button></Space>
  </>;
}

function CopyScopeStep({selectedSections, selectedSource, targetItemCode, onChange, onBack, onNext, loading}: {
  selectedSections: LocalCopyScope[];
  selectedSource?: LocalCopyCandidatePage['data']['items'][number];
  targetItemCode: string;
  onChange: (values: LocalCopyScope[]) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  const handleChange = (values: Array<string | number>) => {
    const next = new Set(values.filter((value): value is LocalCopyScope => typeof value === 'string' && LOCAL_COPY_SCOPE_OPTIONS.some((option) => option.value === value)));
    const removed = new Set(selectedSections.filter((scope) => !next.has(scope)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [scope, required] of LOCAL_COPY_SCOPE_DEPENDENCIES) {
        if (!next.has(scope) || !required.some((dependency) => removed.has(dependency))) continue;
        next.delete(scope);
        removed.add(scope);
        changed = true;
      }
    }
    // Removing a prerequisite must also remove its dependent section; adding a
    // dependent section brings its prerequisite back into the explicit scope
    // set. This keeps the selected scope executable instead of relying on a
    // hidden server-side implication.
    for (const [scope, required] of LOCAL_COPY_SCOPE_DEPENDENCIES) {
      if (!next.has(scope)) continue;
      required.forEach((dependency) => next.add(dependency));
    }
    onChange(LOCAL_COPY_SCOPE_OPTIONS.map(({value}) => value).filter((value) => next.has(value)));
  };
  return <>
    <Descriptions size="small" bordered column={2} items={[
      {key: 'source', label: '来源商品', children: selectedSource ? <NameCodeText name={selectedSource.name} code={selectedSource.code}/> : '—'},
      {key: 'target', label: '目标商品', children: <NameCodeText name="当前打开商品" code={targetItemCode || '—'}/>},
    ]}/>
    <Typography.Paragraph type="secondary" style={{marginTop: 16}}>依赖项会由 catalog owner 自动纳入预检；商品编码、owner、来源、生命周期、版本和外部身份不会被复制。</Typography.Paragraph>
    <Checkbox.Group value={selectedSections} onChange={handleChange} options={LOCAL_COPY_SCOPE_OPTIONS.map(({value, label}) => ({value, label}))} {...testId('catalog-local-copy-sections')}/>
    <Space wrap style={{marginTop: 16}}><Button onClick={onBack}>返回来源商品</Button><Button type="primary" disabled={!selectedSections.length || loading} loading={loading} onClick={onNext} {...testId('catalog-local-copy-preflight')}>生成预检</Button></Space>
  </>;
}

function BomMappingStep({preflight, stale, referenceMappingsSnapshot, loading, onBack, onNext, onRetry}: {
  preflight?: LocalCopyPreflightData;
  stale: boolean;
  referenceMappingsSnapshot: LocalCopyPreflightData['referenceMappings'];
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  if (loading) return <div {...testId('catalog-local-copy-preflight-loading')}><Skeleton active/><Skeleton active {...testId('catalog-local-copy-mapping-loading')}/></div>;
  if (!preflight) return <>
    {stale && <Alert type="warning" showIcon title="预检已失效" description="服务端拒绝了旧 digest；来源商品、复制范围和上次映射结果已保留，请重新生成预检。" {...testId('catalog-local-copy-stale')}/>} 
    {!stale && <Alert type="info" title="尚未生成预检" description="返回复制范围后重新生成预检。"/>}
    {referenceMappingsSnapshot.length > 0 && <LocalCopyArraySection title="上次预检的引用映射（待刷新）" rows={referenceMappingsSnapshot} locator="catalog-local-copy-reference-mappings-stale" renderRow={renderReferenceMappingRow}/>}
    <Space wrap style={{marginTop: 16}}><Button onClick={onBack}>返回复制范围</Button><Button type="primary" onClick={onRetry} {...testId('catalog-local-copy-preflight-retry')}>重新生成预检</Button></Space>
  </>;
  return <>
    <PreflightSummary preflight={preflight}/>
    <LocalCopyArraySection title="引用映射" rows={preflight.referenceMappings} locator="catalog-local-copy-reference-mappings" renderRow={renderReferenceMappingRow}/>
    <LocalCopyArraySection title="闭包对象" rows={preflight.closureItems} locator="catalog-local-copy-closure-items" renderRow={renderClosureRow}/>
    {preflight.blockingCount > 0 && <Alert type="error" showIcon title="存在阻断项" description="不可复制的结构必须先由 owner 解决；当前预检不能进入预览确认。" {...testId('catalog-local-copy-bom-blocked')}/>} 
    <Space wrap style={{marginTop: 16}}><Button onClick={onBack}>返回复制范围</Button><Button type="primary" disabled={preflight.blockingCount > 0} onClick={onNext} {...testId('catalog-local-copy-bom-mapping-next')}>下一步：预览确认</Button></Space>
  </>;
}

function PreviewStep({preflight, readback, confirmed, executeLoading, onConfirm, onBack, onExecute, onComplete}: {
  preflight?: LocalCopyPreflightData;
  readback?: LocalCopyReadbackData;
  confirmed: boolean;
  executeLoading: boolean;
  onConfirm: (value: boolean) => void;
  onBack: () => void;
  onExecute: () => void;
  onComplete: () => void;
}) {
  if (!preflight) return <Alert type="warning" title="预览不可用" description="请返回 BOM 映射并重新生成预检。"/>;
  return <>
    <PreflightSummary preflight={preflight}/>
    <Divider>预览明细</Divider>
    <LocalCopyArraySection title="将覆盖" rows={preflight.closureItems} locator="catalog-local-copy-closure-items" renderRow={renderClosureRow}/>
    <LocalCopyArraySection title="引用映射" rows={preflight.referenceMappings} locator="catalog-local-copy-reference-mappings" renderRow={renderReferenceMappingRow}/>
    <LocalCopyArraySection title="已跳过 / 不可复制" rows={preflight.compatibilityResults} locator="catalog-local-copy-compatibility-results" renderRow={renderCompatibilityRow}/>
    {!readback && <>
      <Checkbox checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} disabled={preflight.blockingCount > 0} {...testId('catalog-local-copy-confirm')}>
        我已核对覆盖字段、BOM 映射、跳过项和不可复制项，并确认提交当前版本。
      </Checkbox>
      <Space wrap style={{marginTop: 16}}><Button onClick={onBack}>返回 BOM 映射</Button><Button type="primary" disabled={preflight.blockingCount > 0 || !confirmed} loading={executeLoading} onClick={onExecute} {...testId('catalog-local-copy-execute')}>确认并复制</Button></Space>
    </>}
    {readback && <LocalCopyReadbackPanel readback={readback} onComplete={onComplete}/>} 
  </>;
}

function PreflightSummary({preflight}: {preflight: LocalCopyPreflightData}) {
  return <Descriptions size="small" bordered column={4} style={{marginBottom: 16}} items={[
    {key: 'selected', label: '选择', children: `${preflight.selectedCount}/${preflight.selectedLimit}`},
    {key: 'closure', label: '闭包', children: `${preflight.closureCount}/${preflight.closureLimit}`},
    {key: 'blocking', label: '阻断', children: preflight.blockingCount},
    {key: 'confirm', label: '确认项', children: preflight.confirmationRequiredCount},
  ]}/>
}

function LocalCopyArraySection<T>({title, rows, locator, renderRow}: {title: string; rows: T[]; locator: string; renderRow: (row: T) => ReactNode}) {
  return <section style={{marginBottom: 16}} {...testId(locator)}>
    <Typography.Title level={5} style={{marginBottom: 8}}>{title}</Typography.Title>
    {rows.length ? <List size="small" dataSource={rows} renderItem={(row) => <List.Item>{renderRow(row)}</List.Item>}/> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异"/>}
  </section>;
}

function renderClosureRow(row: LocalCopyPreflightData['closureItems'][number]) {
  return <Space size={8}><Tag>{row.objectType}</Tag><Typography.Text code>{row.code}</Typography.Text><Typography.Text>{row.name}</Typography.Text><Tag color={row.action === 'SKIP' ? 'gold' : 'blue'}>{row.action}</Tag></Space>;
}

function renderReferenceMappingRow(row: LocalCopyPreflightData['referenceMappings'][number]) {
  return <Space size={8} wrap>
    <Tag>{row.objectType}</Tag>
    <Typography.Text code>{row.targetCode}</Typography.Text>
    {row.targetSkuCode && <Tag>SKU：{row.targetSkuCode}</Tag>}
    {row.targetOptionValueCode && <Tag>选项：{row.targetOptionValueCode}</Tag>}
  </Space>;
}

function renderCompatibilityRow(row: LocalCopyPreflightData['compatibilityResults'][number]) {
  return <Space size={8}><Tag>{row.objectType}</Tag><Tag color={mappingColor(row.result)}>{row.result}</Tag><Typography.Text>{row.reason || '—'}</Typography.Text></Space>;
}

function mappingColor(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('block') || normalized.includes('不可') || normalized.includes('fail')) return 'red';
  if (normalized.includes('skip') || normalized.includes('未解') || normalized.includes('warn')) return 'gold';
  return 'green';
}

function LocalCopyReadbackPanel({readback, onComplete}: {readback: LocalCopyReadbackData; onComplete: () => void}) {
  return <Alert type="success" showIcon title="配置已复制" description={<>
    <Typography.Paragraph type="secondary" style={{marginTop: 8}}>catalog owner 已完成版本复核；以下 readback 保留在当前 Drawer 中供核对。点击完成后返回当前目标商品详情。</Typography.Paragraph>
    <Descriptions size="small" column={2} items={[
      {key: 'created', label: '新建', children: <ReadbackRows rows={readback.created} locator="catalog-local-copy-created"/>},
      {key: 'reused', label: '复用', children: <ReadbackRows rows={readback.reused} locator="catalog-local-copy-reused"/>},
      {key: 'skipped', label: '跳过', children: <ReadbackRows rows={readback.skipped} locator="catalog-local-copy-skipped"/>},
      {key: 'reference-mappings', label: '引用映射', children: <ReadbackMappings rows={readback.referenceMappings}/>} ,
      {key: 'targets', label: '目标版本', children: <ReadbackVersions rows={readback.targetVersions}/>} ,
      {key: 'owners', label: 'owner 回读', children: <ReadbackOwners rows={readback.ownerReadbacks}/>} ,
    ]}/>
  </>} action={<Button onClick={onComplete} {...testId('catalog-local-copy-open-target')}>完成并返回目标商品</Button>} {...testId('catalog-local-copy-result')}/>;
}

function ReadbackRows({rows, locator}: {rows: Array<{objectType: string; code: string}>; locator: string}) {
  return <span {...testId(locator)}>{rows.length ? rows.map((row) => `${row.objectType}/${row.code}`).join('、') : '—'}</span>;
}

function ReadbackMappings({rows}: {rows: LocalCopyReadbackData['referenceMappings']}) {
  return <span {...testId('catalog-local-copy-readback-reference-mappings')}>{rows.length ? rows.map((row) => referenceMappingLabel(row)).join('、') : '—'}</span>;
}

function ReadbackVersions({rows}: {rows: LocalCopyReadbackData['targetVersions']}) {
  return <span {...testId('catalog-local-copy-target-versions')}>{rows.length ? rows.map((row) => `v${row.version}`).join('、') : '—'}</span>;
}

function referenceMappingLabel(row: LocalCopyPreflightData['referenceMappings'][number]) {
  return [row.objectType, row.targetCode, row.targetSkuCode && `SKU：${row.targetSkuCode}`, row.targetOptionValueCode && `选项：${row.targetOptionValueCode}`].filter(Boolean).join(' / ');
}

function ReadbackOwners({rows}: {rows: LocalCopyReadbackData['ownerReadbacks']}) {
  return <span {...testId('catalog-local-copy-owner-readbacks')}>{rows.length ? rows.map((row) => `${row.owner} / ${row.status} / v${row.version}`).join('、') : '—'}</span>;
}
