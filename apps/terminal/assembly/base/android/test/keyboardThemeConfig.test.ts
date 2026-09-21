import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const repositoryRoot = new URL('../../../../../../', import.meta.url);
const requireFromTest = createRequire(import.meta.url);

const read = (relativePath: string): string => readFileSync(new URL(relativePath, repositoryRoot), 'utf8');

const keyboardColors = Object.freeze([
  'keyboard-surface',
  'keyboard-key',
  'keyboard-action',
  'keyboard-key-foreground',
  'keyboard-action-foreground',
  'keyboard-border',
  'keyboard-focus',
]);

const adminColors = Object.freeze([
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
]);

describe('Android keyboard theme contract', () => {
  it('keeps sharedColors and both Android app Tailwind configs aligned', () => {
    const sharedConfig = read('apps/terminal/assembly/base/android/config/index.cjs');
    const appConfigs = [
      requireFromTest(new URL('../../../android/sample-terminal/tailwind.config.cjs', import.meta.url).pathname),
      requireFromTest(new URL('../../../android/sample-wallpaper-terminal/tailwind.config.cjs', import.meta.url).pathname),
    ] as const;
    for (const name of keyboardColors) {
      const mapping = `rgb(var(--color-${name}) / <alpha-value>)`;
      expect(sharedConfig).toContain(`'${name}': '${mapping}'`);
      for (const appConfig of appConfigs) expect(appConfig.theme.extend.colors[name]).toBe(mapping);
    }
  });

  it('keeps admin semantic tokens inherited by both Android app configs', () => {
    const sharedConfig = read('apps/terminal/assembly/base/android/config/index.cjs');
    const appConfigs = [
      requireFromTest(new URL('../../../android/sample-terminal/tailwind.config.cjs', import.meta.url).pathname),
      requireFromTest(new URL('../../../android/sample-wallpaper-terminal/tailwind.config.cjs', import.meta.url).pathname),
    ] as const;
    for (const name of adminColors) {
      const mapping = `rgb(var(--color-${name}) / <alpha-value>)`;
      expect(sharedConfig).toContain(`'${name}': '${mapping}'`);
      for (const appConfig of appConfigs) expect(appConfig.theme.extend.colors[name]).toBe(mapping);
    }
  });
});
