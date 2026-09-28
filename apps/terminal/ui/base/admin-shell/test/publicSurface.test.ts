import * as ts from 'typescript';
import {describe, expect, it} from 'vitest';
import invariant from '../terminal-invariants.json';

const readPublicExports = (): readonly string[] => {
  const indexPath = decodeURIComponent(new URL('../src/index.ts', import.meta.url).pathname);
  const program = ts.createProgram({
    rootNames: [indexPath],
    options: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true,
    },
  });
  const sourceFile = program.getSourceFile(indexPath);
  if (sourceFile === undefined) throw new Error(`missing source file: ${indexPath}`);
  const moduleSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) throw new Error(`missing module symbol: ${indexPath}`);
  return program
    .getTypeChecker()
    .getExportsOfModule(moduleSymbol)
    .map(symbol => symbol.name)
    .sort();
};

describe('admin-shell public surface', () => {
  it('matches terminal-invariants exactly, including type exports', () => {
    expect(readPublicExports()).toEqual([...invariant.publicExports].sort());
  });
});
