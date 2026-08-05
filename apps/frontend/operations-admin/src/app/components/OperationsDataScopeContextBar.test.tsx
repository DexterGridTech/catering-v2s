import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsDataScopeContextBar.tsx', import.meta.url), 'utf8');

describe('operations data-scope context bar', () => {
  it('names the current required scope instead of exposing a generic data-node label', () => {
    expect(source).toContain("if (type === 'PROJECT') return '当前项目'");
    expect(source).toContain("if (type === 'STORE') return '当前门店'");
    expect(source).toContain("if (type === 'HEAD_COMPANY') return '当前总公司'");
    expect(source).toContain("return '当前大区'");
    expect(source).not.toContain('当前数据节点');
  });

  it('retains the shared exact missing-scope prompt for every scoped page', () => {
    expect(source).toContain('请在左下角选择要管理的门店。');
    expect(source).toContain('operations-page-data-scope-missing');
    expect(source).toContain('export function isOperationsScopeComplete');
  });

  it('uses the complete selected hierarchy as the current project or store value without repeating ancestor labels', () => {
    expect(source).toContain("const selectedPath = lines.map(([, node]) => nodeLabel(node!)).join(' / ')");
    expect(source).not.toContain('（{ancestors}）');
  });
});
