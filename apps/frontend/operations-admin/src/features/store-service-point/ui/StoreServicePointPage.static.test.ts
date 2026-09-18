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

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
    return [path];
  });
}

const operationsRuntimeSources = sourceFilesUnder(operationsSourceRoot.pathname);

describe('store service point QR presentation boundary', () => {
  it('hides the generated QR entry for unavailable points without rewriting the owner fact', () => {
    expect(pageSource).toContain(
      'if (!effectiveAvailable) return <Typography.Text type="secondary">不可用</Typography.Text>',
    );
    expect(pageSource).toContain('row.effectiveAvailable');
    expect(pageSource).toContain('detailValue.effectiveAvailable');
    expect(pageSource).not.toContain('if (value) return value;');
  });

  it('generates and displays an image instead of exposing the generated URL as ordinary text', () => {
    expect(pageSource).toContain('<QRCode');
    expect(pageSource).toContain('type="svg"');
    expect(pageSource).toContain('size={size}');
    expect(pageSource).toContain('qrDisplayValue(');
    expect(pageSource).toContain('qrResultImage(row.pointRef)');
    expect(pageSource).toContain('qrResultImage(detailValue.pointRef)');
    expect(pageSource).toContain('value={value}');
    expect(testIdsSource).toContain('qrResultImage: (ref: string)');
  });

  it('keeps table scalar attributes optional while validating supplied capacity', () => {
    expect(pageSource).toContain("rules={[{type: 'number', min: 1, message: '请输入正整数'}]}");
    expect(pageSource).toContain('min={1}');
    expect(pageSource).toContain('seatCapacity: point?.seatCapacity ?? undefined');
    expect(pageSource).toContain('reservable: point?.reservable ?? undefined');
    expect(pageSource).toContain("reservable: pointType === 'TABLE' ? (values.reservable ?? null) : null");
    expect(pageSource).toContain('placeholder="未设置"');
    expect(pageSource).toContain('detailValue.reservable === null || detailValue.reservable === undefined');
    expect(pageSource).not.toContain('Boolean(values.reservable)');
  });

  it('does not present an unread QR configuration as an invalid or empty URL', () => {
    expect(pageSource).toContain('二维码配置加载中…');
    expect(pageSource).toContain('二维码配置读取失败');
    expect(pageSource).toContain('{loading: qrQuery.isFetching, failed: Boolean(qrQuery.error)}');
  });

  it('keeps business-facing point fields inline and uses targeted readback after mutations', () => {
    expect(pageSource).not.toContain('title="扩展字段"');
    expect(pageSource).toContain('title="字段配置读取失败"');
    expect(pageSource).toContain("await readBack('areas')");
    expect(pageSource).toContain("await readBack('points')");
    expect(pageSource).toContain("await readBack('qr')");
    expect(pageSource).not.toContain('refreshOperationsCurrentPage');
  });

  it('does not expose extension-field implementation terminology in operations-admin UI source', () => {
    for (const sourcePath of operationsRuntimeSources) {
      const source = readFileSync(sourcePath, 'utf8');
      expect(source, sourcePath).not.toMatch(/扩展字段|自定义字段|补充资料/);
    }
  });

  it('keeps store service point cache invalidation away from the global wire LIST tag', () => {
    const operationIds = [
      'postOperationsStoreServicePointAreaOrder',
      'postOperationsStoreServicePointOrder',
      'patchOperationsStoreQrConfiguration',
    ];
    for (const operationId of operationIds) {
      const start = operationsRtkSource.indexOf(`${operationId}: build.mutation`);
      const end = operationsRtkSource.indexOf('\n    }),', start);
      expect(start, operationId).toBeGreaterThanOrEqual(0);
      expect(end, operationId).toBeGreaterThan(start);
      const endpoint = operationsRtkSource.slice(start, end);
      expect(endpoint, operationId).toContain('resolveStoreServicePointTags');
      expect(endpoint, operationId).not.toContain('id: "LIST"');
    }
  });
});
