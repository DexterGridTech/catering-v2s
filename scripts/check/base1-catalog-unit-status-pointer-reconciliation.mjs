#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const designRelativePath = 'doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-codex.md';
const generatorRelativePath = 'scripts/generate/catalog-inventory-p1.mjs';
const generatedTypeRelativePath = 'apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts';
const artifactRelativePath = 'doc/evidence/platform/2026-08-29-v2s-base-1-catalog-unit-status-pointer-reconciliation.json';
const generatorPath = path.join(root, generatorRelativePath);
const generatedTypePath = path.join(root, generatedTypeRelativePath);
const artifactPath = path.join(root, artifactRelativePath);

const pointerDefinitions = Object.freeze([
  {
    pointer: 'CatalogUnitList.data.units[].status',
    contractFile: 'contracts/openapi/components/catalog/catalog-dictionary.schemas.json',
    schema: 'CatalogUnitList',
    steps: ['data', 'units', '[]', 'status'],
    generatorDeclaration: 'CatalogUnitList.data.units[].status',
    generatorBinding: 'enumLabels.dictionaryEntryStatus',
  },
  {
    pointer: 'CatalogUnitReadback.result.unit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-dictionary.schemas.json',
    schema: 'CatalogUnitReadback',
    steps: ['result', 'unit', 'status'],
    generatorDeclaration: 'CatalogUnitReadback.result.unit.status',
    generatorBinding: 'enumLabels.dictionaryEntryStatus',
  },
  {
    pointer: 'CatalogItemPage.data.items[].salesUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-workbench.schemas.json',
    schema: 'CatalogItemPage',
    steps: ['data', 'items', '[]', 'salesUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemPage.data.items[].baseMeasureUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-workbench.schemas.json',
    schema: 'CatalogItemPage',
    steps: ['data', 'items', '[]', 'baseMeasureUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemDetail.data.item.salesUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemDetail',
    steps: ['data', 'item', 'salesUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemDetail.data.item.baseMeasureUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemDetail',
    steps: ['data', 'item', 'baseMeasureUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemDetail.data.item.skus[].salesUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemDetail',
    steps: ['data', 'item', 'skus', '[]', 'salesUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemDetail.data.item.skus[].baseMeasureUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemDetail',
    steps: ['data', 'item', 'skus', '[]', 'baseMeasureUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemSkuPage.data.items[].salesUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemSkuPage',
    steps: ['data', 'items', '[]', 'salesUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemSkuPage.data.items[].baseMeasureUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemSkuPage',
    steps: ['data', 'items', '[]', 'baseMeasureUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemSaveReadback.result.item.salesUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemSaveReadback',
    steps: ['result', 'item', 'salesUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
  {
    pointer: 'CatalogItemSaveReadback.result.item.baseMeasureUnit.status',
    contractFile: 'contracts/openapi/components/catalog/catalog-item.schemas.json',
    schema: 'CatalogItemSaveReadback',
    steps: ['result', 'item', 'baseMeasureUnit', 'status'],
    generatorDeclaration: 'catalogUnitAssignmentSchema.status',
    generatorBinding: 'catalogUnitAssignmentSchema',
  },
]);

const generatedTypeOccurrenceCounts = Object.freeze({
  CatalogUnitList: 1,
  CatalogUnitReadback: 1,
  CatalogItemPage: 2,
  CatalogItemDetail: 4,
  CatalogItemSkuPage: 2,
  CatalogItemSaveReadback: 2,
});

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sameSet(actual, expected, code, detail = '') {
  if (!Array.isArray(actual) || actual.length !== expected.length || new Set(actual).size !== actual.length) {
    fail(code, detail || `${JSON.stringify(actual)}!=${JSON.stringify(expected)}`);
  }
  if (expected.some(value => !actual.includes(value))) fail(code, detail || `${JSON.stringify(actual)}!=${JSON.stringify(expected)}`);
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readText(relativePath) {
  try {
    return readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    fail('BASE1_STATUS_POINTER_SOURCE_READ_FAILED', relativePath);
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    if (error.code?.startsWith('BASE1_')) throw error;
    fail('BASE1_STATUS_POINTER_JSON_INVALID', relativePath);
  }
}

function sha256File(relativePath) {
  try {
    return sha256Bytes(readFileSync(path.join(root, relativePath)));
  } catch {
    fail('BASE1_STATUS_POINTER_SOURCE_READ_FAILED', relativePath);
  }
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) fail('BASE1_STATUS_POINTER_GENERATOR_SECTION_MISSING', startMarker);
  return source.slice(start, end);
}

function quotedValues(text) {
  return [...text.matchAll(/['"]([A-Z][A-Z0-9_]*)['"]/g)].map(match => match[1]);
}

function extractGeneratorVocabulary(generatorSource) {
  const dictionaryMatch = generatorSource.match(/dictionaryEntryStatus:\s*\{([^}]*)\}/s);
  if (!dictionaryMatch) fail('BASE1_STATUS_POINTER_DICTIONARY_VOCABULARY_MISSING');
  const dictionaryValues = [...dictionaryMatch[1].matchAll(/\b([A-Z][A-Z0-9_]*)\s*:/g)].map(match => match[1]);
  const assignmentSection = section(
    generatorSource,
    'const catalogUnitAssignmentSchema =',
    'const inventoryRuleModeSchema =',
  );
  const assignmentMatch = assignmentSection.match(/status:\s*\{[\s\S]*?enum:\s*\[([^\]]+)\]/);
  if (!assignmentMatch) fail('BASE1_STATUS_POINTER_ASSIGNMENT_VOCABULARY_MISSING');
  const assignmentValues = quotedValues(assignmentMatch[1]);
  const unitListSection = section(generatorSource, '  CatalogUnitList: {', '  CatalogCategoryCandidatePage: {');
  const unitReadbackSection = section(generatorSource, '  CatalogUnitReadback: {', '  CatalogItemCommandReadback: {');
  for (const [name, value] of [
    ['CatalogUnitList', unitListSection],
    ['CatalogUnitReadback', unitReadbackSection],
  ]) {
    if (!value.includes("enum: enumValues('dictionaryEntryStatus')")) {
      fail('BASE1_STATUS_POINTER_GENERATOR_VOCABULARY_WIRING_MISSING', name);
    }
  }
  sameSet(assignmentValues, dictionaryValues, 'BASE1_STATUS_POINTER_GENERATOR_VOCABULARY_DRIFT');
  return {
    dictionaryValues,
    assignmentValues,
    declarations: {
      CatalogUnitList: 'enumValues(\'dictionaryEntryStatus\')',
      CatalogUnitReadback: 'enumValues(\'dictionaryEntryStatus\')',
      catalogUnitAssignmentSchema: assignmentValues,
    },
  };
}

function extractApprovedBaseline(designSource) {
  const baselineMatch = designSource.match(/三处都从\s+`([^`]+)`\s+改为\s+`([^`]+)`/s);
  if (!baselineMatch) fail('BASE1_STATUS_POINTER_APPROVED_BASELINE_MISSING');
  const beforeValues = baselineMatch[1].split('/').filter(Boolean);
  const statedAfterValues = baselineMatch[2].split('/').filter(Boolean);
  if (beforeValues.length !== 2 || statedAfterValues.length !== 3) {
    fail('BASE1_STATUS_POINTER_APPROVED_BASELINE_SHAPE_INVALID');
  }
  const pointerSectionStart = designSource.indexOf('generated response JSON pointer');
  const pointerSectionEnd = designSource.indexOf('不得只修最终', pointerSectionStart);
  if (pointerSectionStart < 0 || pointerSectionEnd < 0) fail('BASE1_STATUS_POINTER_DESIGN_LIST_MISSING');
  const pointers = [...designSource.slice(pointerSectionStart, pointerSectionEnd).matchAll(/^\s*\d+\.\s+`([^`]+)`\s*$/gm)].map(
    match => match[1],
  );
  if (pointers.length !== pointerDefinitions.length) fail('BASE1_STATUS_POINTER_DESIGN_LIST_COUNT_INVALID');
  sameSet(
    pointers,
    pointerDefinitions.map(definition => definition.pointer),
    'BASE1_STATUS_POINTER_DESIGN_LIST_SET_INVALID',
  );
  return {beforeValues, statedAfterValues, pointers};
}

function schemaAtPath(schema, steps) {
  let current = schema;
  for (const step of steps) {
    if (step === '[]') current = current?.items;
    else current = current?.properties?.[step];
  }
  return current;
}

function schemaJsonPath(schemaName, steps) {
  return [
    `/components/schemas/${schemaName}`,
    ...steps.map(step => (step === '[]' ? '/items' : `/properties/${step}`)),
  ].join('');
}

function generatedTypeEvidence(generatedTypeSource, values) {
  const evidence = {};
  const enumLiteral = values.map(value => JSON.stringify(value)).join(' | ');
  for (const [schemaName, expectedOccurrences] of Object.entries(generatedTypeOccurrenceCounts)) {
    const aliasMatch = generatedTypeSource.match(
      new RegExp(`export type ${escapeRegExp(schemaName)} = ([\\s\\S]*?);\\n`),
    );
    if (!aliasMatch) fail('BASE1_STATUS_POINTER_GENERATED_TYPE_ALIAS_MISSING', schemaName);
    const occurrenceCount = [...aliasMatch[1].matchAll(new RegExp(escapeRegExp(enumLiteral), 'g'))].length;
    if (occurrenceCount !== expectedOccurrences) {
      fail('BASE1_STATUS_POINTER_GENERATED_TYPE_ENUM_OCCURRENCE_INVALID', `${schemaName}:${occurrenceCount}`);
    }
    evidence[schemaName] = {
      file: generatedTypeRelativePath,
      alias: `export type ${schemaName}`,
      exactAssignmentEnum: values,
      exactAssignmentEnumOccurrenceCount: occurrenceCount,
      expectedAssignmentEnumOccurrenceCount: expectedOccurrences,
    };
  }
  return evidence;
}

function buildReport() {
  const designSource = readText(designRelativePath);
  const generatorSource = readText(generatorRelativePath);
  const generatedTypeSource = readText(generatedTypeRelativePath);
  const design = extractApprovedBaseline(designSource);
  const generator = extractGeneratorVocabulary(generatorSource);
  sameSet(generator.assignmentValues, design.statedAfterValues, 'BASE1_STATUS_POINTER_GENERATOR_AFTER_SET_INVALID');
  const generatedTypes = generatedTypeEvidence(generatedTypeSource, generator.assignmentValues);
  const contractDocs = new Map();
  for (const definition of pointerDefinitions) {
    if (!contractDocs.has(definition.contractFile)) contractDocs.set(definition.contractFile, readJson(definition.contractFile));
  }
  const contractDigests = Object.fromEntries(
    [...contractDocs.keys()].map(relativePath => [relativePath, sha256File(relativePath)]),
  );
  const pointers = pointerDefinitions.map(definition => {
    const document = contractDocs.get(definition.contractFile);
    const schema = document?.schemas?.[definition.schema];
    if (!schema) fail('BASE1_STATUS_POINTER_CONTRACT_SCHEMA_MISSING', `${definition.contractFile}:${definition.schema}`);
    const node = schemaAtPath(schema, definition.steps);
    if (!Array.isArray(node?.enum)) fail('BASE1_STATUS_POINTER_CONTRACT_ENUM_MISSING', definition.pointer);
    sameSet(node.enum, generator.assignmentValues, 'BASE1_STATUS_POINTER_CONTRACT_ENUM_INVALID', definition.pointer);
    return {
      pointer: definition.pointer,
      before: {
        values: design.beforeValues,
        provenance: {
          kind: 'APPROVED_DESIGN_BASELINE_NOT_HISTORICAL_BYTE_SNAPSHOT',
          file: designRelativePath,
          section: 'catalog unit status declarations and the 12 generated response JSON pointers',
        },
      },
      after: {
        values: node.enum,
        provenance: {
          kind: 'CURRENT_REPOSITORY_BYTES',
          generator: {
            file: generatorRelativePath,
            declaration: definition.generatorDeclaration,
            binding: definition.generatorBinding,
            sha256: sha256File(generatorRelativePath),
          },
          contract: {
            file: definition.contractFile,
            schema: definition.schema,
            jsonPath: schemaJsonPath(definition.schema, definition.steps),
            sha256: contractDigests[definition.contractFile],
          },
          generatedType: generatedTypes[definition.schema],
        },
      },
      comparison: 'EXACT_SET',
      status: 'PASS',
    };
  });
  const report = {
    schemaVersion: 1,
    kind: 'base1-catalog-unit-status-pointer-reconciliation',
    scope: 'base-1 catalog unit status generated response pointers',
    designBaseline: {
      file: designRelativePath,
      beforeValues: design.beforeValues,
      statedAfterValues: design.statedAfterValues,
      pointerCount: design.pointers.length,
      pointers: design.pointers,
    },
    generator: {
      file: generatorRelativePath,
      sha256: sha256File(generatorRelativePath),
      dictionaryEntryStatusValues: generator.dictionaryValues,
      catalogUnitAssignmentSchemaStatusValues: generator.assignmentValues,
      unitListAndReadbackBinding: generator.declarations,
    },
    generatedTypeSource: {
      file: generatedTypeRelativePath,
      sha256: sha256File(generatedTypeRelativePath),
      aliases: generatedTypes,
    },
    pointers,
    summary: {
      pointerCount: pointers.length,
      passedCount: pointers.filter(pointer => pointer.status === 'PASS').length,
      beforeValues: design.beforeValues,
      afterValues: generator.assignmentValues,
      allExactSetComparisons: pointers.every(pointer => pointer.comparison === 'EXACT_SET' && pointer.status === 'PASS'),
    },
  };
  report.evidenceDigest = sha256Bytes(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const report = buildReport();
const mode = process.argv[2] ?? '--check';
if (mode === '--write') {
  writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `BASE1_STATUS_POINTER_RECONCILIATION=PASS; POINTERS=${report.summary.pointerCount}; ARTIFACT=${artifactRelativePath}; EVIDENCE_DIGEST=${report.evidenceDigest}\n`,
  );
} else if (mode === '--check') {
  let existing;
  try {
    existing = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch {
    fail('BASE1_STATUS_POINTER_ARTIFACT_MISSING', artifactRelativePath);
  }
  if (JSON.stringify(existing) !== JSON.stringify(report)) fail('BASE1_STATUS_POINTER_ARTIFACT_DRIFT', artifactRelativePath);
  process.stdout.write(
    `BASE1_STATUS_POINTER_RECONCILIATION=PASS; POINTERS=${report.summary.pointerCount}; ARTIFACT=${artifactRelativePath}; EVIDENCE_DIGEST=${report.evidenceDigest}\n`,
  );
} else {
  fail('BASE1_STATUS_POINTER_MODE_INVALID', mode);
}
