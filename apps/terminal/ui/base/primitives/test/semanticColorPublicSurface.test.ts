import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  readonly exports: Record<string, string>;
};
const invariants = JSON.parse(readFileSync(new URL('../terminal-invariants.json', import.meta.url), 'utf8')) as {
  readonly publicExportMap: Record<string, string>;
};

describe('primitives semantic color public config', () => {
  it('keeps the package export map, invariant map, and resolved target exact', () => {
    expect(invariants.publicExportMap).toEqual(packageJson.exports);
    for (const target of Object.values(packageJson.exports)) {
      expect(existsSync(new URL(`../${target.replace(/^\.\//, '')}`, import.meta.url))).toBe(true);
    }
  });

  it('exports a nonempty exact CSS-variable map through the public subpath', () => {
    const colors = requireFromTest('@catering-v2s/ui-base-primitives/config/semantic-color-keys') as Record<
      string,
      string
    >;
    expect(Object.keys(colors).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(colors)) {
      expect(value).toBe(`rgb(var(--color-${key}) / <alpha-value>)`);
    }
  });
});
