import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expectedKeys = [
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
].sort();

const relativeFiles = [
  'apps/terminal/ui/base/primitives/config/semantic-color-keys.cjs',
  'apps/terminal/application/base/android/config/index.cjs',
  'apps/terminal/ui/integration/sample-console/tailwind.config.cjs',
  'apps/terminal/ui/integration/sample-wallpaper-console/tailwind.config.cjs',
];
const requiredConfigReference = '@catering-v2s/ui-base-primitives/config/semantic-color-keys';
const semanticPrefixes = [
  'canvas',
  'surface',
  'foreground',
  'muted-foreground',
  'border',
  'action',
  'keyboard',
  'focus',
  'admin',
  'ok',
  'warn',
  'error',
  'info',
  'login',
];
const contentRoots = [
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

function collectSources(filePath, output = []) {
  const stats = fs.statSync(filePath);
  if (stats.isFile()) {
    if (/\.tsx?$/.test(filePath)) output.push(filePath);
    return output;
  }
  for (const entry of fs.readdirSync(filePath, {withFileTypes: true})) {
    if (entry.isDirectory()) collectSources(path.join(filePath, entry.name), output);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) output.push(path.join(filePath, entry.name));
  }
  return output;
}

function check(root) {
  const failures = [];
  for (const relativePath of relativeFiles) {
    if (!fs.existsSync(path.join(root, relativePath))) failures.push(`missing config source: ${relativePath}`);
  }
  if (failures.length) return failures;

  const registryPath = path.join(root, relativeFiles[0]);
  const registry = requireFromFile(registryPath);
  const actualKeys = Object.keys(registry).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    const missing = expectedKeys.filter(key => !actualKeys.includes(key));
    const extra = actualKeys.filter(key => !expectedKeys.includes(key));
    failures.push(`semantic key set mismatch: missing=[${missing.join(',')}] extra=[${extra.join(',')}]`);
  }
  for (const key of expectedKeys) {
    const expectedValue = `rgb(var(--color-${key}) / <alpha-value>)`;
    if (registry[key] !== expectedValue) failures.push(`semantic mapping mismatch: ${key}`);
  }

  const ownerConfigs = relativeFiles.slice(1).map(relativePath => ({
    relativePath,
    source: fs.readFileSync(path.join(root, relativePath), 'utf8'),
  }));
  for (const owner of ownerConfigs) {
    if (!owner.source.includes(requiredConfigReference))
      failures.push(`config owner does not consume registry: ${owner.relativePath}`);
  }
  const cssPaths = [
    'apps/terminal/ui/integration/sample-console/theme/global.css',
    'apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css',
  ];
  for (const relativePath of cssPaths) {
    const cssPath = path.join(root, relativePath);
    if (!fs.existsSync(cssPath)) {
      failures.push(`missing color stylesheet: ${relativePath}`);
      continue;
    }
    const css = fs.readFileSync(cssPath, 'utf8');
    for (const key of expectedKeys) {
      if (!css.includes(`--color-${key}:`)) failures.push(`missing CSS variable ${key}: ${relativePath}`);
    }
  }

  const dynamicPatterns = [/(?:bg|text|border|fill|stroke)-[^\s'"`]*\$\{/, /(?:bg|text|border|fill|stroke)-['"]\s*\+/];
  for (const relativePath of contentRoots) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`missing Tailwind content source: ${relativePath}`);
      continue;
    }
    for (const sourcePath of collectSources(absolutePath)) {
      const source = fs.readFileSync(sourcePath, 'utf8');
      if (dynamicPatterns.some(pattern => pattern.test(source))) {
        failures.push(`non-enumerable color utility construction: ${path.relative(root, sourcePath)}`);
      }
      for (const match of source.matchAll(/\b(?:bg|text|border|fill|stroke)-([a-z][a-z0-9-]*)/g)) {
        const key = match[1];
        if (
          semanticPrefixes.some(prefix => key === prefix || key.startsWith(`${prefix}-`)) &&
          !expectedKeys.includes(key)
        ) {
          failures.push(`undefined semantic color utility: ${key} in ${path.relative(root, sourcePath)}`);
        }
      }
    }
  }
  return failures;
}

function requireFromFile(filePath) {
  return createRequire(filePath)(filePath);
}

function runMutationSelfTest(root) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-semantic-color-red-'));
  try {
    for (const relativePath of [...relativeFiles, ...cssPathsForCopy(), ...contentRoots]) {
      const sourcePath = path.join(root, relativePath);
      const destinationPath = path.join(fixtureRoot, relativePath);
      if (!fs.existsSync(sourcePath)) throw new Error(`red fixture source missing: ${relativePath}`);
      fs.mkdirSync(path.dirname(destinationPath), {recursive: true});
      fs.cpSync(sourcePath, destinationPath, {recursive: true});
    }
    const registryPath = path.join(fixtureRoot, relativeFiles[0]);
    const original = fs.readFileSync(registryPath, 'utf8');
    const mutated = original.replace("'canvas'", "'canvas-fixture'");
    if (mutated === original) throw new Error('semantic key red mutation anchor missing');
    fs.writeFileSync(registryPath, mutated);
    const failures = check(fixtureRoot);
    const expectedFailure = failures.find(failure => failure.includes('missing=[canvas]'));
    if (!expectedFailure)
      throw new Error(`single-key mutation did not fail the frozen key-set assertion: ${failures.join('; ')}`);
    console.log(`TERMINAL_SEMANTIC_COLOR_RED=PASS first_failure="${expectedFailure}"`);

    fs.writeFileSync(registryPath, original);
    const sourceFixture = path.join(fixtureRoot, 'apps/terminal/application/android/sample-terminal/App.tsx');
    const source = fs.readFileSync(sourceFixture, 'utf8');
    fs.writeFileSync(
      sourceFixture,
      `${source}\nconst missingSemanticClass = 'bg-keyboard-fixture-missing';\nconst dynamicSemanticClass = \`bg-${'${tone}'}\`;\n`,
    );
    const contentFailures = check(fixtureRoot);
    const missingKeyFailure = contentFailures.find(failure =>
      failure.includes('undefined semantic color utility: keyboard-fixture-missing'),
    );
    const dynamicClassFailure = contentFailures.find(failure =>
      failure.includes(
        'non-enumerable color utility construction: apps/terminal/application/android/sample-terminal/App.tsx',
      ),
    );
    if (!missingKeyFailure || !dynamicClassFailure) {
      throw new Error(`content color red fixtures did not fail the owning gate: ${contentFailures.join('; ')}`);
    }
    console.log(`TERMINAL_SEMANTIC_COLOR_CONTENT_RED=PASS first_failure="${missingKeyFailure}"`);
    console.log(`TERMINAL_SEMANTIC_COLOR_DYNAMIC_RED=PASS first_failure="${dynamicClassFailure}"`);
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
}

function cssPathsForCopy() {
  return [
    'apps/terminal/ui/integration/sample-console/theme/global.css',
    'apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css',
  ];
}

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = rootIndex >= 0 ? path.resolve(args[rootIndex + 1] ?? '') : repositoryRoot;
if (args.includes('--self-test')) runMutationSelfTest(root);
const failures = check(root);
if (failures.length) {
  console.error(failures.map(failure => `SEMANTIC_COLOR_REGISTRY_FAILURE ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`TERMINAL_SEMANTIC_COLOR_REGISTRY=PASS keys=${expectedKeys.length} owners=3 css=2`);
}
