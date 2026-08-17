import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Skeleton,
  Space,
  Steps,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  adminWideDrawerSurfaceProps,
  createContentIdempotencyKey,
  NameCodeText,
  testId,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../app/api/generated/catalog-inventory-edge';
import type {
  CatalogInventoryEnvelope,
  CatalogShapeManifestView,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {
  catalogCopyVersionRows,
  catalogCopyActionLabel,
  catalogCopyObjectTypeLabel,
  catalogCopyScopeLabel,
  copyConfirmationLabel,
  copyConfirmationRows,
  decodeBrandCopyReadback,
  decodeBrandCopyScopes,
  decodeCandidates,
  decodePreflight,
  partitionBrandCopyCompatibilityResults,
  type BrandCopyReadback,
  type BrandCopyScope,
  type CatalogCopyReferenceMapping,
  type CopyPreflight,
} from '../model/catalogModel';
import {catalogEnumLabel} from '../model/catalogManifestLabels';

type Props = {
  open: boolean;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  onClose: () => void;
  onCompleted: () => void;
};
type CatalogManifest = Pick<CatalogShapeManifestView, 'enumLabels' | 'fields'>;

export function BrandCatalogCopyDrawer({open, queryContext, brandRef, onClose, onCompleted}: Props) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [preflight, setPreflight] = useState<CopyPreflight>();
  const [preflightStale, setPreflightStale] = useState(false);
  const [readback, setReadback] = useState<BrandCopyReadback>();
  const [confirmedCompatibilityKeys, setConfirmedCompatibilityKeys] = useState<string[]>([]);
  const [problem, setProblem] = useState<string>();
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {
    skip: !open || !queryContext.scopeRef,
  });
  const manifest = manifestQuery.currentData?.data;
  const candidatesRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsBrandCatalogCopyCandidates(
        {},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(keyword.trim() ? {keyword: keyword.trim()} : {}),
          },
          headers,
        },
      ),
    [headers, keyword, queryContext.scopeRef],
  );
  const candidatesQuery = operationsRtk.useGetOperationsBrandCatalogCopyCandidatesQuery(candidatesRequest, {
    skip: !open,
  });
  const candidates = decodeCandidates(candidatesQuery.data);
  const scopes = decodeBrandCopyScopes(candidatesQuery.data);
  const [preflightCopy, preflightState] = operationsRtk.usePreflightOperationsBrandCatalogCopyMutation();
  const [executeCopy, executeState] = operationsRtk.useExecuteOperationsBrandCatalogCopyMutation();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '复制预检和已选择商品尚未提交。',
    dirtyGuardTestIds: {confirm: testId('catalog-copy-dirty-discard'), cancel: testId('catalog-copy-dirty-continue')},
    diagnosticOperationId: 'brand-catalog-copy',
  });
  const compatibilityBuckets = partitionBrandCopyCompatibilityResults(preflight?.compatibilityResults ?? []);
  const confirmationRows = useMemo(
    () => copyConfirmationRows(preflight?.compatibilityResults ?? []),
    [preflight?.compatibilityResults],
  );
  const unhandledConfirmationCount = Math.max(confirmationRows.length - confirmedCompatibilityKeys.length, 0);
  const confirmationCountMatches = !preflight || preflight.confirmationRequiredCount === confirmationRows.length;
  const allConfirmationsHandled = confirmationCountMatches && unhandledConfirmationCount === 0;
  const toggleConfirmation = (key: string, checked: boolean) => {
    setConfirmedCompatibilityKeys(current =>
      checked ? [...new Set([...current, key])] : current.filter(value => value !== key),
    );
  };
  useEffect(() => {
    if (!open) {
      setStep(0);
      setSelected([]);
      setKeyword('');
      setPreflight(undefined);
      setPreflightStale(false);
      setReadback(undefined);
      setConfirmedCompatibilityKeys([]);
      setProblem(undefined);
      lifecycle.reset();
    }
  }, [lifecycle, open]);

  const runPreflight = async () => {
    setProblem(undefined);
    setPreflightStale(false);
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {dataNodeRef, selectedItemCodes: selected, targetDataNodeRef: dataNodeRef};
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.preflightOperationsBrandCatalogCopy,
        body,
      );
      const response = await preflightCopy(
        catalogInventoryRtkRequest.preflightOperationsBrandCatalogCopy(
          {},
          {headers: {...(headers ?? {}), 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      const next = decodePreflight(response as CatalogInventoryEnvelope);
      if (!next) throw new Error('COPY_PREFLIGHT_SHAPE_MISSING');
      setPreflight(next);
      setConfirmedCompatibilityKeys([]);
      setReadback(undefined);
      setStep(2);
      lifecycle.setDirty(true);
    } catch (error) {
      setProblem(
        error instanceof Error && error.message === 'COPY_PREFLIGHT_SHAPE_MISSING'
          ? '复制预检返回不完整，请重试。'
          : operationsProblemOf(error).detail,
      );
    }
  };
  const execute = async () => {
    if (!preflight || !allConfirmationsHandled) return;
    setProblem(undefined);
    try {
      const versionRows = catalogCopyVersionRows(preflight.objectVersions);
      if (!versionRows.length) throw new Error('COPY_PREFLIGHT_CATALOG_VERSIONS_MISSING');
      const expectedSourceVersion = Math.max(...versionRows.map(row => Number(row.sourceVersion ?? 0)), 0);
      const expectedTargetVersion = Math.max(...versionRows.map(row => Number(row.targetVersion ?? 0)), 0);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {
        dataNodeRef,
        selectedItemCodes: selected,
        targetDataNodeRef: dataNodeRef,
        preflightDigest: preflight.preflightDigest,
        expectedSourceVersion,
        expectedTargetVersion,
        compatibilityDispositions: confirmedCompatibilityKeys.map(compatibilityId => ({
          compatibilityId,
          disposition: 'CONFIRM' as const,
        })),
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.executeOperationsBrandCatalogCopy,
        body,
      );
      const response = await executeCopy(
        catalogInventoryRtkRequest.executeOperationsBrandCatalogCopy(
          {},
          {headers: {...(headers ?? {}), 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      const next = decodeBrandCopyReadback(response as CatalogInventoryEnvelope);
      if (!next) throw new Error('COPY_READBACK_SHAPE_MISSING');
      lifecycle.reset();
      setReadback(next);
      setStep(4);
    } catch (error) {
      const feedback = operationsProblemOf(error);
      if ((feedback.errorCode as string) === 'STALE_COPY_PREFLIGHT') {
        setProblem(undefined);
        setPreflight(undefined);
        setPreflightStale(true);
        setConfirmedCompatibilityKeys([]);
        setReadback(undefined);
        setStep(2);
      } else {
        setProblem(
          error instanceof Error && error.message === 'COPY_PREFLIGHT_CATALOG_VERSIONS_MISSING'
            ? '预检未返回目录来源或目标版本，请重新生成预检。'
            : feedback.detail,
        );
      }
    }
  };

  return (
    <Drawer
      title="从品牌复制到门店"
      open={open}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden={false}
      maskClosable={!lifecycle.dirty}
      {...adminWideDrawerSurfaceProps}
      {...testId('catalog-brand-copy-drawer')}
    >
      <Steps
        current={step}
        items={[
          {title: '来源范围'},
          {title: '选择商品'},
          {title: '差异预检'},
          {title: '确认执行'},
          {title: '复制结果'},
        ]}
        style={{marginBottom: 24}}
      />
      {problem && (
        <Alert
          type="error"
          showIcon
          title="品牌复制未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId('catalog-copy-problem')}
        />
      )}
      {step === 0 && (
        <>
          <Descriptions
            size="small"
            bordered
            column={1}
            items={[
              {
                key: 'source',
                label: '来源范围',
                children: scopes.sourceScope ? scopeText(scopes.sourceScope) : '当前商品库',
              },
              {
                key: 'target',
                label: '目标范围',
                children: scopes.targetScope ? scopeText(scopes.targetScope) : '当前门店',
              },
            ]}
          />
          <Input
            allowClear
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            placeholder="按商品名称或编码搜索品牌商品"
            style={{marginTop: 16}}
            {...testId('catalog-brand-copy-source-keyword')}
          />
          {candidatesQuery.isLoading ? (
            <Skeleton active />
          ) : candidates.length ? (
            <Checkbox.Group
              value={selected}
              onChange={values => {
                setSelected(values as string[]);
                lifecycle.setDirty(true);
              }}
              style={{width: '100%'}}
            >
              <List
                dataSource={candidates}
                renderItem={item => (
                  <List.Item>
                    <Checkbox value={item.code} {...testId(`catalog-copy-candidate-${item.code}`)}>
                      <NameCodeText name={item.name} code={item.code} />{' '}
                      <Tag>{catalogEnumLabel(manifest, 'shapeKey', item.shapeKey)}</Tag>
                    </Checkbox>
                  </List.Item>
                )}
              />
            </Checkbox.Group>
          ) : (
            <Empty description="当前品牌没有可复制商品" />
          )}
          <Space style={{marginTop: 16}}>
            <Button onClick={lifecycle.requestClose}>取消</Button>
            <Button
              type="primary"
              disabled={!selected.length}
              onClick={() => setStep(1)}
              {...testId('catalog-brand-copy-selection-next')}
            >
              下一步：确认范围
            </Button>
          </Space>
        </>
      )}
      {step === 1 && (
        <>
          <Alert
            type="info"
            showIcon
            title="来源与目标已由组织事实确定"
            description="品牌商品只从当前总公司+品牌复制到当前门店，不提供手工改写来源选择器。"
          />
          <List
            size="small"
            dataSource={selected.map(code => candidates.find(item => item.code === code)).filter(Boolean)}
            renderItem={item =>
              item ? (
                <List.Item>
                  <NameCodeText name={item.name} code={item.code} />{' '}
                  <Tag>{catalogEnumLabel(manifest, 'shapeKey', item.shapeKey)}</Tag>
                </List.Item>
              ) : null
            }
          />
          <Space style={{marginTop: 16}}>
            <Button onClick={() => setStep(0)}>返回选择</Button>
            <Button
              type="primary"
              loading={preflightState.isLoading}
              onClick={() => void runPreflight()}
              {...testId('catalog-copy-preflight')}
            >
              生成差异预检
            </Button>
          </Space>
        </>
      )}
      {step === 2 && preflight && (
        <>
          <Descriptions
            size="small"
            bordered
            column={4}
            items={[
              {key: 'selected', label: '起始商品', children: `${preflight.selectedCount}/${preflight.selectedLimit}`},
              {key: 'closure', label: '关联内容', children: `${preflight.closureCount}/${preflight.closureLimit}`},
              {key: 'blocking', label: '阻断', children: preflight.blockingCount},
              {
                key: 'confirmations',
                label: '待确认',
                children: `${unhandledConfirmationCount}/${confirmationRows.length}`,
              },
            ]}
          />
          {!confirmationCountMatches && (
            <Alert
              type="error"
              showIcon
              title="预检确认项与明细不一致"
              description="当前预检不能安全执行，请重新生成预检。"
              style={{marginTop: 16}}
            />
          )}
          <Tabs
            style={{marginTop: 16}}
            items={[
              {key: 'items', label: '商品与结构', children: <ClosureItemList rows={preflight.closureItems} />},
              {
                key: 'mapping',
                label: '引用映射',
                children: <ReferenceMappingList rows={preflight.referenceMappings} />,
              },
              {
                key: 'inventory',
                label: '库存与BOM',
                children: (
                  <CompatibilityList
                    rows={compatibilityBuckets.inventory}
                    confirmationRows={confirmationRows}
                    confirmedKeys={confirmedCompatibilityKeys}
                    onToggleConfirm={toggleConfirmation}
                  />
                ),
              },
              {
                key: 'production',
                label: '生产提示',
                children: (
                  <CompatibilityList
                    rows={compatibilityBuckets.production}
                    confirmationRows={confirmationRows}
                    confirmedKeys={confirmedCompatibilityKeys}
                    onToggleConfirm={toggleConfirmation}
                  />
                ),
              },
              ...(compatibilityBuckets.other.length
                ? [
                    {
                      key: 'other',
                      label: '其他兼容事实',
                      children: (
                        <CompatibilityList
                          rows={compatibilityBuckets.other}
                          confirmationRows={confirmationRows}
                          confirmedKeys={confirmedCompatibilityKeys}
                          onToggleConfirm={toggleConfirmation}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
            {...testId('catalog-inventory-copy-preflight')}
          />
          <Checkbox
            checked={allConfirmationsHandled}
            onChange={event => {
              setConfirmedCompatibilityKeys(event.target.checked ? confirmationRows.map(({key}) => key) : []);
            }}
            disabled={preflight.blockingCount > 0 || !confirmationCountMatches || confirmationRows.length === 0}
            {...testId('catalog-copy-confirm')}
          >
            我已核对所有可确认差异与引用映射
          </Checkbox>
          {preflight.blockingCount > 0 && (
            <Alert type="warning" showIcon title="仍有阻断项，清零后才能执行复制" style={{marginTop: 12}} />
          )}
          <Space style={{marginTop: 16}}>
            <Button
              onClick={() => {
                setStep(1);
                setPreflight(undefined);
                setConfirmedCompatibilityKeys([]);
              }}
            >
              返回选择
            </Button>
            <Button
              type="primary"
              disabled={preflight.blockingCount > 0 || !allConfirmationsHandled}
              onClick={() => setStep(3)}
              {...testId('catalog-brand-copy-preflight-next')}
            >
              下一步：确认执行
            </Button>
          </Space>
        </>
      )}
      {step === 2 && !preflight && preflightStale && (
        <>
          <Alert
            type="warning"
            showIcon
            title="复制预检已失效"
            description="来源或目标事实在执行前发生变化，旧预检已丢弃，必须重新生成后才能继续。"
            {...testId('catalog-copy-preflight-stale')}
          />
          <Space style={{marginTop: 16}}>
            <Button
              onClick={() => {
                setStep(1);
                setPreflightStale(false);
              }}
            >
              返回选择
            </Button>
            <Button
              type="primary"
              loading={preflightState.isLoading}
              onClick={() => void runPreflight()}
              {...testId('catalog-copy-preflight-retry')}
            >
              重新生成预检
            </Button>
          </Space>
        </>
      )}
      {step === 3 && preflight && (
        <>
          <Descriptions
            size="small"
            bordered
            column={2}
            items={[
              {key: 'selected', label: '起始商品', children: `${preflight.selectedCount}/${preflight.selectedLimit}`},
              {key: 'closure', label: '关联内容', children: `${preflight.closureCount}/${preflight.closureLimit}`},
            ]}
          />
          {!confirmationCountMatches && (
            <Alert
              type="error"
              showIcon
              title="预检确认项与明细不一致"
              description="当前预检不能安全执行，请返回重新生成预检。"
              style={{marginBottom: 12}}
            />
          )}
          <Checkbox
            checked={allConfirmationsHandled}
            onChange={event => {
              setConfirmedCompatibilityKeys(event.target.checked ? confirmationRows.map(({key}) => key) : []);
            }}
            disabled={preflight.blockingCount > 0 || !confirmationCountMatches || confirmationRows.length === 0}
            {...testId('catalog-copy-confirm')}
          >
            我已核对所有可确认差异与引用映射
          </Checkbox>
          <Space style={{marginTop: 16}}>
            <Button onClick={() => setStep(2)}>返回预检</Button>
            <Button
              type="primary"
              disabled={preflight.blockingCount > 0 || !allConfirmationsHandled}
              loading={executeState.isLoading}
              onClick={() => void execute()}
              {...testId('catalog-copy-execute')}
            >
              确认并原子复制
            </Button>
          </Space>
        </>
      )}
      {step === 4 && readback && (
        <>
          <Alert
            type="success"
            showIcon
            title="品牌商品已复制"
            description="目录、库存、配方、制作信息和引用已完成复制。"
            {...testId('catalog-copy-result')}
          />
          <Tabs
            style={{marginTop: 16}}
            items={[
              {
                key: 'created',
                label: `新建 ${readback.created.length}`,
                children: <ReadbackRows rows={readback.created} />,
              },
              {
                key: 'reused',
                label: `复用 ${readback.reused.length}`,
                children: <ReadbackRows rows={readback.reused} />,
              },
              {
                key: 'mapping',
                label: `引用映射 ${readback.referenceMappings.length}`,
                children: <ReferenceMappingList rows={readback.referenceMappings} />,
              },
            ]}
          />
          <Button
            type="primary"
            onClick={() => {
              onCompleted();
              onClose();
            }}
            {...testId('catalog-copy-result-close')}
          >
            完成
          </Button>
        </>
      )}
    </Drawer>
  );
}

function scopeText(scope: BrandCopyScope) {
  return catalogCopyScopeLabel(scope.ownerType);
}

function ClosureItemList({rows}: {rows: CopyPreflight['closureItems']}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />;
  const groups = groupRows(rows);
  return (
    <Collapse
      size="small"
      items={groups.map(([objectType, group]) => ({
        key: objectType,
        label: `${catalogCopyObjectTypeLabel(objectType)}（${group.length}）`,
        children: (
          <List
            size="small"
            dataSource={group}
            renderItem={({row}) => (
              <List.Item>
                <Space size={8}>
                  <Typography.Text code>{row.code}</Typography.Text>
                  <Typography.Text>{row.name}</Typography.Text>
                  <Tag>{catalogCopyActionLabel(row.action)}</Tag>
                </Space>
              </List.Item>
            )}
          />
        ),
      }))}
    />
  );
}

function CompatibilityList({
  rows,
  confirmationRows,
  confirmedKeys,
  onToggleConfirm,
}: {
  rows: CopyPreflight['compatibilityResults'];
  confirmationRows: Array<{row: CopyPreflight['compatibilityResults'][number]; key: string}>;
  confirmedKeys: string[];
  onToggleConfirm: (key: string, checked: boolean) => void;
}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />;
  return (
    <List
      size="small"
      dataSource={rows.map((row, index) => ({row, index}))}
      renderItem={({row, index}) => {
        const key = confirmationRows.find(candidate => candidate.row === row)?.key;
        const confirmable = row.result !== 'BLOCKED' && Boolean(key);
        return (
          <List.Item>
            <Space size={8} wrap>
              <Tag>{catalogCopyObjectTypeLabel(row.objectType)}</Tag>
              <Tag>{catalogCopyActionLabel(row.result)}</Tag>
              <Typography.Text>{row.reason || '—'}</Typography.Text>
              {confirmable && (
                <Checkbox
                  checked={confirmedKeys.includes(key!)}
                  onChange={event => onToggleConfirm(key!, event.target.checked)}
                  {...testId(`catalog-copy-confirm-${index}`)}
                >
                  {copyConfirmationLabel(row.result)}
                </Checkbox>
              )}
            </Space>
          </List.Item>
        );
      }}
    />
  );
}

function ReferenceMappingList({rows}: {rows: CatalogCopyReferenceMapping[]}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />;
  return (
    <List
      size="small"
      dataSource={rows}
      renderItem={row => (
        <List.Item>
          <Space size={8} wrap>
            <Tag>{catalogCopyObjectTypeLabel(row.objectType)}</Tag>
            <Typography.Text code>{row.targetCode}</Typography.Text>
            {row.targetSkuCode && <Tag>SKU：{row.targetSkuCode}</Tag>}
            {row.targetOptionValueCode && <Tag>选项：{row.targetOptionValueCode}</Tag>}
          </Space>
        </List.Item>
      )}
    />
  );
}

function groupRows<T extends {objectType: string}>(rows: T[]) {
  const grouped = new Map<string, Array<{row: T; index: number}>>();
  rows.forEach((row, index) => {
    const group = grouped.get(row.objectType) ?? [];
    group.push({row, index});
    grouped.set(row.objectType, group);
  });
  return [...grouped.entries()];
}

function ReadbackRows({rows}: {rows: Array<{objectType: string; code: string}>}) {
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本类无差异" />;
  return (
    <List
      size="small"
      dataSource={rows}
      renderItem={row => (
        <List.Item>
          <Space size={8}>
            <Tag>{catalogCopyObjectTypeLabel(row.objectType)}</Tag>
            <Typography.Text code>{row.code}</Typography.Text>
          </Space>
        </List.Item>
      )}
    />
  );
}
