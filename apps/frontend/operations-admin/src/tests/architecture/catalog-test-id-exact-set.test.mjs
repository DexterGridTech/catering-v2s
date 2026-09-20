import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const COMPONENT_ROOT = new URL('../../features/catalog-management/ui/', import.meta.url);
const CATALOG_IDS_URL = new URL('../../features/catalog-management/catalogTestIds.ts', import.meta.url);
const LOCATOR_BINDINGS_URL = new URL(
  '../../../../../../contracts/policy/catalog-inventory-l2-locator-bindings.json',
  import.meta.url,
);
const COMPONENT_FILES = fs
  .readdirSync(COMPONENT_ROOT, {recursive: true})
  .filter(file => typeof file === 'string' && file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
  .sort();
const COMPONENT_PATHS = new Set(
  COMPONENT_FILES.map(file => `apps/frontend/operations-admin/src/features/catalog-management/ui/${file}`),
);

function readComponent(file) {
  return fs.readFileSync(new URL(file, COMPONENT_ROOT), 'utf8');
}

function rawStaticTestIds(source) {
  const matches = [];
  const pattern = /testId\(([^)]*)\)/g;
  let match;
  while ((match = pattern.exec(source))) {
    for (const literal of match[1].matchAll(/(?:'([^'$\n]+)'|"([^"$\n]+)"|`([^`$\n]+)`)/g)) {
      const value = literal[1] ?? literal[2] ?? literal[3];
      if (value.startsWith('catalog-')) matches.push(value);
    }
  }
  const attributePattern = /\b(?:testId|testIdValue|testIdPrefix)\s*(?:=|:)\s*([^,\n}]+)/g;
  while ((match = attributePattern.exec(source))) {
    for (const literal of match[1].matchAll(/(?:'([^'$\n]+)'|"([^"$\n]+)")/g)) {
      const value = literal[1] ?? literal[2];
      if (value.startsWith('catalog-')) matches.push(value);
    }
  }
  return matches;
}

function parseStaticVocabulary(source) {
  const start = source.indexOf('  static: {');
  const end = source.indexOf('\n  },\n} as const;', start);
  assert.ok(start >= 0 && end > start, 'catalogTestIds.ts must expose the static vocabulary block');
  const block = source.slice(start, end);
  const entries = [...block.matchAll(/^    ([A-Za-z_$][\w$]*): '([^']+)',$/gm)].map(match => [match[1], match[2]]);
  assert.ok(entries.length > 0, 'catalogTestIds.ts static vocabulary must not be empty');
  return new Map(entries);
}

function collectLocatorExactIds(value, output = new Set()) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach(entry => collectLocatorExactIds(entry, output));
    return output;
  }
  if (Array.isArray(value.sourceFiles) && value.sourceFiles.some(file => COMPONENT_PATHS.has(file))) {
    if (typeof value.testId === 'string' && !value.testId.includes('${')) output.add(value.testId);
    if (Array.isArray(value.alternatives)) {
      value.alternatives.filter(id => typeof id === 'string' && !id.includes('${')).forEach(id => output.add(id));
    }
  }
  Object.values(value).forEach(entry => collectLocatorExactIds(entry, output));
  return output;
}

test('catalog component static testIds have one exact vocabulary and resolve locator bindings', () => {
  const catalogIds = fs.readFileSync(CATALOG_IDS_URL, 'utf8');
  const staticVocabulary = parseStaticVocabulary(catalogIds);
  const sourceKeys = new Set();
  const rawIds = [];

  for (const file of COMPONENT_FILES) {
    const source = readComponent(file);
    rawIds.push(...rawStaticTestIds(source).map(id => `${file}:${id}`));
    for (const match of source.matchAll(/catalogTestIds\.static\.([A-Za-z_$][\w$]*)/g)) sourceKeys.add(match[1]);
  }

  assert.deepEqual(rawIds, [], `catalog component files contain scattered static testIds: ${rawIds.join(', ')}`);
  assert.deepEqual(
    [...sourceKeys].sort(),
    [...staticVocabulary.keys()].sort(),
    'catalogTestIds.static keys must be exactly the keys consumed by the scoped catalog components',
  );
  assert.equal(
    new Set(staticVocabulary.values()).size,
    staticVocabulary.size,
    'catalogTestIds.static must not assign one literal to multiple static keys',
  );

  const allCatalogLiterals = new Set(
    [...catalogIds.matchAll(/["'`](catalog-[^"'`$\n]+)["'`]/g)].map(match => match[1]),
  );
  const bindings = JSON.parse(fs.readFileSync(LOCATOR_BINDINGS_URL, 'utf8'));
  const locatorIds = collectLocatorExactIds(bindings);
  const missingFromVocabulary = [...locatorIds].filter(id => !allCatalogLiterals.has(id)).sort();
  assert.deepEqual(
    missingFromVocabulary,
    [],
    `locator bindings refer to testIds absent from catalogTestIds.ts: ${missingFromVocabulary.join(', ')}`,
  );
  const dynamicFactories = {
    CATALOG_MEDIA: 'media: (businessIdentity',
    CATALOG_ITEM_ROW: 'catalogItemRowTestId',
    CATALOG_ITEM_SELECTION: 'catalogItemSelectionTestId',
    CATALOG_CATEGORY_NODE: 'categoryNode: (categoryCode',
    CATALOG_CATEGORY_EXPANDER: 'categoryExpander: (categoryCode',
    CATALOG_PRODUCTION_TAG_NODE: 'productionTagNode: (tagCode',
    CATALOG_ITEM_TAB: 'catalogItemTabTestId',
  };
  for (const [controlKey, binding] of Object.entries(bindings.controls)) {
    if (!binding.testIdFactory) continue;
    const marker = dynamicFactories[binding.testIdFactory];
    assert.ok(marker, `locator binding uses an unknown dynamic testId factory: ${controlKey}`);
    assert.equal(
      binding.testIdTemplate,
      undefined,
      `dynamic testId binding must not downgrade its factory to a raw template: ${controlKey}`,
    );
    assert.match(catalogIds, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
