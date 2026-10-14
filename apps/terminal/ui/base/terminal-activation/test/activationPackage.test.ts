import {describe, expect, it, vi} from 'vitest';
import * as ts from 'typescript';
import {fileURLToPath} from 'node:url';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import invariant from '../terminal-invariants.json';
import {createCredentialSecret} from '../src/foundations/createCredentialSecret';
import {createTerminalActivationModule} from '../src/application/module';
import {createTerminalActivationParts} from '../src/declarations/parts';
import {runtimeModuleDependencyNames} from '../src/dependencies';
import {moduleName} from '../src/moduleName';

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => Uint8Array.from({length}, (_, index) => index)),
}));

const defaults: TransportServerConfig = Object.freeze({
  selectedSpace: 'development',
  spaces: Object.freeze([]),
});

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
  if (sourceFile === undefined) throw new Error(`missing source file: ${indexPath}`);
  const moduleSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) throw new Error(`missing module symbol: ${indexPath}`);
  return program
    .getTypeChecker()
    .getExportsOfModule(moduleSymbol)
    .map(symbol => symbol.name)
    .sort();
};

describe('terminal activation UI package', () => {
  it('matches the root barrel to its declared public exports exactly', () => {
    expect(readPublicExports()).toEqual([...invariant.publicExports].sort());
  });

  it('encodes 32 cryptographic bytes as the protocol 43-character base64url secret', async () => {
    const secret = await createCredentialSecret();
    expect(secret).toBe('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8');
    expect(secret).toMatch(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
  });

  it('owns idempotent activation presentation routing for its declared parts', () => {
    const module = createTerminalActivationModule(defaults, 'laptop');
    expect(module.moduleName).toBe(moduleName);
    expect(module.commandDefinitions).toHaveLength(1);
    expect(module.commandDefinitions?.[0]?.visibility).toBe('public');
    expect(module.actorDefinitions?.map(actor => actor.actorName)).toEqual(['terminal-activation-route']);
    expect(runtimeModuleDependencyNames).toEqual([
      'kernel.base.runtime',
      'kernel.base.server-config',
      'kernel.base.terminal-data-client',
      'kernel.base.topology',
      'kernel.base.ui-state',
    ]);
    expect(module.stateSlices).toEqual([]);
  });

  it('declares the four face parts against their actual host and secondary-screen contexts', () => {
    const parts = createTerminalActivationParts(defaults);
    expect(parts.map(part => part.catalogEntry.partKey)).toEqual([
      'terminal.activation.mmp',
      'terminal.activation.lmp',
      'terminal.activation.lms',
      'terminal.activation.lsp',
      'terminal.activation.admin.status',
    ]);
    expect(parts[2]).toMatchObject({
      catalogEntry: {
        displayModes: ['SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        surfaceForm: ['laptop'],
      },
    });
    expect(parts[3]).toMatchObject({
      catalogEntry: {
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        surfaceForm: ['laptop'],
      },
    });
  });
});
