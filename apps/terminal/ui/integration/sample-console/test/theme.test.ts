import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {render} from '@testing-library/react-native';
import {describe, expect, it} from 'vitest';
import {createSampleAssembly as createProductionSampleAssembly, createSurfaceForDisplayIndex} from '../src';
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing';
import {createTestPlatformPorts, type TestPlatformPorts} from './support';
import {queryRenderedTree} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

type TestSampleAssemblyInput = Omit<
  Parameters<typeof createProductionSampleAssembly>[0],
  'platformPorts' | 'nativeLoadingCapability'
> &
  Readonly<{
    readonly platformPorts: TestPlatformPorts;
  }>;

const createSampleAssembly = (input: TestSampleAssemblyInput) =>
  createProductionSampleAssembly({
    ...input,
    nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
  });
const requireFromTest = createRequire(import.meta.url);

describe('sample-console app theme wiring', () => {
  it('maps every primitive semantic token to this app theme', () => {
    const css = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8');
    const tailwind = requireFromTest(new URL('../tailwind.config.cjs', import.meta.url).pathname) as {
      theme: {extend: {colors: Record<string, string>}};
    };
    const semanticColors = requireFromTest('@catering-v2s/ui-base-primitives/config/semantic-color-keys') as Record<
      string,
      string
    >;
    const primitiveTokens = readFileSync(
      new URL('../../../base/primitives/src/theme/tokens.ts', import.meta.url),
      'utf8',
    );
    expect(Object.keys(tailwind.theme.extend.colors).sort()).toEqual(Object.keys(semanticColors).sort());
    for (const [semanticName, mapping] of Object.entries(semanticColors)) {
      expect(tailwind.theme.extend.colors[semanticName]).toBe(mapping);
      expect(css).toContain(`--color-${semanticName}:`);
    }
    expect(primitiveTokens).toContain('bg-canvas');
    expect(primitiveTokens).toContain('text-foreground');
    expect(primitiveTokens).toContain('border-border');
    expect(primitiveTokens).toContain('bg-action');
    expect(primitiveTokens).toContain('text-action-foreground');
    expect(primitiveTokens).toContain('bg-transparent');
    expect(primitiveTokens).toContain('bg-keyboard-surface');
    expect(primitiveTokens).toContain('bg-keyboard-key');
    expect(primitiveTokens).toContain('bg-keyboard-action');
    expect(primitiveTokens).toContain('border-keyboard-focus');
  });

  it('keeps focus treatment owned by each integration theme', () => {
    const sampleConsoleCss = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8');
    const wallpaperCss = readFileSync(
      new URL('../../sample-wallpaper-console/theme/global.css', import.meta.url),
      'utf8',
    );
    const token = (source: string, name: string): string => {
      const match = source.match(new RegExp(`--color-${name}:\\s*([^;]+)`));
      if (match === null) throw new Error(`missing token ${name}`);
      return match[1]!.trim();
    };
    expect(token(sampleConsoleCss, 'focus')).not.toBe(token(wallpaperCss, 'focus'));
  });

  it('keeps keyboard planes neutral and lets focus follow the integration theme', () => {
    const sampleConsoleCss = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8');
    const wallpaperCss = readFileSync(
      new URL('../../sample-wallpaper-console/theme/global.css', import.meta.url),
      'utf8',
    );
    const token = (source: string, name: string): string => {
      const match = source.match(new RegExp(`--color-${name}:\\s*([^;]+)`));
      if (match === null) throw new Error(`missing token ${name}`);
      return match[1]!.trim();
    };
    for (const name of [
      'keyboard-surface',
      'keyboard-key',
      'keyboard-action',
      'keyboard-key-foreground',
      'keyboard-action-foreground',
      'keyboard-border',
    ]) {
      expect(token(sampleConsoleCss, name)).toBe(token(wallpaperCss, name));
    }
    expect(token(sampleConsoleCss, 'keyboard-key')).toBe(token(sampleConsoleCss, 'keyboard-action'));
    expect(token(sampleConsoleCss, 'keyboard-focus')).not.toBe(token(wallpaperCss, 'keyboard-focus'));
  });

  it('renders the app surface through the primitive semantic token path', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-theme-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      const renderer = await render(createSurfaceForDisplayIndex(assembly, 0));
      const canvasNodes = queryRenderedTree(
        renderer,
        node =>
          typeof node.props.className === 'string' &&
          (node.props.className as string).split(/\s+/).includes('bg-canvas'),
      );
      expect(canvasNodes.length).toBeGreaterThan(0);
      await renderer.unmount();
    } finally {
      releaseRuntimeForTest(assembly.runtime);
    }
  });
});
