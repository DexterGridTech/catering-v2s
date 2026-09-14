import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  List,
  Radio,
  Skeleton,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import {adminWideDrawerSurfaceProps, NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import type {ReactNode} from 'react';
import type {LocalCopyCandidatePage} from '../../../../app/api/generated/catalog-inventory-edge';
import {catalogEnumLabel} from '../../model/catalogManifestLabels';
import {
  catalogCopyActionLabel,
  catalogCopyObjectTypeLabel,
  catalogCopyReasonLabel,
  catalogCopyScopeLabel,
  copyConfirmationKey,
  copyConfirmationLabel,
  copyConfirmationRows,
} from '../../model/catalog/catalogCopyModel';
import {catalogTestIdControls, catalogTestIds} from '../../catalogTestIds';
import {CatalogLifecycleStatusTag} from '../CatalogLifecycleStatusTag';
import {
  LOCAL_COPY_SCOPE_DEPENDENCIES,
  LOCAL_COPY_SCOPE_DESCRIPTIONS,
  LOCAL_COPY_STEPS,
  LOCAL_COPY_SCOPE_VALUES,
  mappingColor,
  referenceMappingLabel,
  type LocalCopyPreflightData,
  type LocalCopyReadbackData,
  type LocalCopyScope,
} from './localCatalogCopyModel';
import type {CatalogManifest, LocalCatalogCopyViewModel} from './LocalCatalogCopyDrawer';

export function LocalCatalogCopyView({viewModel}: {viewModel: LocalCatalogCopyViewModel}) {
  const {
    open,
    lifecycle,
    afterOpenChange,
    step,
    stepIndex,
    problem,
    targetItemName,
    sourceScope,
    targetScope,
    manifest,
    manifestQuery,
    candidates,
    selectedSource,
    selectedSourceItemCode,
    sourceKeyword,
    candidateLoading,
    candidateState,
    candidatesQuery,
    selectedSections,
    preflight,
    readback,
    referenceMappingsSnapshot,
    stale,
    preflightPending,
    localCopyScopeOptions,
    confirmationRows,
    confirmationCountMatches,
    allConfirmationsHandled,
    confirmedCompatibilityKeys,
    executeState,
    setStep,
    setSourceKeyword,
    setSelectedSourceItemCode,
    setSelectedSections,
    setPreflight,
    setReadback,
    setReferenceMappingsSnapshot,
    setStale,
    setConfirmedCompatibilityKeys,
    runPreflight,
    execute,
  } = viewModel;

  return (
    <Drawer
      title="从已有商品复制配置"
      open={open}
      onClose={lifecycle.requestClose}
      afterOpenChange={afterOpenChange}
      destroyOnHidden={false}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      {...testId(catalogTestIds.static.localCopyDrawer)}
    >
      <Steps
        current={stepIndex}
        items={LOCAL_COPY_STEPS.map(({key, title}) => ({key, title}))}
        style={{marginBottom: 24}}
        {...testId(catalogTestIds.static.localCopySteps)}
      />
      {problem && (
        <Alert
          type="error"
          showIcon
          title="本库复制未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.localCopyProblem)}
        />
      )}
      {step === 'source-scope' && (
        <SourceScopeStep
          sourceScope={sourceScope}
          targetScope={targetScope}
          targetItemName={targetItemName}
          onNext={() => setStep('source-item')}
        />
      )}
      {step === 'source-item' && (
        <SourceItemStep
          manifest={manifest}
          targetItemName={targetItemName}
          candidates={candidates}
          selectedSourceItemCode={selectedSourceItemCode}
          sourceKeyword={sourceKeyword}
          candidateLoading={candidateLoading}
          candidateError={candidatesQuery.isError}
          hasNext={Boolean(candidateState.nextCursor)}
          nextLoading={candidatesQuery.isFetching}
          onRetry={() => void candidatesQuery.refetch()}
          onNextPage={() => candidateState.loadNext(candidatesQuery.isFetching)}
          onKeywordChange={value => {
            setSourceKeyword(value);
            setSelectedSourceItemCode(undefined);
            setPreflight(undefined);
            setReadback(undefined);
            setReferenceMappingsSnapshot([]);
            setStale(false);
          }}
          onSelect={code => {
            setSelectedSourceItemCode(code);
            setPreflight(undefined);
            setReadback(undefined);
            setReferenceMappingsSnapshot([]);
            setStale(false);
            lifecycle.setDirty(true);
          }}
          onBack={() => setStep('source-scope')}
          onNext={() => setStep('copy-scope')}
        />
      )}
      {step === 'copy-scope' && (
        <CopyScopeStep
          selectedSections={selectedSections}
          selectedSource={selectedSource}
          targetItemName={targetItemName}
          onChange={values => {
            setSelectedSections(values);
            setPreflight(undefined);
            setReadback(undefined);
            setReferenceMappingsSnapshot([]);
            setStale(false);
            lifecycle.setDirty(true);
          }}
          onBack={() => setStep('source-item')}
          onNext={() => void runPreflight()}
          loading={preflightPending || manifestQuery.isLoading}
          scopeOptions={localCopyScopeOptions}
          scopeOptionsReady={localCopyScopeOptions.length === LOCAL_COPY_SCOPE_VALUES.length}
          scopeOptionsError={manifestQuery.isError}
        />
      )}
      {step === 'bom-mapping' && (
        <BomMappingStep
          preflight={preflight}
          stale={stale}
          referenceMappingsSnapshot={referenceMappingsSnapshot}
          loading={preflightPending}
          onBack={() => {
            setStep('copy-scope');
            setPreflight(undefined);
            setConfirmedCompatibilityKeys([]);
          }}
          onNext={() => setStep('preview')}
          onRetry={() => void runPreflight()}
        />
      )}
      {step === 'preview' && (
        <PreviewStep
          preflight={preflight}
          readback={readback}
          confirmedCompatibilityKeys={confirmedCompatibilityKeys}
          confirmationRows={confirmationRows}
          confirmationCountMatches={confirmationCountMatches}
          allConfirmationsHandled={allConfirmationsHandled}
          onToggleConfirmation={(key, checked) => {
            setConfirmedCompatibilityKeys(current =>
              checked ? [...new Set([...current, key])] : current.filter(value => value !== key),
            );
          }}
          executeLoading={executeState.isLoading}
          onBack={() => setStep('bom-mapping')}
          onExecute={() => void execute()}
          onComplete={lifecycle.closeAfterSuccess}
        />
      )}
    </Drawer>
  );
}

function SourceScopeStep({
  sourceScope,
  targetScope,
  targetItemName,
  onNext,
}: {
  sourceScope?: LocalCopyPreflightData['sourceScope'];
  targetScope?: LocalCopyPreflightData['targetScope'];
  targetItemName: string;
  onNext: () => void;
}) {
  return (
    <>
      <Alert
        type="info"
        showIcon
        title="同一商品库内复制"
        description="仅在当前商品库内复制；不会新建商品或复制其他商品库内容。"
        {...testId(catalogTestIds.static.localCopySourceScope)}
      />
      <Descriptions
        size="small"
        bordered
        column={1}
        style={{marginTop: 16}}
        items={[
          {
            key: 'source',
            label: '来源范围',
            children: sourceScope ? catalogCopyScopeLabel(sourceScope.ownerType) : '当前商品库（确认中）',
          },
          {
            key: 'target',
            label: '目标范围',
            children: targetScope ? catalogCopyScopeLabel(targetScope.ownerType) : '当前商品库',
          },
          {
            key: 'target-item',
            label: '当前目标商品',
            children: targetItemName,
          },
        ]}
      />
      <Space wrap style={{marginTop: 16}}>
        <Button onClick={onNext} type="primary" {...testId(catalogTestIds.static.localCopySourceScopeNext)}>
          下一步：选择来源商品
        </Button>
      </Space>
    </>
  );
}

function SourceItemStep({
  manifest,
  targetItemName,
  candidates,
  selectedSourceItemCode,
  sourceKeyword,
  candidateLoading,
  candidateError,
  hasNext,
  nextLoading,
  onRetry,
  onKeywordChange,
  onSelect,
  onBack,
  onNext,
  onNextPage,
}: {
  manifest?: CatalogManifest;
  targetItemName: string;
  candidates: LocalCopyCandidatePage['data']['items'];
  selectedSourceItemCode?: string;
  sourceKeyword: string;
  candidateLoading: boolean;
  candidateError: boolean;
  hasNext: boolean;
  nextLoading: boolean;
  onRetry: () => void;
  onKeywordChange: (value: string) => void;
  onSelect: (code: string) => void;
  onBack: () => void;
  onNext: () => void;
  onNextPage: () => void;
}) {
  return (
    <>
      <Typography.Paragraph type="secondary">
        来源商品只从当前商品库选择；当前打开的“{targetItemName}”{' '}
        不会出现在来源列表中，且只显示与目标商品相同形态的来源。
      </Typography.Paragraph>
      <Input
        allowClear
        value={sourceKeyword}
        onChange={event => onKeywordChange(event.target.value)}
        placeholder="按来源商品名称或编码搜索"
        style={{marginBottom: 12}}
        {...testId(catalogTestIds.static.localCopySourceKeyword)}
      />
      {candidateLoading && <Skeleton active {...testId(catalogTestIds.static.localCopyCandidatesLoading)} />}
      {!candidateLoading && candidateError && (
        <Alert
          type="error"
          title="来源商品加载失败"
          description="请重试候选查询；已选择的范围不会被清除。"
          action={
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          }
          {...testId(catalogTestIds.static.localCopyCandidatesError)}
        />
      )}
      {!candidateLoading && !candidateError && !candidates.length && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前商品库没有可复制来源"
          {...testId(catalogTestIds.static.localCopyCandidatesEmpty)}
        />
      )}
      {!candidateLoading && !candidateError && candidates.length > 0 && (
        <List
          size="small"
          dataSource={candidates}
          {...testId(catalogTestIds.static.localCopyCandidates)}
          renderItem={item => (
            <List.Item>
              <Radio
                checked={selectedSourceItemCode === item.code}
                onChange={() => onSelect(item.code)}
                {...testId(catalogTestIdControls.copy.sourceRow(item.code))}
              >
                <Space size={8} wrap>
                  <NameCodeText name={item.name} code={item.code} />
                  <Tag>形态：{catalogEnumLabel(manifest, 'shapeKey', item.shapeKey)}</Tag>
                  {item.compatibilityHint && item.compatibilityHint !== 'REVIEW_REQUIRED' && (
                    <Tag>兼容性：{item.compatibilityHint}</Tag>
                  )}
                  <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={item.status} />
                </Space>
              </Radio>
            </List.Item>
          )}
        />
      )}
      {!candidateLoading && !candidateError && hasNext && (
        <Button
          type="link"
          loading={nextLoading}
          onClick={onNextPage}
          {...testId(catalogTestIds.static.localCopyCandidatesNext)}
        >
          加载更多
        </Button>
      )}
      <Space wrap style={{marginTop: 16}}>
        <Button onClick={onBack}>返回范围</Button>
        <Button
          type="primary"
          disabled={!selectedSourceItemCode}
          onClick={onNext}
          {...testId(catalogTestIds.static.localCopySourceItemNext)}
        >
          下一步：选择复制范围
        </Button>
      </Space>
    </>
  );
}

function CopyScopeStep({
  selectedSections,
  selectedSource,
  targetItemName,
  onChange,
  onBack,
  onNext,
  loading,
  scopeOptions,
  scopeOptionsReady,
  scopeOptionsError,
}: {
  selectedSections: LocalCopyScope[];
  selectedSource?: LocalCopyCandidatePage['data']['items'][number];
  targetItemName: string;
  onChange: (values: LocalCopyScope[]) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  scopeOptions: Array<{value: LocalCopyScope; label: string; disabled?: boolean; reason?: string}>;
  scopeOptionsReady: boolean;
  scopeOptionsError: boolean;
}) {
  const handleChange = (values: Array<string | number>) => {
    const next = new Set(
      values.filter(
        (value): value is LocalCopyScope =>
          typeof value === 'string' && LOCAL_COPY_SCOPE_VALUES.includes(value as LocalCopyScope),
      ),
    );
    const removed = new Set(selectedSections.filter(scope => !next.has(scope)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [scope, required] of LOCAL_COPY_SCOPE_DEPENDENCIES) {
        if (!next.has(scope) || !required.some(dependency => removed.has(dependency))) continue;
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
      required.forEach(dependency => next.add(dependency));
    }
    onChange(LOCAL_COPY_SCOPE_VALUES.filter(value => next.has(value)));
  };
  const handleOptionChange = (value: LocalCopyScope, checked: boolean) => {
    handleChange(checked ? [...selectedSections, value] : selectedSections.filter(current => current !== value));
  };
  return (
    <>
      <Descriptions
        size="small"
        bordered
        column={2}
        items={[
          {
            key: 'source',
            label: '来源商品',
            children: selectedSource ? <NameCodeText name={selectedSource.name} code={selectedSource.code} /> : '—',
          },
          {
            key: 'target',
            label: '目标商品',
            children: targetItemName,
          },
        ]}
      />
      <Typography.Paragraph type="secondary" style={{marginTop: 16}}>
        默认只复制基础资料；相关内容会在检查时一并处理。商品编码、来源和历史记录不会被复制。
      </Typography.Paragraph>
      {scopeOptionsError && (
        <Alert
          type="error"
          showIcon
          title="复制范围加载失败"
          description="未能读取可复制内容，请重试。"
          style={{marginBottom: 12}}
          {...testId(catalogTestIds.static.localCopyScopeOptionsError)}
        />
      )}
      <Space
        direction="vertical"
        size={8}
        style={{display: 'flex'}}
        {...testId(catalogTestIds.static.localCopySections)}
      >
        {scopeOptions.map(option => (
          <div key={option.value}>
            <Checkbox
              checked={selectedSections.includes(option.value)}
              disabled={option.disabled}
              onChange={event => handleOptionChange(option.value, event.target.checked)}
            >
              {option.label}
            </Checkbox>
            <Typography.Text
              type="secondary"
              style={{display: 'block', marginInlineStart: 24}}
              {...testId(catalogTestIdControls.copy.scopeDescription(option.value))}
            >
              {LOCAL_COPY_SCOPE_DESCRIPTIONS[option.value]}
            </Typography.Text>
            {option.reason && (
              <Typography.Text
                type="warning"
                style={{display: 'block', marginInlineStart: 24}}
                {...testId(catalogTestIdControls.copy.scopeReason(option.value))}
              >
                {option.reason}
              </Typography.Text>
            )}
          </div>
        ))}
      </Space>
      <Space wrap style={{marginTop: 16}}>
        <Button onClick={onBack}>返回来源商品</Button>
        <Button
          type="primary"
          disabled={!scopeOptionsReady || !selectedSections.length || loading}
          loading={loading}
          onClick={onNext}
          {...testId(catalogTestIds.static.localCopyPreflight)}
        >
          检查影响
        </Button>
      </Space>
    </>
  );
}

function BomMappingStep({
  preflight,
  stale,
  referenceMappingsSnapshot,
  loading,
  onBack,
  onNext,
  onRetry,
}: {
  preflight?: LocalCopyPreflightData;
  stale: boolean;
  referenceMappingsSnapshot: LocalCopyPreflightData['referenceMappings'];
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <div {...testId(catalogTestIds.static.localCopyPreflightLoading)}>
        <Skeleton active />
        <Skeleton active {...testId(catalogTestIds.static.localCopyMappingLoading)} />
      </div>
    );
  if (!preflight)
    return (
      <>
        {stale && (
          <Alert
            type="warning"
            showIcon
            title="影响已变化"
            description="来源商品、复制内容或映射已发生变化，请重新检查。"
            {...testId(catalogTestIds.static.localCopyStale)}
          />
        )}
        {!stale && <Alert type="info" title="尚未检查影响" description="返回复制范围后重新检查。" />}
        {referenceMappingsSnapshot.length > 0 && (
          <LocalCopyArraySection
            title="上次检查影响的引用映射（待刷新）"
            rows={referenceMappingsSnapshot}
            locator="catalog-local-copy-reference-mappings-stale"
            renderRow={renderReferenceMappingRow}
          />
        )}
        <Space wrap style={{marginTop: 16}}>
          <Button onClick={onBack}>返回复制范围</Button>
          <Button type="primary" onClick={onRetry} {...testId(catalogTestIds.static.localCopyPreflightRetry)}>
            重新检查
          </Button>
        </Space>
      </>
    );
  const confirmationCount = copyConfirmationRows(preflight.compatibilityResults).length;
  return (
    <>
      <PreflightSummary
        preflight={preflight}
        unhandledConfirmationCount={confirmationCount}
        confirmationCount={confirmationCount}
      />
      <LocalCopyArraySection
        title="引用映射"
        rows={preflight.referenceMappings}
        locator="catalog-local-copy-reference-mappings"
        renderRow={renderReferenceMappingRow}
      />
      <LocalCopyGroupedClosureSection
        title="关联内容"
        rows={preflight.closureItems}
        locator="catalog-local-copy-closure-items"
      />
      {preflight.blockingCount > 0 && (
        <Alert
          type="error"
          showIcon
          title="存在阻断项"
          description="存在无法复制的内容，请调整后重新检查。"
          {...testId(catalogTestIds.static.localCopyBomBlocked)}
        />
      )}
      <Space wrap style={{marginTop: 16}}>
        <Button onClick={onBack}>返回复制范围</Button>
        <Button
          type="primary"
          disabled={preflight.blockingCount > 0}
          onClick={onNext}
          {...testId(catalogTestIds.static.localCopyBomMappingNext)}
        >
          下一步：预览确认
        </Button>
      </Space>
    </>
  );
}

function PreviewStep({
  preflight,
  readback,
  confirmedCompatibilityKeys,
  confirmationRows,
  confirmationCountMatches,
  allConfirmationsHandled,
  onToggleConfirmation,
  executeLoading,
  onBack,
  onExecute,
  onComplete,
}: {
  preflight?: LocalCopyPreflightData;
  readback?: LocalCopyReadbackData;
  confirmedCompatibilityKeys: string[];
  confirmationRows: Array<{row: LocalCopyPreflightData['compatibilityResults'][number]; key: string}>;
  confirmationCountMatches: boolean;
  allConfirmationsHandled: boolean;
  onToggleConfirmation: (key: string, checked: boolean) => void;
  executeLoading: boolean;
  onBack: () => void;
  onExecute: () => void;
  onComplete: () => void;
}) {
  if (!preflight) return <Alert type="warning" title="预览不可用" description="请返回 BOM 映射并重新检查。" />;
  const skippedClosureItems = preflight.closureItems.filter(row => row.action === 'SKIP');
  const overwriteItems = preflight.closureItems.filter(row => row.action !== 'SKIP');
  return (
    <>
      <PreflightSummary
        preflight={preflight}
        unhandledConfirmationCount={Math.max(confirmationRows.length - confirmedCompatibilityKeys.length, 0)}
        confirmationCount={confirmationRows.length}
      />
      <Divider>预览明细</Divider>
      <LocalCopyGroupedClosureSection title="将覆盖" rows={overwriteItems} locator="catalog-local-copy-closure-items" />
      <LocalCopyArraySection
        title="引用映射"
        rows={preflight.referenceMappings}
        locator="catalog-local-copy-reference-mappings"
        renderRow={renderReferenceMappingRow}
      />
      <LocalCopyArraySection
        title="已跳过"
        rows={preflight.skipped}
        locator="catalog-local-copy-skipped-preflight"
        renderRow={renderSkippedRow}
      />
      <LocalCopyGroupedClosureSection
        title="已跳过的关联内容"
        rows={skippedClosureItems}
        locator="catalog-local-copy-skipped-closure"
      />
      <LocalCopyConfirmationSection
        rows={preflight.compatibilityResults}
        confirmationRows={confirmationRows}
        confirmedKeys={confirmedCompatibilityKeys}
        onToggle={onToggleConfirmation}
      />
      {!confirmationCountMatches && (
        <Alert
          type="error"
          showIcon
          title="检查影响确认项与明细不一致"
          description="当前检查影响不能安全执行，请返回重新检查。"
          style={{marginBottom: 12}}
        />
      )}
      {!readback && (
        <>
          <Checkbox
            checked={allConfirmationsHandled}
            onChange={event => {
              const nextKeys = event.target.checked ? confirmationRows.map(({key}) => key) : [];
              nextKeys.forEach(key => onToggleConfirmation(key, true));
              if (!event.target.checked) confirmedCompatibilityKeys.forEach(key => onToggleConfirmation(key, false));
            }}
            disabled={preflight.blockingCount > 0 || !confirmationCountMatches || confirmationRows.length === 0}
            {...testId(catalogTestIds.static.localCopyConfirm)}
          >
            我已逐项核对覆盖字段、BOM 映射、跳过项和兼容处理，并确认按当前检查结果提交。
          </Checkbox>
          <Space wrap style={{marginTop: 16}}>
            <Button onClick={onBack}>返回 BOM 映射</Button>
            <Button
              type="primary"
              disabled={preflight.blockingCount > 0 || !allConfirmationsHandled}
              loading={executeLoading}
              onClick={onExecute}
              {...testId(catalogTestIds.static.localCopyExecute)}
            >
              确认并复制
            </Button>
          </Space>
        </>
      )}
      {readback && <LocalCopyReadbackPanel readback={readback} onComplete={onComplete} />}
    </>
  );
}

function PreflightSummary({
  preflight,
  unhandledConfirmationCount,
  confirmationCount,
}: {
  preflight: LocalCopyPreflightData;
  unhandledConfirmationCount: number;
  confirmationCount: number;
}) {
  return (
    <Descriptions
      size="small"
      bordered
      column={4}
      style={{marginBottom: 16}}
      items={[
        {key: 'selected', label: '选择', children: `${preflight.selectedCount}/${preflight.selectedLimit}`},
        {key: 'closure', label: '关联内容', children: `${preflight.closureCount}/${preflight.closureLimit}`},
        {key: 'blocking', label: '阻断', children: preflight.blockingCount},
        {key: 'confirm', label: '确认项', children: `${unhandledConfirmationCount}/${confirmationCount}`},
      ]}
    />
  );
}

function LocalCopyArraySection<T>({
  title,
  rows,
  locator,
  renderRow,
}: {
  title: string;
  rows: T[];
  locator: string;
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <section style={{marginBottom: 16}} {...testId(locator)}>
      <Typography.Title level={5} style={{marginBottom: 8}}>
        {title}
      </Typography.Title>
      {rows.length ? (
        <List size="small" dataSource={rows} renderItem={row => <List.Item>{renderRow(row)}</List.Item>} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />
      )}
    </section>
  );
}

function LocalCopyConfirmationSection({
  rows,
  confirmationRows,
  confirmedKeys,
  onToggle,
}: {
  rows: LocalCopyPreflightData['compatibilityResults'];
  confirmationRows: Array<{row: LocalCopyPreflightData['compatibilityResults'][number]; key: string}>;
  confirmedKeys: string[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <section style={{marginBottom: 16}} {...testId(catalogTestIds.static.localCopyCompatibilityResults)}>
      <Typography.Title level={5} style={{marginBottom: 8}}>
        兼容处理
      </Typography.Title>
      {rows.length ? (
        <List
          size="small"
          dataSource={rows}
          renderItem={row => {
            const key = copyConfirmationKey(row);
            const confirmable = row.result !== 'BLOCKED' && confirmationRows.some(candidate => candidate.key === key);
            return (
              <List.Item>
                <Space size={8} wrap>
                  <Tag>{catalogCopyObjectTypeLabel(row.objectType)}</Tag>
                  <Tag color={mappingColor(row.result)}>{catalogCopyActionLabel(row.result)}</Tag>
                  <Typography.Text>{catalogCopyReasonLabel(row.reasonCode)}</Typography.Text>
                  {confirmable && (
                    <Checkbox
                      checked={confirmedKeys.includes(key)}
                      onChange={event => onToggle(key, event.target.checked)}
                      {...testId(catalogTestIdControls.copy.confirmation('LOCAL', key))}
                    >
                      {copyConfirmationLabel(row.result)}
                    </Checkbox>
                  )}
                </Space>
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />
      )}
    </section>
  );
}

function LocalCopyGroupedClosureSection({
  title,
  rows,
  locator,
}: {
  title: string;
  rows: LocalCopyPreflightData['closureItems'];
  locator: string;
}) {
  const groups = Array.from(
    rows
      .reduce((grouped, row) => {
        const current = grouped.get(row.objectType) ?? [];
        current.push(row);
        grouped.set(row.objectType, current);
        return grouped;
      }, new Map<string, LocalCopyPreflightData['closureItems']>())
      .entries(),
  );
  return (
    <section style={{marginBottom: 16}} {...testId(locator)}>
      <Typography.Title level={5} style={{marginBottom: 8}}>
        {title}
      </Typography.Title>
      {groups.length ? (
        <Collapse
          items={groups.map(([objectType, group]) => ({
            key: objectType,
            label: (
              <Space>
                <Tag>{catalogCopyObjectTypeLabel(objectType)}</Tag>
                <Typography.Text type="secondary">{group.length} 项</Typography.Text>
              </Space>
            ),
            children: (
              <List
                size="small"
                dataSource={group}
                renderItem={row => <List.Item>{renderClosureRow(row)}</List.Item>}
              />
            ),
          }))}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />
      )}
    </section>
  );
}

function renderClosureRow(row: LocalCopyPreflightData['closureItems'][number]) {
  return (
    <Space size={8}>
      <Tag>{catalogCopyObjectTypeLabel(row.objectType)}</Tag>
      <Typography.Text code>{row.code}</Typography.Text>
      <Typography.Text>{row.name}</Typography.Text>
      <Tag color={row.action === 'SKIP' ? 'gold' : 'blue'}>{catalogCopyActionLabel(row.action)}</Tag>
    </Space>
  );
}

function renderReferenceMappingRow(row: LocalCopyPreflightData['referenceMappings'][number]) {
  return (
    <Space size={8} wrap>
      <Tag>{catalogCopyObjectTypeLabel(row.objectType)}</Tag>
      <Typography.Text code>{row.targetCode}</Typography.Text>
      {row.targetSkuCode && <Tag>规格编码：{row.targetSkuCode}</Tag>}
      {row.targetOptionValueCode && <Tag>选项：{row.targetOptionValueCode}</Tag>}
    </Space>
  );
}

function renderSkippedRow(_row: LocalCopyPreflightData['skipped'][number]) {
  return (
    <Space size={8}>
      <Tag color="gold">未复制</Tag>
    </Space>
  );
}

function LocalCopyReadbackPanel({readback, onComplete}: {readback: LocalCopyReadbackData; onComplete: () => void}) {
  return (
    <Alert
      type="success"
      showIcon
      title="配置已复制"
      description={
        <>
          <Typography.Paragraph type="secondary" style={{marginTop: 8}}>
            复制已完成，以下结果供核对。点击完成后返回当前商品详情。
          </Typography.Paragraph>
          <Descriptions
            size="small"
            column={2}
            items={[
              {
                key: 'created',
                label: '新建',
                children: <ReadbackRows rows={readback.created} locator="catalog-local-copy-created" />,
              },
              {
                key: 'reused',
                label: '复用',
                children: <ReadbackRows rows={readback.reused} locator="catalog-local-copy-reused" />,
              },
              {key: 'skipped', label: '跳过', children: <SkippedRows rows={readback.skipped} />},
              {
                key: 'reference-mappings',
                label: '引用映射',
                children: <ReadbackMappings rows={readback.referenceMappings} />,
              },
            ]}
          />
        </>
      }
      action={
        <Button onClick={onComplete} {...testId(catalogTestIds.static.localCopyOpenTarget)}>
          完成并返回目标商品
        </Button>
      }
      {...testId(catalogTestIds.static.localCopyResult)}
    />
  );
}

function ReadbackRows({rows, locator}: {rows: Array<{objectType: string; code: string}>; locator: string}) {
  return (
    <span {...testId(locator)}>
      {rows.length ? rows.map(row => `${catalogCopyObjectTypeLabel(row.objectType)}/${row.code}`).join('、') : '—'}
    </span>
  );
}

function SkippedRows({rows}: {rows: LocalCopyReadbackData['skipped']}) {
  return (
    <span {...testId(catalogTestIds.static.localCopySkippedReadback)}>
      {rows.length ? '存在未复制的关联内容' : '—'}
    </span>
  );
}

function ReadbackMappings({rows}: {rows: LocalCopyReadbackData['referenceMappings']}) {
  return (
    <span {...testId(catalogTestIds.static.localCopyReadbackReferenceMappings)}>
      {rows.length ? rows.map(row => referenceMappingLabel(row)).join('、') : '—'}
    </span>
  );
}
