import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const pageSource = readFileSync(new URL('./StoreServicePointPage.tsx', import.meta.url), 'utf8');
const testIdsSource = readFileSync(new URL('../storeServicePointTestIds.ts', import.meta.url), 'utf8');

describe('store service point QR presentation boundary', () => {
  it('hides the generated QR entry for unavailable points without rewriting the owner fact', () => {
    expect(pageSource).toContain(
      'if (!effectiveAvailable) return <Typography.Text type="secondary">不可用</Typography.Text>',
    );
    expect(pageSource).toContain('row.effectiveAvailable');
    expect(pageSource).toContain('detailValue.effectiveAvailable');
    expect(pageSource).not.toContain('if (value) return value;');
  });

  it('renders an entry instead of exposing the generated URL as ordinary text', () => {
    expect(pageSource).toContain('<Typography.Link');
    expect(pageSource).toContain('href={value}');
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain('rel="noreferrer"');
    expect(pageSource).toContain('查看二维码');
    expect(pageSource).toContain('qrResultLink(row.pointRef)');
    expect(pageSource).toContain('qrResultLink(detailValue.pointRef)');
    expect(testIdsSource).toContain('qrResultLink: (ref: string)');
  });

  it('does not present an unread QR configuration as an invalid or empty URL', () => {
    expect(pageSource).toContain('二维码配置加载中…');
    expect(pageSource).toContain('二维码配置读取失败');
    expect(pageSource).toContain('{loading: qrQuery.isFetching, failed: Boolean(qrQuery.error)}');
  });
});
