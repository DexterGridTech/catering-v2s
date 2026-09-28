import {readFileSync, readdirSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const repositoryRoot = new URL('../../../../../../', import.meta.url);
const requireFromTest = createRequire(import.meta.url);

const read = (relativePath: string): string => readFileSync(new URL(relativePath, repositoryRoot), 'utf8');
const expectedSemanticColorKeys = Object.freeze(
  [
    'canvas',
    'surface',
    'surface-elevated',
    'surface-inset',
    'foreground',
    'muted-foreground',
    'border',
    'action',
    'action-foreground',
    'keyboard-surface',
    'keyboard-key',
    'keyboard-action',
    'keyboard-key-foreground',
    'keyboard-action-foreground',
    'keyboard-border',
    'keyboard-focus',
    'focus',
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
    'ok-foreground',
    'ok-background',
    'ok-border',
    'warn-foreground',
    'warn-background',
    'warn-border',
    'error-foreground',
    'error-background',
    'error-border',
    'info-foreground',
    'info-background',
    'info-border',
    'login-surface',
    'login-foreground',
    'login-muted',
    'login-border',
    'login-inset',
    'login-focus',
    'login-action',
    'login-action-start',
    'login-action-end',
    'login-action-foreground',
    'login-icon',
  ].sort(),
);

const sourceFiles = (relativePath: string): string[] => {
  const absolutePath = new URL(relativePath, repositoryRoot);
  if (statSync(absolutePath).isFile()) return [absolutePath.pathname];
  return readdirSync(absolutePath, {withFileTypes: true}).flatMap(entry => {
    const child = `${relativePath}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.tsx?$/.test(entry.name) ? [new URL(child, repositoryRoot).pathname] : [];
  });
};

describe('Android keyboard theme contract', () => {
  it('rejects a one-key registry drift in a copied fixture', () => {
    const checkerPath = new URL(
      '../../../../../../tools/terminal-shared/check-semantic-color-registry.mjs',
      import.meta.url,
    );
    const result = spawnSync(process.execPath, [fileURLToPath(checkerPath), '--self-test'], {
      cwd: fileURLToPath(repositoryRoot),
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('TERMINAL_SEMANTIC_COLOR_RED=PASS first_failure=');
    expect(result.stdout).toContain('TERMINAL_SEMANTIC_COLOR_CONTENT_RED=PASS first_failure=');
    expect(result.stdout).toContain('TERMINAL_SEMANTIC_COLOR_DYNAMIC_RED=PASS first_failure=');
    expect(result.stdout).toContain('TERMINAL_SEMANTIC_COLOR_REGISTRY=PASS keys=57 owners=3 css=2');
  });

  it('derives all app and integration Tailwind outputs from the public semantic key registry', () => {
    const registry = requireFromTest('@catering-v2s/ui-base-primitives/config/semantic-color-keys') as Record<
      string,
      string
    >;
    const appConfigs = [
      requireFromTest(new URL('../../../android/sample-terminal/tailwind.config.cjs', import.meta.url).pathname),
      requireFromTest(
        new URL('../../../android/sample-wallpaper-terminal/tailwind.config.cjs', import.meta.url).pathname,
      ),
    ] as const;
    const integrationConfigs = [
      requireFromTest(
        new URL('../../../../ui/integration/sample-console/tailwind.config.cjs', import.meta.url).pathname,
      ),
      requireFromTest(
        new URL('../../../../ui/integration/sample-wallpaper-console/tailwind.config.cjs', import.meta.url).pathname,
      ),
    ] as const;

    expect(Object.keys(registry).sort()).toEqual(expectedSemanticColorKeys);
    for (const [name, mapping] of Object.entries(registry)) {
      expect(mapping).toBe(`rgb(var(--color-${name}) / <alpha-value>)`);
      for (const config of [...appConfigs, ...integrationConfigs]) {
        expect(config.theme.extend.colors[name]).toBe(mapping);
        expect(Object.keys(config.theme.extend.colors).sort()).toEqual(Object.keys(registry).sort());
      }
      for (const cssPath of [
        'apps/terminal/ui/integration/sample-console/theme/global.css',
        'apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css',
      ])
        expect(read(cssPath)).toContain(`--color-${name}:`);
    }
  });

  it('keeps semantic utility names statically enumerable in every Tailwind content source', () => {
    const roots = [
      'apps/terminal/application/android/sample-terminal/App.tsx',
      'apps/terminal/application/android/sample-terminal/src',
      'apps/terminal/application/android/sample-wallpaper-terminal/App.tsx',
      'apps/terminal/application/android/sample-wallpaper-terminal/src',
      'apps/terminal/ui/integration/sample-console/src',
      'apps/terminal/ui/integration/sample-console/test-expo',
      'apps/terminal/ui/integration/sample-wallpaper-console/src',
      'apps/terminal/ui/integration/sample-wallpaper-console/test-expo',
      'apps/terminal/ui/base/primitives/src',
    ];
    const unenumerableUtility = /(?:bg|text|border|fill|stroke)-[^\s'"`]*\$\{|(?:bg|text|border|fill|stroke)-['"]\s*\+/;
    const violations = roots
      .flatMap(root => sourceFiles(root))
      .flatMap(file => {
        const source = readFileSync(file, 'utf8');
        return unenumerableUtility.test(source) ? [file] : [];
      });
    expect(violations).toEqual([]);
  });
});
