import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const requireFromTest = createRequire(import.meta.url);

const adminTokens = [
  'admin-shell-surface',
  'admin-shell-foreground',
  'admin-shell-muted',
  'admin-shell-border',
  'admin-content-surface',
  'admin-content-foreground',
  'admin-content-muted',
  'admin-content-border',
  'admin-ratio-undeclared',
  'admin-inset',
  'admin-action',
  'admin-action-start',
  'admin-action-end',
  'admin-action-foreground',
  'admin-focus',
  'admin-surface-current',
  'admin-surface-noncurrent',
] as const;

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const cssPath = (name: string): string => `../../../integration/${name}/theme/global.css`;
const tailwindPath = (name: string): string => `../../../integration/${name}/tailwind.config.cjs`;

const cssTokens = (source: string): readonly string[] =>
  [...source.matchAll(/--color-(admin-[a-z-]+)\s*:/g)].map(match => match[1]!);
const tailwindColors = (name: string): Readonly<Record<string, string>> => {
  const path = fileURLToPath(new URL(tailwindPath(name), import.meta.url));
  const config = requireFromTest(path) as Readonly<{
    readonly theme: Readonly<{readonly extend: Readonly<{readonly colors: Readonly<Record<string, string>>}>}>;
  }>;
  return config.theme.extend.colors;
};

describe('admin theme token contract', () => {
  it('keeps both integration CSS variables and Tailwind mappings in the same 17-token set', () => {
    const expected = [...adminTokens].sort();
    for (const integration of ['sample-console', 'sample-wallpaper-console']) {
      expect([...new Set(cssTokens(read(cssPath(integration))))].sort()).toEqual(expected);
      expect(
        Object.keys(tailwindColors(integration))
          .filter(token => token.startsWith('admin-'))
          .sort(),
      ).toEqual(expected);
      for (const token of adminTokens) {
        expect(read(cssPath(integration))).toContain(`--color-${token}:`);
        expect(tailwindColors(integration)[token]).toBe(`rgb(var(--color-${token}) / <alpha-value>)`);
      }
    }
  });
});
