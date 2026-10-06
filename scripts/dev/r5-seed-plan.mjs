#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {validateFixtureContract} from './r5-fixture-contract.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'scripts/dev/profiles/r5-full.json'), 'utf8'));
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json'), 'utf8'),
);
const terminalRules = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts/catalog/store-terminal-rules.json'), 'utf8'),
);
const catalogFixture = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts/policy/catalog-inventory-fixture-catalog.json'), 'utf8'),
);
const fixtureContract = validateFixtureContract(fixture);
const isChineseBusinessText = value =>
  typeof value === 'string' && /[\u3400-\u9fff]/.test(value) && !/[A-Za-z]/.test(value);
const requireChineseBusinessText = (value, label) => {
  if (!isChineseBusinessText(value)) throw new Error(`R5_SEED_BUSINESS_LABEL_INVALID:${label}`);
};
const THREE_STATE_VALUES = new Set(['ENABLED', 'DISABLED', 'VOIDED']);
const requireThreeStateCoverage = (entries, label) => {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`R5_SEED_STATUS_COLLECTION_INVALID:${label}`);
  const statuses = new Set();
  for (const entry of entries) {
    if (!THREE_STATE_VALUES.has(entry?.status)) throw new Error(`R5_SEED_STATUS_VALUE_INVALID:${label}`);
    statuses.add(entry.status);
  }
  for (const status of THREE_STATE_VALUES)
    if (!statuses.has(status)) throw new Error(`R5_SEED_STATUS_COVERAGE_MISSING:${label}:${status}`);
};
const requireRolePermission = (source, roleKey, pageAccessKey, capabilityKey) => {
  const role = source.stableFixtures.workspaceIam.roles.find(entry => entry.key === roleKey);
  if (!role) throw new Error(`R5_SEED_ROLE_PERMISSION_ROLE_MISSING:${roleKey}`);
  if (!role.pageAccessKeys?.includes(pageAccessKey))
    throw new Error(`R5_SEED_ROLE_PERMISSION_PAGE_MISSING:${roleKey}:${pageAccessKey}`);
  if (!role.actionCapabilityKeys?.includes(capabilityKey))
    throw new Error(`R5_SEED_ROLE_PERMISSION_CAPABILITY_MISSING:${roleKey}:${capabilityKey}`);
};
const validateSalesMenuSeedRolePrerequisites = source => {
  requireRolePermission(source, 'role-project', 'PG-BUSINESS-CHANNEL-PROJECT', 'BC-BUSINESS-CHANNEL-PROJECT-EDIT');
  requireRolePermission(source, 'role-store', 'PG-BUSINESS-CHANNEL-STORE', 'BC-BUSINESS-CHANNEL-STORE-EDIT');
  requireRolePermission(source, 'role-store', 'PG-SALES-MENU-STORE', 'EDIT_STORE_SALES_MENU');
  requireRolePermission(source, 'role-group', 'PG-STORE-SERVICE-POINT-QR', 'EDIT_STORE_SERVICE_POINT_QR');
  requireRolePermission(source, 'role-project', 'PG-STORE-SERVICE-POINT-QR', 'EDIT_STORE_SERVICE_POINT_QR');
  requireRolePermission(source, 'role-store', 'PG-STORE-SERVICE-POINT-QR', 'EDIT_STORE_SERVICE_POINT_QR');
  requireRolePermission(source, 'role-group', 'PG-STORE-TERMINALS', 'EDIT_STORE_TERMINAL');
  requireRolePermission(source, 'role-project', 'PG-STORE-TERMINALS', 'EDIT_STORE_TERMINAL');
  const storeRole = source.stableFixtures.workspaceIam.roles.find(entry => entry.key === 'role-store');
  if (
    !storeRole?.pageAccessKeys?.includes('PG-STORE-TERMINALS') ||
    storeRole.actionCapabilityKeys?.includes('EDIT_STORE_TERMINAL')
  ) {
    throw new Error('R5_SEED_ROLE_PERMISSION_STORE_TERMINAL_READ_ONLY_INVALID');
  }
};
const validateTerminalAutomationSeedRolePrerequisites = source => {
  requireRolePermission(source, 'role-project', 'PG-ORG-STORE-MANAGE', 'BC-ORG-STORE-EDIT');
};
const EXTENSION_HOST_TYPES = new Set([
  'BRAND',
  'TENANT',
  'HEAD_COMPANY',
  'STORE',
  'CONTRACT',
  'COMMERCIAL_GROUP',
  'REGION',
  'PROJECT',
  'SERVICE_POINT',
]);
const FLAT_EXTENSION_HOST_TYPES = new Set(['BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT']);
const EXTENSION_FIELD_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT']);
const validateExtensionSeedShape = source => {
  const definitions = source.stableFixtures.extensionDefinitions;
  if (!Array.isArray(definitions) || definitions.length !== 9)
    throw new Error('R5_SEED_EXTENSION_DEFINITION_SET_INVALID');
  const hosts = new Set();
  const types = new Set();
  const flags = new Set();
  let disabled = 0;
  for (const definition of definitions) {
    if (
      !definition ||
      !EXTENSION_HOST_TYPES.has(definition.hostType) ||
      hosts.has(definition.hostType) ||
      !Array.isArray(definition.fields) ||
      definition.fields.length === 0
    ) {
      throw new Error(`R5_SEED_EXTENSION_DEFINITION_INVALID:${definition?.hostType ?? 'UNKNOWN'}`);
    }
    hosts.add(definition.hostType);
    const keys = new Set();
    for (const field of definition.fields) {
      if (
        !field ||
        typeof field.key !== 'string' ||
        !/^[a-z][A-Za-z0-9_]{0,79}$/.test(field.key) ||
        keys.has(field.key) ||
        typeof field.label !== 'string' ||
        !field.label ||
        !EXTENSION_FIELD_TYPES.has(field.type) ||
        !['ENABLED', 'DISABLED'].includes(field.status) ||
        typeof field.required !== 'boolean'
      ) {
        throw new Error(`R5_SEED_EXTENSION_FIELD_INVALID:${definition.hostType}`);
      }
      keys.add(field.key);
      types.add(field.type);
      const options = field.options ?? [];
      if (
        !Array.isArray(options) ||
        (field.type === 'SELECT' && options.length === 0) ||
        (field.type !== 'SELECT' && options.length > 0) ||
        options.some(value => typeof value !== 'string' || !value)
      ) {
        throw new Error(`R5_SEED_EXTENSION_OPTIONS_INVALID:${definition.hostType}:${field.key}`);
      }
      if (field.status === 'DISABLED') disabled += 1;
      if (FLAT_EXTENSION_HOST_TYPES.has(definition.hostType)) {
        if (typeof field.listDisplay !== 'boolean' || typeof field.searchable !== 'boolean')
          throw new Error(`R5_SEED_EXTENSION_FLAGS_INVALID:${definition.hostType}:${field.key}`);
        flags.add(`${field.listDisplay ? 'LIST' : 'NO_LIST'}:${field.searchable ? 'SEARCH' : 'NO_SEARCH'}`);
      } else if (field.listDisplay !== null || field.searchable !== null) {
        throw new Error(`R5_SEED_EXTENSION_NA_FLAGS_INVALID:${definition.hostType}:${field.key}`);
      }
    }
  }
  for (const hostType of EXTENSION_HOST_TYPES)
    if (!hosts.has(hostType)) throw new Error(`R5_SEED_EXTENSION_HOST_MISSING:${hostType}`);
  for (const type of EXTENSION_FIELD_TYPES)
    if (!types.has(type)) throw new Error(`R5_SEED_EXTENSION_TYPE_MISSING:${type}`);
  for (const combination of ['NO_LIST:NO_SEARCH', 'LIST:NO_SEARCH', 'NO_LIST:SEARCH', 'LIST:SEARCH'])
    if (!flags.has(combination)) throw new Error(`R5_SEED_EXTENSION_FLAG_MISSING:${combination}`);
  if (disabled === 0) throw new Error('R5_SEED_EXTENSION_DISABLED_MISSING');
};
const validateExtensionRevisionChangeFixture = source => {
  const definitions = source.stableFixtures.extensionDefinitions;
  const changes = source.stableFixtures.extensionDefinitionRevisionChanges;
  if (!Array.isArray(changes) || changes.length === 0) throw new Error('R5_SEED_EXTENSION_REVISION_CHANGE_MISSING');
  const definitionsByKey = new Map(definitions.map(definition => [definition.key, definition]));
  const seen = new Set();
  for (const change of changes) {
    const definition = definitionsByKey.get(change?.definitionKey);
    if (
      !definition?.fields?.some(field => field.key === change?.fieldKey) ||
      seen.has(change?.definitionKey) ||
      typeof change?.displaySuffix !== 'string' ||
      !change.displaySuffix.trim()
    ) {
      throw new Error('R5_SEED_EXTENSION_REVISION_CHANGE_INVALID');
    }
    seen.add(change.definitionKey);
  }
};
const extensionDisplayTextEntries = (source, hostType, values, labelPrefix) => {
  const definition = source.stableFixtures.extensionDefinitions.find(entry => entry.hostType === hostType);
  const fields = new Map((definition?.fields ?? []).map(field => [field.key, field]));
  return Object.entries(values ?? {})
    .filter(([key]) => ['TEXT', 'SELECT'].includes(fields.get(key)?.type) && fields.get(key)?.listDisplay === true)
    .map(([key, value]) => [`${labelPrefix}:${key}`, value]);
};
const displayTextDenominator = source => {
  const fixtures = source.stableFixtures;
  const organization = fixtures.organization;
  return [
    ['bootstrap.displayName', source.bootstrapBoundary.displayName],
    ...fixtures.platformAdmins.map(entry => [`platformAdmin:${entry.key}`, entry.displayName]),
    ...fixtures.groupWorkspaces.flatMap(entry => [
      [`groupWorkspace:${entry.key}`, entry.name],
      [`operationsTitle:${entry.key}`, entry.operationsTitle ?? `${entry.name}运营管理后台`],
    ]),
    ...fixtures.extensionDefinitions.flatMap(definition =>
      definition.fields.map(field => [`extensionLabel:${definition.key}:${field.key}`, field.label]),
    ),
    ...organization.commercialGroups.flatMap(entry => [
      [`commercialGroup:${entry.key}`, entry.name],
      ...extensionDisplayTextEntries(
        source,
        'COMMERCIAL_GROUP',
        entry.extensionValues,
        `commercialGroupExtension:${entry.key}`,
      ),
    ]),
    ...organization.regions.flatMap(entry => [
      [`region:${entry.key}`, entry.name],
      ...extensionDisplayTextEntries(source, 'REGION', entry.extensionValues, `regionExtension:${entry.key}`),
    ]),
    ...organization.projects.flatMap(entry => [
      [`project:${entry.key}`, entry.name],
      ...(entry.phases ?? []).map((value, index) => [`projectPhase:${entry.key}:${index}`, value]),
      ...extensionDisplayTextEntries(source, 'PROJECT', entry.extensionValues, `projectExtension:${entry.key}`),
    ]),
    ...organization.brands.flatMap(entry => [
      [`brand:${entry.key}`, entry.name],
      ...extensionDisplayTextEntries(source, 'BRAND', entry.extensionValues, `brandExtension:${entry.key}`),
    ]),
    ...organization.tenants.flatMap(entry => [
      [`tenant:${entry.key}`, entry.name],
      ...extensionDisplayTextEntries(source, 'TENANT', entry.extensionValues, `tenantExtension:${entry.key}`),
    ]),
    ...organization.headCompanies.flatMap(entry => [
      [`headCompany:${entry.key}`, entry.name],
      ...extensionDisplayTextEntries(
        source,
        'HEAD_COMPANY',
        entry.extensionValues,
        `headCompanyExtension:${entry.key}`,
      ),
    ]),
    ...organization.stores.flatMap(entry => [
      [`store:${entry.key}`, entry.name],
      ...extensionDisplayTextEntries(source, 'STORE', entry.extensionValues, `storeExtension:${entry.key}`),
    ]),
    ...(organization.storeServicePoints?.areas ?? []).map(entry => [`storeServicePointArea:${entry.key}`, entry.name]),
    ...(organization.storeServicePoints?.points ?? []).map(entry => [`storeServicePoint:${entry.key}`, entry.name]),
    ...(organization.storeTerminals ?? []).map(entry => [`storeTerminal:${entry.key}`, entry.name]),
    ...fixtures.workspaceIam.roles.map(entry => [`role:${entry.key}`, entry.name]),
    ...fixtures.workspaceIam.accounts.map(entry => [`account:${entry.key}`, entry.displayName]),
    ...fixtures.contracts.flatMap(entry => [
      [`contractPhase:${entry.key}`, entry.phaseNameSnapshot],
      ...extensionDisplayTextEntries(source, 'CONTRACT', entry.extensionValues, `contractExtension:${entry.key}`),
      ...(entry.items ?? []).map(item => [`contractItem:${entry.key}:${item.code}`, item.name]),
    ]),
    ...source.executionPlan.invitationPlans
      .filter(entry => entry.displayName)
      .map(entry => [`invitationAccount:${entry.invitationKey}`, entry.displayName]),
  ].filter(([, value]) => value !== undefined && value !== null);
};
const validateBusinessDisplayLabels = source => {
  for (const [label, value] of displayTextDenominator(source)) requireChineseBusinessText(value, label);
};
const validateStoreServicePointSeedCoverage = source => {
  const fixture = source.stableFixtures.organization.storeServicePoints;
  if (
    !fixture ||
    typeof fixture.store !== 'string' ||
    !Array.isArray(fixture.areas) ||
    !Array.isArray(fixture.points) ||
    !fixture.qr
  ) {
    throw new Error('R5_SEED_STORE_SERVICE_POINT_FIXTURE_INVALID');
  }
  const store = source.stableFixtures.organization.stores.find(entry => entry.key === fixture.store);
  if (!store || store.status !== 'ENABLED' || store.operatingRuleSwitches?.tableManagementEnabled !== true) {
    throw new Error('R5_SEED_STORE_SERVICE_POINT_GATE_NOT_ENABLED');
  }
  const areaKeys = new Set();
  const areaCodes = new Set();
  for (const area of fixture.areas) {
    if (
      !area ||
      typeof area.key !== 'string' ||
      areaKeys.has(area.key) ||
      typeof area.code !== 'string' ||
      areaCodes.has(area.code) ||
      !['TABLE_AREA', 'SCAN_AREA'].includes(area.areaType) ||
      !['ENABLED', 'DISABLED', 'VOIDED'].includes(area.status)
    ) {
      throw new Error('R5_SEED_STORE_SERVICE_POINT_AREA_INVALID');
    }
    areaKeys.add(area.key);
    areaCodes.add(area.code);
  }
  requireThreeStateCoverage(fixture.areas, 'organization.storeServicePoints.areas');
  const pointKeys = new Set();
  const pointCodes = new Set();
  const servicePointDefinition = source.stableFixtures.extensionDefinitions.find(
    entry => entry.hostType === 'SERVICE_POINT',
  );
  const servicePointFieldKeys = new Set(servicePointDefinition?.fields?.map(field => field.key) ?? []);
  if (!servicePointDefinition || !servicePointFieldKeys.size)
    throw new Error('R5_SEED_STORE_SERVICE_POINT_EXTENSION_DEFINITION_MISSING');
  for (const point of fixture.points) {
    const area = fixture.areas.find(entry => entry.key === point?.area);
    if (
      !point ||
      !area ||
      pointKeys.has(point.key) ||
      typeof point.code !== 'string' ||
      pointCodes.has(point.code) ||
      !['TABLE', 'SCAN'].includes(point.pointType) ||
      !['ENABLED', 'DISABLED', 'VOIDED'].includes(point.status) ||
      (point.pointType === 'TABLE' ? area.areaType !== 'TABLE_AREA' : area.areaType !== 'SCAN_AREA') ||
      !point.extensionValues ||
      Object.keys(point.extensionValues).some(key => !servicePointFieldKeys.has(key))
    ) {
      throw new Error('R5_SEED_STORE_SERVICE_POINT_INVALID');
    }
    if (point.pointType === 'TABLE') {
      if (
        (point.seatCapacity !== undefined &&
          point.seatCapacity !== null &&
          (!Number.isInteger(point.seatCapacity) || point.seatCapacity <= 0)) ||
        (point.tableShape !== undefined &&
          point.tableShape !== null &&
          !['HALL', 'PRIVATE_ROOM', 'BOOTH', 'OUTDOOR'].includes(point.tableShape)) ||
        (point.reservable !== undefined && point.reservable !== null && typeof point.reservable !== 'boolean') ||
        (point.image !== undefined &&
          point.image !== null &&
          (typeof point.image !== 'object' ||
            typeof point.image.fileName !== 'string' ||
            typeof point.image.mediaType !== 'string'))
      ) {
        throw new Error('R5_SEED_STORE_TABLE_POINT_ATTRIBUTES_INVALID');
      }
    } else if (
      (point.seatCapacity !== undefined && point.seatCapacity !== null) ||
      (point.tableShape !== undefined && point.tableShape !== null) ||
      (point.reservable !== undefined && point.reservable !== null) ||
      (point.image !== undefined && point.image !== null)
    ) {
      throw new Error('R5_SEED_STORE_SCAN_POINT_TABLE_ATTRIBUTES_FORBIDDEN');
    }
    pointKeys.add(point.key);
    pointCodes.add(point.code);
  }
  requireThreeStateCoverage(fixture.points, 'organization.storeServicePoints.points');
  if (fixture.qr.enabled !== true || typeof fixture.qr.channelCode !== 'string' || !fixture.qr.channelCode)
    throw new Error('R5_SEED_STORE_QR_FIXTURE_INVALID');
};
const validateStoreTerminalSeedCoverage = source => {
  const terminals = source.stableFixtures.organization.storeTerminals;
  if (!Array.isArray(terminals) || terminals.length !== 8) throw new Error('R5_SEED_STORE_TERMINAL_COUNT_INVALID');
  const storeKeys = new Set(source.stableFixtures.organization.stores.map(entry => entry.key));
  const areaKeys = new Set(
    (source.stableFixtures.organization.storeServicePoints?.areas ?? []).map(entry => entry.key),
  );
  const productionTagCodes = new Set(
    (catalogFixture.catalogDefinitionSeed?.productionTagDefinitions ?? []).map(entry => entry.code),
  );
  const models = new Map(terminalRules.printerModels.map(entry => [entry.key, entry]));
  const functions = new Map(terminalRules.functions.map(entry => [entry.key, entry]));
  const scenes = new Map(terminalRules.scenes.map(entry => [entry.key, entry]));
  const paperSpecs = new Set(terminalRules.paperSpecs.map(entry => entry.key));
  const connections = new Set(terminalRules.connectionMethods.map(entry => entry.key));
  const orderTypes = new Set(terminalRules.orderTypes.map(entry => entry.key));
  const keys = new Set();
  const codes = new Set();
  const statuses = new Set();
  for (const terminal of terminals) {
    if (
      !terminal ||
      keys.has(terminal.key) ||
      !storeKeys.has(terminal.store) ||
      typeof terminal.name !== 'string' ||
      !['laptop', 'mobile'].includes(terminal.deviceType) ||
      !['ENABLED', 'DISABLED', 'VOIDED'].includes(terminal.status) ||
      !/^[0-9]{8}$/.test(terminal.activationCode) ||
      codes.has(terminal.activationCode)
    ) {
      throw new Error('R5_SEED_STORE_TERMINAL_IDENTITY_INVALID');
    }
    keys.add(terminal.key);
    codes.add(terminal.activationCode);
    statuses.add(terminal.status);
    const configuration = terminal.configuration;
    if (
      !configuration ||
      !Array.isArray(configuration.printers) ||
      !Array.isArray(configuration.functions) ||
      configuration.functions.length === 0
    ) {
      throw new Error(`R5_SEED_STORE_TERMINAL_CONFIGURATION_INVALID:${terminal.key}`);
    }
    const printerKeys = new Set();
    const childKeys = new Set();
    for (const printer of configuration.printers) {
      const model = models.get(printer?.modelKey);
      if (
        !printer ||
        typeof printer.clientKey !== 'string' ||
        printerKeys.has(printer.clientKey) ||
        childKeys.has(printer.clientKey) ||
        !model ||
        model.brandKey !== printer.brandKey ||
        !paperSpecs.has(printer.paperSpecKey) ||
        !connections.has(printer.connectionMethodKey) ||
        !model.paperSpecKeys.includes(printer.paperSpecKey) ||
        !model.allowedConnectionMethodKeys.includes(printer.connectionMethodKey)
      ) {
        throw new Error(`R5_SEED_STORE_TERMINAL_PRINTER_INVALID:${terminal.key}`);
      }
      if (
        ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'].includes(printer.connectionMethodKey) &&
        typeof printer.connectionParameter !== 'string'
      ) {
        throw new Error(`R5_SEED_STORE_TERMINAL_CONNECTION_PARAMETER_INVALID:${terminal.key}`);
      }
      if (printer.connectionMethodKey === 'BUILT_IN' && printer.connectionParameter !== undefined) {
        throw new Error(`R5_SEED_STORE_TERMINAL_BUILT_IN_PARAMETER_INVALID:${terminal.key}`);
      }
      printerKeys.add(printer.clientKey);
      childKeys.add(printer.clientKey);
    }
    const functionKeys = new Set();
    for (const fn of configuration.functions) {
      const rule = functions.get(fn?.functionKey);
      if (
        !fn ||
        typeof fn.clientKey !== 'string' ||
        functionKeys.has(fn.clientKey) ||
        childKeys.has(fn.clientKey) ||
        !rule ||
        !rule.supportedDeviceTypeKeys.includes(terminal.deviceType) ||
        !Array.isArray(fn.ranges) ||
        !Array.isArray(fn.scenes)
      ) {
        throw new Error(`R5_SEED_STORE_TERMINAL_FUNCTION_INVALID:${terminal.key}`);
      }
      const rangeKeys = new Set();
      for (const range of fn.ranges) {
        const referenceKeys = range?.referenceKeys;
        if (
          !range ||
          !rule.allowedRangeKeys.includes(range.key) ||
          rangeKeys.has(range.key) ||
          typeof range.all !== 'boolean' ||
          !Array.isArray(referenceKeys) ||
          referenceKeys.some(key => typeof key !== 'string') ||
          Object.hasOwn(range, 'refs') ||
          (range.all && referenceKeys.length > 0)
        ) {
          throw new Error(`R5_SEED_STORE_TERMINAL_RANGE_INVALID:${terminal.key}`);
        }
        const allowedReferenceKeys =
          range.key === 'TABLE_AREA' ? areaKeys : range.key === 'PRODUCTION_TAG' ? productionTagCodes : new Set();
        if (referenceKeys.some(key => !allowedReferenceKeys.has(key))) {
          throw new Error(`R5_SEED_STORE_TERMINAL_RANGE_REFERENCE_INVALID:${terminal.key}`);
        }
        if (!range.all && ['TABLE_AREA', 'PRODUCTION_TAG'].includes(range.key) && referenceKeys.length === 0) {
          throw new Error(`R5_SEED_STORE_TERMINAL_RANGE_REFERENCE_MISSING:${terminal.key}`);
        }
        if (range.all && !['TABLE_AREA', 'PRODUCTION_TAG'].includes(range.key)) {
          throw new Error(`R5_SEED_STORE_TERMINAL_RANGE_ALL_INVALID:${terminal.key}`);
        }
        rangeKeys.add(range.key);
      }
      for (const scene of fn.scenes) {
        const sceneRule = scenes.get(scene?.sceneKey);
        if (
          !sceneRule ||
          sceneRule.functionKey !== fn.functionKey ||
          !Array.isArray(scene.orderTypes) ||
          !Array.isArray(scene.printers) ||
          new Set(scene.orderTypes).size !== scene.orderTypes.length ||
          scene.orderTypes.some(key => !orderTypes.has(key)) ||
          scene.printers.some(binding => !printerKeys.has(binding?.printerClientKey)) ||
          new Set(scene.printers.map(binding => binding?.printerClientKey)).size !== scene.printers.length ||
          scene.printers.some(
            binding =>
              !sceneRule.allowedPaperSpecKeys.includes(
                configuration.printers.find(printer => printer.clientKey === binding.printerClientKey)?.paperSpecKey,
              ),
          )
        ) {
          throw new Error(`R5_SEED_STORE_TERMINAL_SCENE_INVALID:${terminal.key}`);
        }
      }
      functionKeys.add(fn.clientKey);
      childKeys.add(fn.clientKey);
    }
  }
  for (const status of THREE_STATE_VALUES)
    if (!statuses.has(status)) throw new Error(`R5_SEED_STORE_TERMINAL_STATUS_MISSING:${status}`);
  if (!terminals.some(terminal => terminal.configuration.printers.length >= 2))
    throw new Error('R5_SEED_STORE_TERMINAL_MULTI_PRINTER_MISSING');
  return Object.freeze({count: terminals.length, statusValues: [...statuses], activationCodes: [...codes]});
};
validateBusinessDisplayLabels(fixture);
validateExtensionSeedShape(fixture);
validateExtensionRevisionChangeFixture(fixture);
validateStoreServicePointSeedCoverage(fixture);
validateStoreTerminalSeedCoverage(fixture);
validateSalesMenuSeedRolePrerequisites(fixture);
validateTerminalAutomationSeedRolePrerequisites(fixture);
if (process.argv.includes('--self-test')) {
  const redMutation = structuredClone(fixture);
  redMutation.stableFixtures.organization.commercialGroups[0].name = 'fixture-group';
  let rejected = false;
  try {
    validateBusinessDisplayLabels(redMutation);
  } catch (error) {
    rejected = String(error.message).startsWith('R5_SEED_BUSINESS_LABEL_INVALID:commercialGroup:');
  }
  if (!rejected) throw new Error('R5_SEED_BUSINESS_LABEL_RED_MUTATION_MISSED');
  const permissionRedMutation = structuredClone(fixture);
  permissionRedMutation.stableFixtures.workspaceIam.roles.find(role => role.key === 'role-store').actionCapabilityKeys =
    permissionRedMutation.stableFixtures.workspaceIam.roles
      .find(role => role.key === 'role-store')
      .actionCapabilityKeys.filter(key => key !== 'EDIT_STORE_SALES_MENU');
  rejected = false;
  try {
    validateSalesMenuSeedRolePrerequisites(permissionRedMutation);
  } catch (error) {
    rejected = String(error.message) === 'R5_SEED_ROLE_PERMISSION_CAPABILITY_MISSING:role-store:EDIT_STORE_SALES_MENU';
  }
  if (!rejected) throw new Error('R5_SEED_ROLE_PERMISSION_RED_MUTATION_MISSED');
  const terminalAutomationPermissionRedMutation = structuredClone(fixture);
  terminalAutomationPermissionRedMutation.stableFixtures.workspaceIam.roles.find(
    role => role.key === 'role-project',
  ).actionCapabilityKeys = terminalAutomationPermissionRedMutation.stableFixtures.workspaceIam.roles
    .find(role => role.key === 'role-project')
    .actionCapabilityKeys.filter(key => key !== 'BC-ORG-STORE-EDIT');
  rejected = false;
  try {
    validateTerminalAutomationSeedRolePrerequisites(terminalAutomationPermissionRedMutation);
  } catch (error) {
    rejected = String(error.message) === 'R5_SEED_ROLE_PERMISSION_CAPABILITY_MISSING:role-project:BC-ORG-STORE-EDIT';
  }
  if (!rejected) throw new Error('R5_SEED_TERMINAL_AUTOMATION_PERMISSION_RED_MUTATION_MISSED');
  const servicePointRedMutation = structuredClone(fixture);
  servicePointRedMutation.stableFixtures.organization.storeServicePoints.points[0].seatCapacity = 'four';
  rejected = false;
  try {
    validateStoreServicePointSeedCoverage(servicePointRedMutation);
  } catch (error) {
    rejected = String(error.message) === 'R5_SEED_STORE_SERVICE_POINT_INVALID';
  }
  if (!rejected) {
    try {
      validateStoreServicePointSeedCoverage(servicePointRedMutation);
    } catch (error) {
      rejected = String(error.message) === 'R5_SEED_STORE_TABLE_POINT_ATTRIBUTES_INVALID';
    }
  }
  if (!rejected) throw new Error('R5_SEED_STORE_SERVICE_POINT_RED_MUTATION_MISSED');
  const terminalRedMutation = structuredClone(fixture);
  terminalRedMutation.stableFixtures.organization.storeTerminals[1].configuration.printers.splice(0);
  rejected = false;
  try {
    validateStoreTerminalSeedCoverage(terminalRedMutation);
  } catch (error) {
    rejected = String(error.message).startsWith('R5_SEED_STORE_TERMINAL_');
  }
  if (!rejected) throw new Error('R5_SEED_STORE_TERMINAL_RED_MUTATION_MISSED');
  const terminalRangeRedMutation = structuredClone(fixture);
  terminalRangeRedMutation.stableFixtures.organization.storeTerminals[1].configuration.functions[0].ranges[0].referenceKeys =
    ['missing-production-tag'];
  rejected = false;
  try {
    validateStoreTerminalSeedCoverage(terminalRangeRedMutation);
  } catch (error) {
    rejected = String(error.message) === 'R5_SEED_STORE_TERMINAL_RANGE_REFERENCE_INVALID:term-kitchen-multi';
  }
  if (!rejected) throw new Error('R5_SEED_STORE_TERMINAL_RANGE_REFERENCE_RED_MUTATION_MISSED');
  process.stdout.write(
    'R5_SEED_PLAN_SELF_TEST=PASS; RED=TECHNICAL_ENGLISH_DISPLAY_TEXT,SALES_MENU_ROLE_CAPABILITY,TERMINAL_AUTOMATION_ROLE_CAPABILITY,STORE_SERVICE_POINT_OPTIONAL_ATTRIBUTE_TYPE,STORE_TERMINAL_MULTI_PRINTER,STORE_TERMINAL_RANGE_REFERENCE\n',
  );
}
if (fixture.stableFixtures.workspaceIam.roles.length !== 8)
  throw new Error('R5_SEED_ROLE_EXPERIENCE_DENOMINATOR_DRIFT');
for (const roleKey of ['role-store-inventory', 'role-store-manager'])
  if (!fixture.stableFixtures.workspaceIam.roles.some(role => role.key === roleKey))
    throw new Error(`R5_SEED_ROLE_EXPERIENCE_MISSING:${roleKey}`);
for (const [label, entries] of [
  ['organization.regions', fixture.stableFixtures.organization.regions],
  ['organization.projects', fixture.stableFixtures.organization.projects],
  ['organization.brands', fixture.stableFixtures.organization.brands],
  ['organization.tenants', fixture.stableFixtures.organization.tenants],
  ['organization.headCompanies', fixture.stableFixtures.organization.headCompanies],
  ['organization.stores', fixture.stableFixtures.organization.stores],
  ['organization.storeServicePoints.areas', fixture.stableFixtures.organization.storeServicePoints.areas],
  ['organization.storeServicePoints.points', fixture.stableFixtures.organization.storeServicePoints.points],
  ['organization.storeTerminals', fixture.stableFixtures.organization.storeTerminals],
  ['workspaceIam.roles', fixture.stableFixtures.workspaceIam.roles],
  ['workspaceIam.accounts', fixture.stableFixtures.workspaceIam.accounts],
])
  requireThreeStateCoverage(entries, label);
const facts = fixtureContract.actual;
if (Object.hasOwn(profile, 'expectedCounts')) throw new Error('R5_SEED_PROFILE_COUNT_MIRROR_FORBIDDEN');
if (fixture.scenarioPrerequisitePolicy.denominator !== profile.scenarioDenominator)
  throw new Error('R5_SEED_SCENARIO_DENOMINATOR_DRIFT');
process.stdout.write(
  `R5_SEED_DRY_RUN=PASS; PROFILE=${profile.profile}; SCENARIOS=${profile.scenarioDenominator}; FIXTURES=${Object.keys(facts).length}; STAGES=${fixture.seedStages.map(stage => stage.id).join(',')}\n`,
);
