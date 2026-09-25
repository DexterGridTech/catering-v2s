import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const pageSource = readFileSync(new URL('./StoreServicePointPage.tsx', import.meta.url), 'utf8');
const testIdsSource = readFileSync(new URL('../storeServicePointTestIds.ts', import.meta.url), 'utf8');
const operationsRtkSource = readFileSync(
  new URL('../../../app/api/generated/operations-edge.rtk.ts', import.meta.url),
  'utf8',
);
const operationsSourceRoot = new URL('../../../', import.meta.url);
const featureSourceRoot = new URL('../', import.meta.url);

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
    return [path];
  });
}

const operationsRuntimeSources = sourceFilesUnder(operationsSourceRoot.pathname);
const featureRuntimeSources = sourceFilesUnder(featureSourceRoot.pathname);
const featureSource = featureRuntimeSources.map(sourcePath => readFileSync(sourcePath, 'utf8')).join('\n');

describe('store service point QR presentation boundary', () => {
  it('hides the generated QR entry for unavailable points without rewriting the owner fact', () => {
    expect(featureSource).toContain(
      'if (!effectiveAvailable) return <Typography.Text type="secondary">不可用</Typography.Text>',
    );
    expect(featureSource).toContain('row.effectiveAvailable');
    expect(featureSource).toContain('value.effectiveAvailable');
    expect(featureSource).not.toContain('if (value) return value;');
  });

  it('generates and displays an image instead of exposing the generated URL as ordinary text', () => {
    expect(featureSource).toContain('<QRCode');
    expect(featureSource).toContain('type="svg"');
    expect(featureSource).toContain('size={size}');
    expect(featureSource).toContain('qrDisplayValue(');
    expect(featureSource).toContain('qrResultImage(row.pointRef)');
    expect(featureSource).toContain('qrResultImage(value.pointRef)');
    expect(featureSource).toContain('value={value}');
    expect(testIdsSource).toContain('qrResultImage: (ref: string)');
  });

  it('keeps table scalar attributes optional while validating supplied capacity', () => {
    expect(featureSource).toContain("rules={[{type: 'number', min: 1, message: '请输入正整数'}]}");
    expect(featureSource).toContain('min={1}');
    expect(featureSource).toContain('seatCapacity: point?.seatCapacity ?? undefined');
    expect(featureSource).toContain('reservable: point?.reservable ?? undefined');
    expect(featureSource).toContain("reservable: pointType === 'TABLE' ? (context.values.reservable ?? null) : null");
    expect(featureSource).toContain('placeholder="未设置"');
    expect(featureSource).toContain('value.reservable === null || value.reservable === undefined');
    expect(featureSource).not.toContain('Boolean(values.reservable)');
  });

  it('keeps an area type fixed in edit mode while leaving it selectable on create', () => {
    expect(featureSource).toContain("disabled={editor?.mode === 'edit'}");
    expect(featureSource).toContain("areaType: areaEditor.area?.areaType ?? 'TABLE_AREA'");
    expect(featureSource).toContain("title={editor?.mode === 'create' ? '新建区域' : '编辑区域'}");
  });

  it('does not present an unread QR configuration as an invalid or empty URL', () => {
    expect(featureSource).toContain('二维码配置加载中…');
    expect(featureSource).toContain('二维码配置读取失败');
    expect(featureSource).toContain('qrReadState={{loading: qrQuery.isFetching, failed: Boolean(qrQuery.error)}}');
  });

  it('keeps business-facing point fields inline and uses targeted readback after mutations', () => {
    expect(featureSource).not.toContain('title="扩展字段"');
    expect(featureSource).toContain('title="字段配置读取失败"');
    expect(featureSource).toContain('pointAreaContext');
    expect(featureSource).toContain('所属区域');
    expect(featureSource).toContain("await readBack('areas')");
    expect(featureSource).toContain("await readBack('points')");
    expect(featureSource).toContain("await readBack('qr')");
    expect(featureSource).not.toContain('refreshOperationsCurrentPage');
  });

  it('locks duplicate sorting actions for the same row until its owner readback completes', () => {
    expect(featureSource).toContain('sortPendingRef.current');
    expect(featureSource).toContain('updateSortPending(pending)');
    expect(featureSource).toContain("sortPending?.target === 'area'");
    expect(featureSource).toContain("sortPending?.target === 'point'");
    expect(featureSource).toContain("await readBack('areas')");
    expect(featureSource).toContain("await readBack('points')");
    expect(featureSource).toContain('setFeedback(undefined);');
    expect(featureSource).not.toContain('顺序已更新');
  });

  it('隔离旧排序收据，避免修复后的交换动作重放历史无变化结果', () => {
    expect(featureSource).toContain("export const STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION = 'swap-v2';");
    expect(featureSource).toContain('receiptVersion: STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION');
    expect(featureSource.match(/receiptVersion: STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION/g)?.length).toBe(2);
  });

  it('keeps the approved feature file boundaries real and makes the page an orchestration shell', () => {
    const requiredRuntimeFiles = [
      'ui/StoreServicePointPage.tsx',
      'ui/AreaDrawer.tsx',
      'ui/ServicePointDrawer.tsx',
      'ui/QrConfigurationDrawer.tsx',
      'ui/ServicePointDetailDrawer.tsx',
      'model/useStoreServicePointReadModel.ts',
      'model/commands.ts',
    ];
    for (const relativePath of requiredRuntimeFiles) {
      expect(featureRuntimeSources, relativePath).toContain(join(featureSourceRoot.pathname, relativePath));
    }
    expect(pageSource).toContain('useStoreServicePointReadModel');
    expect(pageSource).toContain('<AreaDrawer');
    expect(pageSource).toContain('<ServicePointDrawer');
    expect(pageSource).toContain('<QrConfigurationDrawer');
    expect(pageSource).toContain('<ServicePointDetailDrawer');
    expect(pageSource).not.toContain('<Drawer');
  });

  it('does not expose extension-field implementation terminology in operations-admin UI source', () => {
    for (const sourcePath of operationsRuntimeSources) {
      const source = readFileSync(sourcePath, 'utf8');
      expect(source, sourcePath).not.toMatch(/扩展字段|自定义字段|补充资料/);
    }
  });

  it('keeps store service point cache invalidation away from the global wire LIST tag', () => {
    const operationIds = [
      'getOperationsStoreQrChannelCandidates',
      'getOperationsStoreQrConfiguration',
      'getOperationsStoreServicePoint',
      'getOperationsStoreServicePointAreas',
      'getOperationsStoreServicePoints',
      'postOperationsStoreServicePointArea',
      'patchOperationsStoreServicePointArea',
      'postOperationsStoreServicePointAreaStatus',
      'postOperationsStoreServicePointAreaOrder',
      'postOperationsStoreServicePoint',
      'patchOperationsStoreServicePoint',
      'postOperationsStoreServicePointStatus',
      'postOperationsStoreServicePointOrder',
      'patchOperationsStoreQrConfiguration',
      'stageStoreServicePointImage',
      'releaseStagedStoreServicePointImage',
    ];
    for (const operationId of operationIds) {
      const start = operationsRtkSource.indexOf(`${operationId}: build.`);
      const end = operationsRtkSource.indexOf('\n    }),', start);
      expect(start, operationId).toBeGreaterThanOrEqual(0);
      expect(end, operationId).toBeGreaterThan(start);
      const endpoint = operationsRtkSource.slice(start, end);
      expect(endpoint, operationId).toContain('resolveWireTags');
      expect(endpoint, operationId).not.toContain('id: "LIST"');
    }
  });
});
