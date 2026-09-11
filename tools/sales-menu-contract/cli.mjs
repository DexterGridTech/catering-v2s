#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EDGE_CATALOG = 'doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json';
const SALES_SCHEMA = 'contracts/openapi-source/sales-menu.schemas.json';
const BUSINESS_CHANNEL_SCHEMA = 'contracts/openapi-source/business-channel.schemas.json';
const ADMIN_CATALOG = 'contracts/catalog/admin-catalog.json';
const IAM_MANIFEST = 'contracts/registry/iam-org-governance-manifest.json';
const HANDLER_BINDINGS = 'contracts/registry/operation-handler-bindings.json';
const SALES_OPERATION_IDS = Object.freeze([
  'getOperationsSalesMenus',
  'getOperationsSalesMenu',
  'getOperationsSalesMenuDraftSections',
  'getOperationsSalesMenuDraftItems',
  'getOperationsSalesMenuDraftItem',
  'getOperationsSalesMenuPublishedSections',
  'getOperationsSalesMenuPublishedItems',
  'getOperationsSalesMenuPublishedItem',
  'getOperationsSalesMenuItemCandidates',
  'getOperationsSalesMenuPublicationPreview',
  'getOperationsSalesMenuOperationRecords',
  'createOperationsSalesMenu',
  'copyOperationsSalesMenu',
  'renameOperationsSalesMenu',
  'archiveOperationsSalesMenu',
  'setOperationsSalesMenuActivation',
  'updateOperationsSalesMenuSchedule',
  'createOperationsSalesMenuSection',
  'renameOperationsSalesMenuSection',
  'deleteOperationsSalesMenuSection',
  'moveOperationsSalesMenuSection',
  'addOperationsSalesMenuItems',
  'updateOperationsSalesMenuItem',
  'deleteOperationsSalesMenuItem',
  'moveOperationsSalesMenuItem',
  'stageOperationsSalesMenuAsset',
  'releaseOperationsSalesMenuStagedAsset',
  'publishOperationsSalesMenu',
  'setOperationsSalesMenuItemSoldOut',
  'restoreOperationsSalesMenuItemSale',
]);
const SALES_COMMAND_IDS = Object.freeze(SALES_OPERATION_IDS.filter(id => !id.startsWith('get')));
const AFFECTED_OPERATION_IDS = Object.freeze(['getOperationsStoreBusinessChannels', ...SALES_OPERATION_IDS]);
const FIXED_PAGE_SIZE_OPERATION_IDS = Object.freeze([
  'getOperationsStoreBusinessChannels',
  'getOperationsSalesMenus',
  'getOperationsSalesMenuDraftItems',
  'getOperationsSalesMenuPublishedItems',
  'getOperationsSalesMenuItemCandidates',
  'getOperationsSalesMenuOperationRecords',
]);

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}

function readJson(relativePath, base = repositoryRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(base, relativePath), 'utf8'));
  } catch (error) {
    fail('SALES_MENU_CONTRACT_SOURCE_INVALID', `${relativePath}:${error.message}`);
  }
}

function exact(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function schemas(document) {
  return document?.components?.schemas;
}

function required(schema, name) {
  return Array.isArray(schema?.required) && schema.required.includes(name);
}

function property(schema, name) {
  return schema?.properties?.[name];
}

function assertFixedPageSize(operation) {
  const pageSize = operation?.queryParameters?.find(parameter => parameter.name === 'pageSize');
  if (!pageSize || !exact(pageSize.schema, {type: 'integer', minimum: 20, maximum: 20})) {
    fail('SALES_MENU_FIXED_PAGE_SIZE_INVALID', operation.operationId);
  }
}

function assertCursorPage(name, schema) {
  if (
    schema?.type !== 'object' ||
    schema?.additionalProperties !== false ||
    !required(schema, 'items') ||
    !required(schema, 'cursor') ||
    !required(schema, 'nextCursor') ||
    required(schema, 'total') ||
    property(schema, 'total')
  ) {
    fail('SALES_MENU_CURSOR_PAGE_INVALID', name);
  }
  for (const cursorName of ['cursor', 'nextCursor']) {
    const cursor = property(schema, cursorName);
    if (cursor?.type !== 'string' || cursor.maxLength !== 512 || cursor.nullable !== true) {
      fail('SALES_MENU_CURSOR_FIELD_INVALID', `${name}.${cursorName}`);
    }
  }
}

function assertPriceInteger(name, schema) {
  for (const [fieldName, field] of Object.entries(schema?.properties ?? {})) {
    if (!/PriceCents$/.test(fieldName)) continue;
    if (field?.type !== 'integer' || field.minimum !== 0)
      fail('SALES_MENU_PRICE_NOT_INTEGER_CENTS', `${name}.${fieldName}`);
  }
}

function assertSalesSchemas(document) {
  const value = schemas(document);
  if (!value || typeof value !== 'object') fail('SALES_MENU_SCHEMA_COMPONENTS_MISSING');

  const cursorPages = [
    'SalesMenuPage',
    'SalesMenuItemPage',
    'SalesMenuPublishedItemPage',
    'SalesMenuCandidatePage',
    'SalesMenuOperationRecordPage',
  ];
  for (const name of cursorPages) assertCursorPage(name, value[name]);

  const published = value.SalesMenuPublishedItemView;
  if (
    !required(published, 'inventoryAvailability') ||
    !required(published, 'manualSaleStatus') ||
    !property(published, 'inventoryAvailability') ||
    !property(published, 'manualSaleStatus') ||
    property(published, 'available') ||
    property(published, 'sellable') ||
    property(published, 'saleStatus')
  ) {
    fail('SALES_MENU_PUBLISHED_STATUS_DIMENSIONS_INVALID');
  }

  const ordering = value.SalesMenuOrderingConstraints;
  if (
    ordering?.type !== 'object' ||
    ordering.additionalProperties !== false ||
    !required(ordering, 'minItemQuantity') ||
    !required(ordering, 'quantityStep')
  ) {
    fail('SALES_MENU_ORDERING_CONSTRAINTS_INVALID');
  }

  for (const name of Object.keys(value)) assertPriceInteger(name, value[name]);

  const saleContent = value.SalesMenuSaleContent;
  if (
    saleContent?.properties?.kind?.enum?.join('|') !== 'DIRECT|SKU_SELECTION|WEIGHTED|COMPOSITE' ||
    !required(saleContent, 'skuPrices') ||
    !required(saleContent, 'listedPriceCents') ||
    value.SalesMenuSkuPrice?.properties?.listedPriceCents?.type !== 'integer'
  ) {
    fail('SALES_MENU_SALE_CONTENT_PRICE_SHAPE_INVALID');
  }

  const stage = value.SalesMenuAssetStageRequest;
  const release = value.SalesMenuAssetReleaseRequest;
  if (
    !stage ||
    !exact(stage.required, ['expectedDraftVersion', 'fileName', 'mediaType', 'contentDigest', 'content']) ||
    property(stage, 'storeRef') ||
    property(stage, 'salesMenuRef') ||
    property(stage, 'salesItemRef') ||
    property(stage, 'usage') ||
    property(stage, 'status') ||
    stage.properties?.content?.format !== 'binary' ||
    !release ||
    !exact(release.required, ['expectedAssetVersion']) ||
    Object.keys(release.properties ?? {}).some(field => field !== 'expectedAssetVersion')
  ) {
    fail('SALES_MENU_ASSET_REQUEST_TARGET_OVERRIDE');
  }

  for (const name of ['SalesMenuAssetStageReadback', 'SalesMenuAssetReleaseReadback']) {
    const readback = value[name];
    if (
      !required(readback, 'target') ||
      readback.properties?.target?.$ref !== '#/components/schemas/SalesMenuAssetTargetReadback'
    ) {
      fail('SALES_MENU_ASSET_READBACK_TARGET_MISSING', name);
    }
  }

  const schedule = value.SalesMenuSchedule;
  if (
    schedule?.additionalProperties !== false ||
    schedule?.properties?.kind?.enum?.join('|') !== 'ALL_DAY|DAILY_TIME_RANGE'
  ) {
    fail('SALES_MENU_SCHEDULE_SHAPE_INVALID');
  }
}

function assertBusinessChannelSchema(document) {
  const page = schemas(document)?.BusinessChannelPage;
  assertCursorPage('BusinessChannelPage', page);
}

function assertOperations(catalog) {
  const operations = catalog?.operations;
  const byId = new Map((operations ?? []).map(operation => [operation.operationId, operation]));
  if (!Array.isArray(operations) || catalog?.denominator?.operations !== operations.length)
    fail('SALES_MENU_OPERATION_DENOMINATOR_MISMATCH');
  if (new Set(operations.map(operation => operation.operationId)).size !== operations.length)
    fail('SALES_MENU_OPERATION_ID_DUPLICATE');
  const affected = AFFECTED_OPERATION_IDS.map(id => byId.get(id));
  if (affected.some(operation => !operation)) fail('SALES_MENU_AFFECTED_OPERATION_MISSING');
  if (affected.length !== 31 || new Set(affected.map(operation => operation.operationId)).size !== 31)
    fail('SALES_MENU_AFFECTED_OPERATION_COUNT_INVALID');
  if (SALES_OPERATION_IDS.filter(id => byId.has(id)).length !== 30) fail('SALES_MENU_OPERATION_COUNT_INVALID');

  for (const operation of affected) {
    if (operation.face !== 'operations-admin') fail('SALES_MENU_OPERATION_FACE_INVALID', operation.operationId);
    if (
      operation.operationId !== 'getOperationsStoreBusinessChannels' &&
      (operation.owner !== 'sales-menu' || operation.pageKey !== 'OPERATIONS-SALES-MENU')
    ) {
      fail('SALES_MENU_OPERATION_OWNER_OR_PAGE_INVALID', operation.operationId);
    }
  }

  const commands = SALES_COMMAND_IDS.map(id => byId.get(id));
  if (commands.length !== 19 || commands.some(operation => !operation || operation.method === 'GET'))
    fail('SALES_MENU_COMMAND_DENOMINATOR_INVALID');
  if (commands.some(operation => operation.errorSetRef !== 'OWNER_COMMAND'))
    fail('SALES_MENU_COMMAND_ERROR_SET_INVALID');

  const channel = byId.get('getOperationsStoreBusinessChannels');
  if (
    !channel ||
    channel.responseSchema !== 'BusinessChannelPage' ||
    !channel.queryParameters?.some(
      parameter =>
        parameter.name === 'usage' &&
        parameter.required === true &&
        exact(parameter.schema?.enum, ['BUSINESS_CHANNEL', 'SALES_MENU']),
    )
  ) {
    fail('SALES_MENU_BUSINESS_CHANNEL_USAGE_CONTRACT_INVALID');
  }

  for (const operationId of FIXED_PAGE_SIZE_OPERATION_IDS) {
    assertFixedPageSize(byId.get(operationId));
  }

  for (const operation of SALES_OPERATION_IDS.map(id => byId.get(id))) {
    if (!operation.path.includes('/sales-menus')) fail('SALES_MENU_ROUTE_MISSING_TARGET', operation.operationId);
    if (operation.method === 'GET' && operation.idempotency?.header !== 'FORBIDDEN')
      fail('SALES_MENU_READ_IDEMPOTENCY_INVALID', operation.operationId);
  }

  const stage = byId.get('stageOperationsSalesMenuAsset');
  const release = byId.get('releaseOperationsSalesMenuStagedAsset');
  if (
    stage?.requestSchema !== 'SalesMenuAssetStageRequest' ||
    stage?.requestContentType !== 'multipart/form-data' ||
    !stage.path.includes('/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage') ||
    release?.requestSchema !== 'SalesMenuAssetReleaseRequest' ||
    !release.path.includes(
      '/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release',
    )
  ) {
    fail('SALES_MENU_ASSET_ROUTE_TARGET_INVALID');
  }
}

function assertAdminCatalog(document) {
  const nodes = document?.nodes ?? [];
  const page = nodes.filter(node => node.key === 'PG-SALES-MENU-STORE');
  if (
    page.length !== 1 ||
    page[0].kind !== 'PAGE' ||
    page[0].consumerFace !== 'operations-admin' ||
    page[0].pageAccess?.requiredDataNodeType !== 'STORE' ||
    !exact(page[0].pageAccess?.grantableRoleNodeTypes, ['GROUP', 'REGION', 'PROJECT', 'STORE'])
  ) {
    fail('SALES_MENU_ADMIN_PAGE_INVALID');
  }
  const action = nodes.filter(node => node.key === 'EDIT_STORE_SALES_MENU');
  if (
    action.length !== 1 ||
    action[0].kind !== 'ACTION' ||
    action[0].consumerFace !== 'operations-admin' ||
    action[0].action?.targetPageKey !== 'PG-SALES-MENU-STORE' ||
    action[0].action?.scopeApplicability !== 'SELECTED_STORE_SCOPE'
  ) {
    fail('SALES_MENU_ADMIN_ACTION_INVALID');
  }
}

function assertIam(document) {
  const requirements = document?.requirements ?? [];
  const sales = requirements.filter(requirement =>
    SALES_OPERATION_IDS.includes(requirement.operationIdentity?.operationId),
  );
  if (sales.length !== 19) fail('SALES_MENU_IAM_COMMAND_REQUIREMENT_COUNT_INVALID');
  for (const requirement of sales) {
    if (
      requirement.operationIdentity.consumerFace !== 'operations-admin' ||
      requirement.operationIdentity.ownerModule !== 'sales-menu' ||
      requirement.authorizationMode !== 'AUTHENTICATED_WORKSPACE' ||
      !exact(requirement.capabilityMapping?.resourceTypeCapabilities, {STORE: 'EDIT_STORE_SALES_MENU'}) ||
      requirement.ownerRecheckId !== 'OWNER_RECHECK_SALES_MENU' ||
      requirement.noClientDerivedAuthorization !== true
    ) {
      fail('SALES_MENU_IAM_COMMAND_REQUIREMENT_INVALID', requirement.operationIdentity.operationId);
    }
  }
  const ownerRecheck = (document?.ownerRechecks ?? []).find(item => item.ownerRecheckId === 'OWNER_RECHECK_SALES_MENU');
  if (
    !ownerRecheck ||
    ownerRecheck.requiredInOwnerCommand !== true ||
    ownerRecheck.transactionRequirement !== 'REQUIRED'
  )
    fail('SALES_MENU_OWNER_RECHECK_INVALID');
}

function assertBindings(document) {
  const operations = document?.operations ?? [];
  const sales = operations.filter(operation => SALES_OPERATION_IDS.includes(operation.operationId));
  if (sales.length !== 30) fail('SALES_MENU_HANDLER_BINDING_COUNT_INVALID');
  for (const operation of sales) {
    if (
      operation.owner !== 'sales-menu' ||
      operation.face !== 'operations-admin' ||
      !operation.adapter.includes('com.catering.v2s.salesmenu.')
    ) {
      fail('SALES_MENU_HANDLER_BINDING_INVALID', operation.operationId);
    }
    if (
      operation.mode === 'COMMAND' &&
      (operation.transactionMode !== 'REQUIRED' || operation.commandBoundary !== 'OWNER_COMMAND')
    ) {
      fail('SALES_MENU_HANDLER_COMMAND_BOUNDARY_INVALID', operation.operationId);
    }
  }
  const stage = sales.find(operation => operation.operationId === 'stageOperationsSalesMenuAsset');
  if (!stage?.adapter.endsWith('StageOperationsSalesMenuAssetMultipartOperation'))
    fail('SALES_MENU_ASSET_MULTIPART_BINDING_INVALID');
}

function validate(base = repositoryRoot) {
  const catalog = readJson(EDGE_CATALOG, base);
  assertSalesSchemas(readJson(SALES_SCHEMA, base));
  assertBusinessChannelSchema(readJson(BUSINESS_CHANNEL_SCHEMA, base));
  assertOperations(catalog);
  assertAdminCatalog(readJson(ADMIN_CATALOG, base));
  assertIam(readJson(IAM_MANIFEST, base));
  assertBindings(readJson(HANDLER_BINDINGS, base));
  process.stdout.write(
    `SALES_MENU_CONTRACT=PASS\nAFFECTED_OPERATIONS=${AFFECTED_OPERATION_IDS.length}\nSALES_MENU_OPERATIONS=${SALES_OPERATION_IDS.length}\nSALES_MENU_COMMANDS=${SALES_COMMAND_IDS.length}\n`,
  );
  return {
    affectedOperations: AFFECTED_OPERATION_IDS.length,
    operations: SALES_OPERATION_IDS.length,
    commands: SALES_COMMAND_IDS.length,
  };
}

function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-sales-menu-contract-'));
  try {
    for (const relativePath of [
      EDGE_CATALOG,
      SALES_SCHEMA,
      BUSINESS_CHANNEL_SCHEMA,
      ADMIN_CATALOG,
      IAM_MANIFEST,
      HANDLER_BINDINGS,
    ]) {
      const target = path.join(scratch, relativePath);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(path.join(repositoryRoot, relativePath), target);
    }

    const expectRed = (label, mutate, code) => {
      const target = path.join(scratch, mutate.file);
      const original = JSON.parse(fs.readFileSync(target, 'utf8'));
      mutate.apply(original);
      fs.writeFileSync(target, `${JSON.stringify(original, null, 2)}\n`);
      let red = false;
      try {
        validate(scratch);
      } catch (error) {
        red = error.message.includes(code);
      }
      fs.writeFileSync(
        target,
        `${JSON.stringify(JSON.parse(fs.readFileSync(path.join(repositoryRoot, mutate.file), 'utf8')), null, 2)}\n`,
      );
      if (!red) fail('SALES_MENU_CONTRACT_SELF_TEST_RED_NOT_DETECTED', label);
    };

    expectRed(
      'operation denominator',
      {
        file: EDGE_CATALOG,
        apply(value) {
          value.denominator.operations += 1;
        },
      },
      'SALES_MENU_OPERATION_DENOMINATOR_MISMATCH',
    );
    expectRed(
      'fixed page size',
      {
        file: EDGE_CATALOG,
        apply(value) {
          const operation = value.operations.find(item => item.operationId === 'getOperationsSalesMenus');
          operation.queryParameters.find(parameter => parameter.name === 'pageSize').schema.maximum = 21;
        },
      },
      'SALES_MENU_FIXED_PAGE_SIZE_INVALID',
    );
    expectRed(
      'published merged status',
      {
        file: SALES_SCHEMA,
        apply(value) {
          delete value.components.schemas.SalesMenuPublishedItemView.properties.manualSaleStatus;
        },
      },
      'SALES_MENU_PUBLISHED_STATUS_DIMENSIONS_INVALID',
    );
    expectRed(
      'asset target override',
      {
        file: SALES_SCHEMA,
        apply(value) {
          value.components.schemas.SalesMenuAssetReleaseRequest.properties.storeRef = {type: 'string'};
        },
      },
      'SALES_MENU_ASSET_REQUEST_TARGET_OVERRIDE',
    );
    expectRed(
      'wrong page capability',
      {
        file: ADMIN_CATALOG,
        apply(value) {
          value.nodes.find(node => node.key === 'PG-SALES-MENU-STORE').pageAccess.requiredDataNodeType = 'PROJECT';
        },
      },
      'SALES_MENU_ADMIN_PAGE_INVALID',
    );
    expectRed(
      'missing owner recheck',
      {
        file: IAM_MANIFEST,
        apply(value) {
          value.ownerRechecks = value.ownerRechecks.filter(item => item.ownerRecheckId !== 'OWNER_RECHECK_SALES_MENU');
        },
      },
      'SALES_MENU_OWNER_RECHECK_INVALID',
    );

    process.stdout.write('SALES_MENU_CONTRACT_SELF_TEST=PASS\n');
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
  }
}

const args = process.argv.slice(2);
try {
  if (args.length === 1 && args[0] === '--self-test') selfTest();
  else if (args.length === 0) validate();
  else fail('SALES_MENU_CONTRACT_ACCEPTS_ONLY_SELF_TEST');
} catch (error) {
  process.stderr.write(`SALES_MENU_CONTRACT=FAIL\nREASON=${error.message}\n`);
  process.exit(1);
}

export {AFFECTED_OPERATION_IDS, SALES_COMMAND_IDS, SALES_OPERATION_IDS, assertOperations, validate};
