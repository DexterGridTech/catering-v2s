import {describe, expect, it, vi} from 'vitest';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {createCredentialSecret} from '../src/foundations/createCredentialSecret';
import {createTerminalActivationModule} from '../src/application/module';
import {createTerminalActivationParts} from '../src/parts/parts';
import {moduleName} from '../src/moduleName';

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => Uint8Array.from({length}, (_, index) => index)),
}));

const defaults: TransportServerConfig = Object.freeze({
  selectedSpace: 'development',
  spaces: Object.freeze([]),
});

describe('terminal activation UI package', () => {
  it('encodes 32 cryptographic bytes as the protocol 43-character base64url secret', async () => {
    const secret = await createCredentialSecret();
    expect(secret).toBe('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8');
    expect(secret).toMatch(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
  });

  it('registers one public activation intent and leaves routing to integration', () => {
    const module = createTerminalActivationModule();
    expect(module.moduleName).toBe(moduleName);
    expect(module.commands).toHaveLength(1);
    expect(module.commands?.[0]?.name).toBe(module.commandDefinitions?.[0]?.commandName);
    expect(module.commands?.[0]?.visibility).toBe('public');
    expect(module.commandDefinitions).toHaveLength(1);
    expect(module.actorDefinitions).toEqual([]);
    expect(module.slices).toEqual([]);
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
