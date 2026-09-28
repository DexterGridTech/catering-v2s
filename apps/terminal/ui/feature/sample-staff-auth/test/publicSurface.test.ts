import * as ts from 'typescript';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import packageJson from '../package.json';
import invariant from '../terminal-invariants.json';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

const readPublicExports = (): readonly string[] => {
  const indexPath = fileURLToPath(new URL('../src/index.ts', import.meta.url));
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
  if (sourceFile === undefined) throw new Error('missing source file: ' + indexPath);
  const moduleSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) throw new Error('missing module symbol: ' + indexPath);
  return program
    .getTypeChecker()
    .getExportsOfModule(moduleSymbol)
    .map(symbol => symbol.name)
    .sort();
};

describe('sample staff auth public surface', () => {
  it('matches terminal-invariants publicExports exactly, including type exports', () => {
    expect(readPublicExports()).toEqual([...invariant.publicExports].sort());
  });

  it('matches package exports to the exact invariant map and existing targets', () => {
    expect(packageJson.exports).toEqual(invariant.publicExportMap);
    for (const target of Object.values(invariant.publicExportMap)) {
      expect(existsSync(resolve(packageRoot, target))).toBe(true);
    }
  });
});
