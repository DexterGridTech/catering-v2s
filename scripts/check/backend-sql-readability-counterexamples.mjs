#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repositoryRoot = path.resolve(process.cwd());
const args = process.argv.slice(2);

const files = {
  definitionSql: 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogDefinitionFactsSql.java',
  definitionConsumer: 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogDefinitionFacts.java',
  workbenchSql: 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadServiceSql.java',
  workbenchConsumer: 'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadPersistence.java',
};

const names = {
  definitionLimit:
    'CATALOG_DEFINITION_FACTS_ORDER_BY_NAME_CODE_ORDER_OPTION_DEFINITION_REF_LIMIT_NAME_CODE_ORDER_OPTION_DEFINITION_REF_LIMIT',
  workbenchExternal:
    'CATALOG_WORKBENCH_READ_SERVICE_COALESCE_SECTIONS_SOURCE_SECTIONS_SOURCETYPE_SECTIONS_OWNERSHIPSOURCE_EXTERNAL_ORDER_TEMPORARY_SOURCETYPE_SECTIONS_OWNERSHIPSOURCE_EXTERNAL_ORDER_TEMPORARY',
  workbenchAutoSync:
    'CATALOG_WORKBENCH_READ_SERVICE_COALESCE_SECTIONS_SOURCE_SECTIONS_SOURCETYPE_SECTIONS_OWNERSHIPSOURCE_AUTO_SYNC_COUNT_FILTER_NOT_EXISTS_SELECT_FROM',
  workbenchFilter: 'CATALOG_WORKBENCH_READ_SERVICE_FILTER',
  workbenchFilterStatus: 'CATALOG_WORKBENCH_READ_SERVICE_FILTER_STATUS_DISABLED',
  workbenchFilterUpdatedAt: 'CATALOG_WORKBENCH_READ_SERVICE_FILTER_UPDATED_AT_EPOCH_MILLIS',
  workbenchFilterAlternate: 'CATALOG_WORKBENCH_READ_SERVICE_FILTER_ALTERNATE_A',
  workbenchCatalogItem: 'CATALOG_WORKBENCH_READ_SERVICE_CATALOG_ITEM_CATEGORY_RELATION_ITEM_REF_CATALOG_ITEM',
};

function readSources(root) {
  return Object.fromEntries(
    Object.entries(files).map(([key, relative]) => [key, fs.readFileSync(path.join(root, relative), 'utf8')]),
  );
}

function definitionReference(name) {
  return `CatalogDefinitionFactsSql.${name}`;
}

function workbenchReference(name) {
  return `CatalogWorkbenchReadServiceSql.${name}`;
}

function failuresFor(source) {
  const failures = [];
  const definitionLimitReference = definitionReference(names.definitionLimit);
  const externalReference = workbenchReference(names.workbenchExternal);
  const autoSyncReference = workbenchReference(names.workbenchAutoSync);
  const orderedWorkbenchReferences = [
    workbenchReference(names.workbenchFilter),
    externalReference,
    workbenchReference(names.workbenchFilterStatus),
    workbenchReference(names.workbenchFilterUpdatedAt),
    workbenchReference(names.workbenchFilterAlternate),
    autoSyncReference,
    workbenchReference(names.workbenchCatalogItem),
  ];

  if (!source.definitionSql.includes('ORDER BY name,code,order_option_definition_ref LIMIT ?')) {
    failures.push('DEFINITION_LIMIT_WORD_MIDDLE_FRAGMENT_NOT_MERGED');
  }
  if (!source.definitionSql.includes(`String ${names.definitionLimit}`)) {
    failures.push('DEFINITION_LIMIT_HOLDER_MISSING');
  }
  if (!source.definitionConsumer.includes(`+ statusPredicate + ${definitionLimitReference}`)) {
    failures.push('DEFINITION_STATUS_BEFORE_LIMIT_SEQUENCE_MISSING');
  }
  if (/(?:^|[^A-Za-z0-9_])[A-Z][A-Z0-9_]*_LIM\b/.test(source.definitionSql + source.definitionConsumer)) {
    failures.push('DEFINITION_OLD_SPLIT_LIMIT_REFERENCE_REMAINS');
  }
  if (source.definitionConsumer.includes('CONTINUATION')) {
    failures.push('DEFINITION_CONTINUATION_REFERENCE_REMAINS');
  }

  if (!source.workbenchSql.includes("='EXTERNAL_ORDER_TEMPORARY'),\\s")) {
    failures.push('WORKBENCH_EXTERNAL_FRAGMENT_MISSING');
  }
  if (!source.workbenchSql.includes("='AUTO_SYNC'), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM\\s")) {
    failures.push('WORKBENCH_AUTO_SYNC_FRAGMENT_MISSING');
  }
  let previous = -1;
  for (const reference of orderedWorkbenchReferences) {
    const index = source.workbenchConsumer.indexOf(reference);
    if (index < 0) {
      failures.push(`WORKBENCH_REFERENCE_MISSING:${reference}`);
      continue;
    }
    if (index <= previous) failures.push(`WORKBENCH_REFERENCE_ORDER_CHANGED:${reference}`);
    previous = index;
  }
  if (!source.workbenchConsumer.includes('new Object[] {recentlyUpdatedSince, dataNodeRef, brandRef}')) {
    failures.push('WORKBENCH_PARAMETER_ORDER_CHANGED');
  }
  return failures;
}

function assertPass(source, label) {
  const failures = failuresFor(source);
  if (failures.length > 0) throw new Error(`${label}:${failures.join(',')}`);
}

function expectFailure(source, expected, label) {
  const failures = failuresFor(source);
  if (!failures.includes(expected)) {
    throw new Error(`${label}:RED_MUTATION_NOT_DETECTED:${expected}:${failures.join(',')}`);
  }
}

function runSelfTest() {
  const fixture = {
    definitionSql: `public static final String ${names.definitionLimit} = "ORDER BY name,code,order_option_definition_ref LIMIT ?";`,
    definitionConsumer: `query(foo + statusPredicate + CatalogDefinitionFactsSql.${names.definitionLimit});`,
    workbenchSql: `public static final String ${names.workbenchExternal} = "='EXTERNAL_ORDER_TEMPORARY'),\\s";
public static final String ${names.workbenchAutoSync} = "='AUTO_SYNC'), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM\\s";`,
    workbenchConsumer: `CatalogWorkbenchReadServiceSql.${names.workbenchFilter}
+ CatalogWorkbenchReadServiceSql.${names.workbenchExternal}
+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterStatus}
+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterUpdatedAt}
+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterAlternate}
+ CatalogWorkbenchReadServiceSql.${names.workbenchAutoSync}
+ CatalogWorkbenchReadServiceSql.${names.workbenchCatalogItem}
new Object[] {recentlyUpdatedSince, dataNodeRef, brandRef}`,
  };

  assertPass(fixture, 'BASE_FIXTURE');

  const swappedDefinition = {
    ...fixture,
    definitionConsumer: fixture.definitionConsumer.replace(
      `statusPredicate + CatalogDefinitionFactsSql.${names.definitionLimit}`,
      `CatalogDefinitionFactsSql.${names.definitionLimit} + statusPredicate`,
    ),
  };
  expectFailure(swappedDefinition, 'DEFINITION_STATUS_BEFORE_LIMIT_SEQUENCE_MISSING', 'DEFINITION_ORDER');

  const swappedWorkbench = {
    ...fixture,
    workbenchConsumer: fixture.workbenchConsumer.replace(
      `+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterUpdatedAt}\n+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterAlternate}`,
      `+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterAlternate}\n+ CatalogWorkbenchReadServiceSql.${names.workbenchFilterUpdatedAt}`,
    ),
  };
  expectFailure(swappedWorkbench, 'WORKBENCH_REFERENCE_ORDER_CHANGED:CatalogWorkbenchReadServiceSql.' + names.workbenchFilterAlternate, 'WORKBENCH_FRAGMENT_ORDER');

  const swappedParameters = {
    ...fixture,
    workbenchConsumer: fixture.workbenchConsumer.replace(
      'new Object[] {recentlyUpdatedSince, dataNodeRef, brandRef}',
      'new Object[] {recentlyUpdatedSince, brandRef, dataNodeRef}',
    ),
  };
  expectFailure(swappedParameters, 'WORKBENCH_PARAMETER_ORDER_CHANGED', 'WORKBENCH_PARAMETERS');
  process.stdout.write('R4_SQL_SEMANTIC_COUNTEREXAMPLES_RED=PASS\n');
}

if (args.includes('--self-test')) {
  runSelfTest();
  process.exit(0);
}

const source = readSources(repositoryRoot);
const failures = failuresFor(source);
if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`R4_SQL_SEMANTIC_COUNTEREXAMPLE ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `R4_SQL_SEMANTIC_COUNTEREXAMPLES=PASS\n` +
    `R4_SQL_SEMANTIC_CASES=3\n` +
    `R4_SQL_SEMANTIC_COUNTEREXAMPLES_RED=NOT_RUN\n`,
);
