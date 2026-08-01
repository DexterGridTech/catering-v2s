import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./RoleHomeBootstrapPage.tsx', import.meta.url), 'utf8');

describe('RoleHomeBootstrapPage', () => {
  it('keeps the five HOME routes as a pure bootstrap outlet', () => {
    expect(source).toContain('v2 bootstrap 内容出口');
    expect(source).toContain('testId(`role-home-${pageDesignKey}`)');
    expect(source).not.toContain('groupWorkspaceKey');
    expect(source).not.toContain('scopeRef');
    expect(source).not.toContain('page.pageTitle');
    expect(source).not.toContain('page.pageDescription');
    expect(source).not.toMatch(/operationsClient|operationsRtk|useGet|useList|Descriptions|Card|Alert/);
  });
});
