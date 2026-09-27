import {LIFECYCLE_LABELS, lifecycleColor} from '@catering-v2s/admin-ui-foundation';
import type {
  StoreTerminalConfiguration,
  StoreTerminalConfigurationInput,
  StoreTerminalDetail,
  StoreTerminalFunctionInput,
  StoreTerminalPrinterInput,
  StoreTerminalRangeSelection,
  StoreTerminalSceneSelection,
  StoreTerminalStatus,
} from '../../../app/api/generated/operations-edge';
import {
  STORE_TERMINAL_CONNECTION_METHODS,
  STORE_TERMINAL_DEVICE_TYPES,
  STORE_TERMINAL_FUNCTIONS,
  STORE_TERMINAL_ORDER_TYPES,
  STORE_TERMINAL_PAPER_SPECS,
  STORE_TERMINAL_PRINTER_BRANDS,
  STORE_TERMINAL_PRINTER_MODELS,
  STORE_TERMINAL_RANGES,
  STORE_TERMINAL_RANGE_KEYS,
  storeTerminalScenesForFunction,
  type StoreTerminalConnectionMethodKey,
  type StoreTerminalDeviceTypeKey,
  type StoreTerminalFunctionKey,
  type StoreTerminalOrderTypeKey,
  type StoreTerminalPrinterModelKey,
  type StoreTerminalRangeKey,
} from '../../../app/api/generated/storeTerminalRules';
import {wireUuid} from '../../../app/api/wireUuid';

export const STORE_TERMINAL_PAGE_SIZE = 20;

export const storeTerminalStatusLabels: Record<StoreTerminalStatus, string> = LIFECYCLE_LABELS;
export const storeTerminalStatusColor = lifecycleColor;

export const storeTerminalDeviceTypeLabels = Object.fromEntries(
  STORE_TERMINAL_DEVICE_TYPES.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalDeviceTypeDescriptions = Object.fromEntries(
  STORE_TERMINAL_DEVICE_TYPES.map(value => [value.key, value.description]),
) as Record<string, string>;
export const storeTerminalFunctionLabels = Object.fromEntries(
  STORE_TERMINAL_FUNCTIONS.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalRangeLabels = Object.fromEntries(
  STORE_TERMINAL_RANGES.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalOrderTypeLabels = Object.fromEntries(
  STORE_TERMINAL_ORDER_TYPES.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalConnectionMethodLabels = Object.fromEntries(
  STORE_TERMINAL_CONNECTION_METHODS.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalPaperSpecLabels = Object.fromEntries(
  STORE_TERMINAL_PAPER_SPECS.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalBrandLabels = Object.fromEntries(
  STORE_TERMINAL_PRINTER_BRANDS.map(value => [value.key, value.label]),
) as Record<string, string>;
export const storeTerminalModelLabels = Object.fromEntries(
  STORE_TERMINAL_PRINTER_MODELS.map(value => [value.key, value.label]),
) as Record<string, string>;

export type TerminalSceneForm = {
  selected: boolean;
  orderTypes: string[];
  printerKeys: string[];
};

export type TerminalSceneValidationCode = 'PAPER_SPEC_MISMATCH' | 'PRINTER_INVALID';

export class TerminalSceneValidationError extends Error {
  readonly code: TerminalSceneValidationCode;

  constructor(code: TerminalSceneValidationCode, message: string) {
    super(message);
    this.name = 'TerminalSceneValidationError';
    this.code = code;
  }
}

export type TerminalFunctionForm = {
  ref?: string;
  clientKey: string;
  functionKey: string;
  selectedRangeKeys: string[];
  tableAreaAll: boolean;
  tableAreaRefs: string[];
  productionTagAll: boolean;
  productionTagRefs: string[];
  scenes: Record<string, TerminalSceneForm>;
};

export type TerminalPrinterForm = {
  ref?: string;
  clientKey: string;
  name: string;
  brandKey: string;
  modelKey: string;
  paperSpecKey: string;
  connectionMethodKey: string;
  connectionParameter?: string;
};

export type StoreTerminalConfigurationFormValues = {
  name: string;
  printers: TerminalPrinterForm[];
  functions: TerminalFunctionForm[];
};

export type StoreTerminalCreateFormValues = StoreTerminalConfigurationFormValues & {
  deviceType: string;
  activationCode?: string;
};

export type StoreTerminalEditFormValues = StoreTerminalConfigurationFormValues;

/** Superset used only by shared Ant Design child editors; submit types stay create/edit specific. */
export type StoreTerminalFormValues = StoreTerminalConfigurationFormValues & {
  deviceType?: string;
  activationCode?: string;
};

export function terminalFunctionIdentity(value: Pick<TerminalFunctionForm, 'ref' | 'clientKey'> | undefined) {
  return value?.ref ?? value?.clientKey ?? '';
}

export function terminalPrinterIdentity(value: Pick<TerminalPrinterForm, 'ref' | 'clientKey'> | undefined) {
  return value?.ref ?? value?.clientKey ?? '';
}

export function requireTerminalIdentity(identity: string, subject: 'function' | 'printer') {
  if (typeof identity !== 'string' || identity.trim().length === 0 || identity !== identity.trim()) {
    throw new Error(`STORE_TERMINAL_${subject.toUpperCase()}_IDENTITY_MISSING`);
  }
  return identity;
}

/**
 * Resolves a scene selection against the same printer collection that will be
 * submitted.  A scene must never silently turn an empty, stale, or unknown
 * selection into a different wire binding (or into no binding at all).
 */
export function resolveTerminalPrinter(
  printerKey: unknown,
  printers: readonly TerminalPrinterForm[],
): TerminalPrinterForm {
  if (typeof printerKey !== 'string' || printerKey.trim().length === 0) {
    throw new Error('TERMINAL_SCENE_PRINTER_IDENTITY_MISSING');
  }
  const normalizedPrinterKey = printerKey as string;
  const printer = compactValues<TerminalPrinterForm>(printers).find(
    value => terminalPrinterIdentity(value) === normalizedPrinterKey,
  );
  if (!printer) {
    throw new Error('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');
  }
  requireTerminalIdentity(terminalPrinterIdentity(printer), 'printer');
  return printer;
}

export function resolveFunctionSelection(
  values: readonly Pick<TerminalFunctionForm, 'ref' | 'clientKey'>[],
  selectedIdentity?: string,
) {
  const identities = values.map(value => terminalFunctionIdentity(value)).filter(Boolean);
  return selectedIdentity && identities.includes(selectedIdentity) ? selectedIdentity : identities[0];
}

export function nextFunctionIdentityAfterRemoval(
  values: readonly Pick<TerminalFunctionForm, 'ref' | 'clientKey'>[],
  removedIdentity: string,
) {
  const identities = values.map(value => terminalFunctionIdentity(value)).filter(Boolean);
  const removedIndex = identities.indexOf(removedIdentity);
  if (removedIndex < 0) return identities[0];
  return identities[removedIndex + 1] ?? identities[removedIndex - 1];
}

export type StoreTerminalEditor =
  | {
      mode: 'create';
      /** The selected store/workspace context that owns this draft. */
      contextKey: string;
      terminal?: never;
    }
  | {
      mode: 'edit';
      /** The selected store/workspace context that owns this draft. */
      contextKey: string;
      terminal: StoreTerminalDetail;
    };

export function newTerminalFunction(functionKey: StoreTerminalFunctionKey = 'ORDERING_CASHIER'): TerminalFunctionForm {
  return {
    clientKey: `function-${crypto.randomUUID()}`,
    functionKey,
    selectedRangeKeys: [],
    tableAreaAll: false,
    tableAreaRefs: [],
    productionTagAll: false,
    productionTagRefs: [],
    scenes: Object.fromEntries(
      storeTerminalScenesForFunction(functionKey).map(scene => [
        scene.key,
        {selected: false, orderTypes: [], printerKeys: []},
      ]),
    ),
  };
}

/**
 * Unchecking a scene removes only that scene's dependent draft values. Other
 * scenes and the function/child identity remain part of the same aggregate
 * edit intent.
 */
export function clearTerminalSceneConfiguration(current: TerminalFunctionForm, sceneKey: string): TerminalFunctionForm {
  const scene = current.scenes[sceneKey];
  if (!scene) return current;
  return {
    ...current,
    scenes: {
      ...current.scenes,
      [sceneKey]: {selected: false, orderTypes: [], printerKeys: []},
    },
  };
}

export function newTerminalPrinter(): TerminalPrinterForm {
  return {
    clientKey: `printer-${crypto.randomUUID()}`,
    name: '',
    brandKey: '',
    modelKey: '',
    paperSpecKey: '',
    connectionMethodKey: '',
    connectionParameter: '',
  };
}

export function newTerminalCreateFormValues(): StoreTerminalCreateFormValues {
  return {
    ...terminalFormValuesFromDetail(),
    deviceType: '',
    activationCode: '',
  };
}

export function terminalFormValuesFromDetail(terminal?: StoreTerminalDetail): StoreTerminalEditFormValues {
  if (!terminal) {
    return {
      name: '',
      printers: [],
      functions: [],
    };
  }
  return {
    name: terminal.name,
    printers: terminal.configuration.printers.map(printer => ({
      ref: String(printer.ref),
      clientKey: `printer-existing-${printer.ref}`,
      name: printer.name,
      brandKey: printer.brandKey,
      modelKey: printer.modelKey,
      paperSpecKey: printer.paperSpecKey,
      connectionMethodKey: printer.connectionMethodKey,
      connectionParameter: printer.connectionParameter ?? '',
    })),
    functions: terminal.configuration.functions.map(fn => ({
      ref: String(fn.ref),
      clientKey: `function-existing-${fn.ref}`,
      functionKey: fn.functionKey,
      selectedRangeKeys: fn.ranges.map(range => range.key),
      tableAreaAll: fn.ranges.find(range => range.key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA)?.all ?? false,
      tableAreaRefs:
        fn.ranges.find(range => range.key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA)?.refs.map(String) ?? [],
      productionTagAll: fn.ranges.find(range => range.key === STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG)?.all ?? false,
      productionTagRefs:
        fn.ranges.find(range => range.key === STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG)?.refs.map(String) ?? [],
      scenes: Object.fromEntries(
        storeTerminalScenesForFunction(fn.functionKey as StoreTerminalFunctionKey).map(scene => {
          const current = fn.scenes.find(value => value.sceneKey === scene.key);
          return [
            scene.key,
            current
              ? {
                  selected: true,
                  orderTypes: current.orderTypes,
                  printerKeys: current.printers.map(printer => String(printer.printerRef)),
                }
              : {selected: false, orderTypes: [], printerKeys: []},
          ];
        }),
      ),
    })),
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function compactValues<T>(values: readonly (T | null | undefined)[] | unknown): T[] {
  return Array.isArray(values) ? values.filter((value): value is T => value != null) : [];
}

function stringValues(values: readonly (string | null | undefined)[] | unknown): string[] {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
}

function strictStringValues(values: unknown, errorCode: string, allowUndefined = false): string[] {
  if (values === undefined && allowUndefined) return [];
  if (!Array.isArray(values)) throw new Error(errorCode);
  return values.map(value => {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(errorCode);
    return value;
  });
}

function strictRows<T>(values: unknown, errorCode: string, allowUndefined = false): T[] {
  if (values === undefined && allowUndefined) return [];
  if (!Array.isArray(values)) throw new Error(errorCode);
  return values.map(value => {
    if (value === null || value === undefined || typeof value !== 'object') throw new Error(errorCode);
    return value as T;
  });
}

export function scenePrinterKeys(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');
  const keys = value.map(printerKey => {
    if (typeof printerKey !== 'string' || printerKey.trim().length === 0 || printerKey !== printerKey.trim()) {
      throw new Error('TERMINAL_SCENE_PRINTER_IDENTITY_MISSING');
    }
    return printerKey;
  });
  if (new Set(keys).size !== keys.length) {
    throw new Error('TERMINAL_SCENE_PRINTER_IDENTITY_DUPLICATE');
  }
  return keys;
}

export function scenePrinterKeysForDisplay(
  value: unknown,
): {valid: true; keys: string[]} | {valid: false; keys: string[]; errorCode: string} {
  if (value === undefined) return {valid: true, keys: []};
  if (!Array.isArray(value)) {
    return {valid: false, keys: [], errorCode: 'TERMINAL_SCENE_PRINTER_IDENTITY_INVALID'};
  }
  for (const printerKey of value) {
    if (typeof printerKey !== 'string' || printerKey.trim().length === 0 || printerKey !== printerKey.trim()) {
      return {valid: false, keys: [], errorCode: 'TERMINAL_SCENE_PRINTER_IDENTITY_MISSING'};
    }
  }
  const keys = value as string[];
  if (new Set(keys).size !== keys.length) {
    return {valid: false, keys: [], errorCode: 'TERMINAL_SCENE_PRINTER_IDENTITY_DUPLICATE'};
  }
  return {valid: true, keys};
}

export function terminalSceneDraftHasInvalidCollections(
  value: unknown,
  allowedOrderTypeKeys?: readonly string[],
  knownPrinterKeys?: readonly string[],
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scene = value as {orderTypes?: unknown; printerKeys?: unknown};
  const orderTypes = scene.orderTypes;
  if (
    orderTypes !== undefined &&
    (!Array.isArray(orderTypes) ||
      orderTypes.some(
        orderType =>
          typeof orderType !== 'string' ||
          orderType.trim().length === 0 ||
          (allowedOrderTypeKeys !== undefined && !allowedOrderTypeKeys.includes(orderType)),
      ))
  ) {
    return true;
  }
  if (Array.isArray(orderTypes) && new Set(orderTypes).size !== orderTypes.length) return true;
  const printerDisplay = scenePrinterKeysForDisplay(scene.printerKeys);
  if (!printerDisplay.valid) return true;
  return knownPrinterKeys !== undefined && printerDisplay.keys.some(key => !knownPrinterKeys.includes(key));
}

function preserveScenePrinterKeys(value: unknown): string[] {
  // Do not normalize an invalid scene binding into an empty selection. The
  // serializer must see null, a non-array, or an empty/whitespace element so
  // that scenePrinterKeys can fail closed; an actually empty array remains a
  // valid soft-constraint value.
  return value as string[];
}

function preserveSceneOrderTypes(value: unknown): string[] {
  // Do not turn an invalid order-type collection into an empty selection.
  // Keeping the raw value lets the editor expose a read failure and lets the
  // strict serializer reject it instead of silently losing the rule.
  return value as string[];
}

export function normalizeTerminalPrinterForm(
  value: Partial<TerminalPrinterForm> | undefined,
  fallbackClientKey?: string,
): TerminalPrinterForm | undefined {
  if (!value && !fallbackClientKey) return undefined;
  return {
    ...(value?.ref ? {ref: String(value.ref)} : {}),
    clientKey: stringValue(value?.clientKey) || fallbackClientKey || '',
    name: stringValue(value?.name),
    brandKey: stringValue(value?.brandKey),
    modelKey: stringValue(value?.modelKey),
    paperSpecKey: stringValue(value?.paperSpecKey),
    connectionMethodKey: stringValue(value?.connectionMethodKey),
    connectionParameter: stringValue(value?.connectionParameter),
  };
}

export function normalizeTerminalFunctionForm(
  value: Partial<TerminalFunctionForm> | undefined,
  fallbackClientKey?: string,
): TerminalFunctionForm | undefined {
  if (!value && !fallbackClientKey) return undefined;
  const scenes = Object.fromEntries(
    Object.entries(value?.scenes ?? {}).map(([sceneKey, scene]) => [
      sceneKey,
      {
        selected: scene?.selected === true,
        orderTypes: preserveSceneOrderTypes(scene?.orderTypes),
        printerKeys: preserveScenePrinterKeys(scene?.printerKeys),
      },
    ]),
  );
  return {
    ...(value?.ref ? {ref: String(value.ref)} : {}),
    clientKey: stringValue(value?.clientKey) || fallbackClientKey || '',
    functionKey: stringValue(value?.functionKey),
    selectedRangeKeys: stringValues(value?.selectedRangeKeys),
    tableAreaAll: value?.tableAreaAll === true,
    tableAreaRefs: stringValues(value?.tableAreaRefs),
    productionTagAll: value?.productionTagAll === true,
    productionTagRefs: stringValues(value?.productionTagRefs),
    scenes,
  };
}

export function terminalPrinterReadyForBinding(printer: TerminalPrinterForm | undefined) {
  const identity = terminalPrinterIdentity(printer);
  const validIdentity = typeof identity === 'string' && identity.length > 0 && identity === identity.trim();
  return Boolean(
    printer &&
    validIdentity &&
    stringValue(printer.name).trim() &&
    printer.brandKey &&
    printer.modelKey &&
    printer.paperSpecKey &&
    printer.connectionMethodKey,
  );
}

function comparablePrinter(printer: TerminalPrinterForm) {
  return {
    name: stringValue(printer.name).trim(),
    brandKey: stringValue(printer.brandKey),
    modelKey: stringValue(printer.modelKey),
    paperSpecKey: stringValue(printer.paperSpecKey),
    connectionMethodKey: stringValue(printer.connectionMethodKey),
    connectionParameter: stringValue(printer.connectionParameter).trim(),
  };
}

function comparableConfiguration(values: StoreTerminalConfigurationFormValues) {
  const printers = compactValues<TerminalPrinterForm>(values.printers);
  const functions = compactValues<TerminalFunctionForm>(values.functions);
  const printerByKey = new Map(
    printers.flatMap(printer => {
      const identity = stringValue(printer.ref ?? printer.clientKey);
      return identity ? [[String(identity), comparablePrinter(printer)] as const] : [];
    }),
  );
  const printerForScene = (key: string) => printerByKey.get(String(key)) ?? {identity: String(key)};
  return {
    printers: printers
      .map(comparablePrinter)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    functions: functions
      .map(functionForm => ({
        functionKey: stringValue(functionForm.functionKey),
        ranges: stringValues(functionForm.selectedRangeKeys)
          .map(key => ({
            key,
            all:
              key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA
                ? functionForm.tableAreaAll === true
                : key === STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG
                  ? functionForm.productionTagAll === true
                  : false,
            refs:
              key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA
                ? stringValues(functionForm.tableAreaRefs).sort()
                : key === STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG
                  ? stringValues(functionForm.productionTagRefs).sort()
                  : [],
          }))
          .sort((left, right) => left.key.localeCompare(right.key)),
        scenes: Object.entries(functionForm.scenes ?? {})
          .filter(([, scene]) => scene?.selected === true)
          .map(([sceneKey, scene]) => ({
            sceneKey,
            orderTypes: stringValues(scene?.orderTypes).sort(),
            printers: stringValues(scene?.printerKeys)
              .map(printerForScene)
              .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
          }))
          .sort((left, right) => left.sceneKey.localeCompare(right.sceneKey)),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  };
}

/** Compares a read-back aggregate without depending on newly assigned child refs. */
export function terminalDraftMatchesFormValues(
  terminal: StoreTerminalDetail,
  values: StoreTerminalEditFormValues,
): boolean {
  if (typeof values.name !== 'string' || !Array.isArray(values.printers) || !Array.isArray(values.functions)) {
    return false;
  }
  let readBack: StoreTerminalEditFormValues;
  try {
    configurationInput(values);
    readBack = terminalFormValuesFromDetail(terminal);
  } catch {
    return false;
  }
  return (
    terminal.name === values.name.trim() &&
    JSON.stringify(comparableConfiguration(readBack)) === JSON.stringify(comparableConfiguration(values))
  );
}

function rangeSelections(functionForm: TerminalFunctionForm): StoreTerminalRangeSelection[] {
  const selectedRangeKeys = strictStringValues(functionForm.selectedRangeKeys, 'STORE_TERMINAL_RULE_INVALID');
  const tableAreaRefs = strictStringValues(functionForm.tableAreaRefs, 'STORE_TERMINAL_RULE_INVALID', true);
  const productionTagRefs = strictStringValues(functionForm.productionTagRefs, 'STORE_TERMINAL_RULE_INVALID', true);
  const allowedRangeKeys = new Set(allowedRangesForFunction(functionForm.functionKey));
  if (selectedRangeKeys.some(key => !allowedRangeKeys.has(key as never))) {
    throw new Error('STORE_TERMINAL_RULE_INVALID');
  }
  return selectedRangeKeys.map(key => ({
    key,
    all:
      key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA
        ? functionForm.tableAreaAll === true
        : key === STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG
          ? functionForm.productionTagAll === true
          : false,
    refs:
      key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA
        ? functionForm.tableAreaAll === true
          ? []
          : tableAreaRefs.map(ref => wireUuid(ref))
        : key === STORE_TERMINAL_RANGE_KEYS.PRODUCTION_TAG
          ? functionForm.productionTagAll === true
            ? []
            : productionTagRefs.map(ref => wireUuid(ref))
          : [],
  }));
}

function sceneSelections(
  functionForm: TerminalFunctionForm,
  printers: readonly TerminalPrinterForm[],
): StoreTerminalSceneSelection[] {
  if (!functionRuleForKey(functionForm.functionKey)) throw new Error('STORE_TERMINAL_RULE_INVALID');
  const scenes = functionForm.scenes;
  if (!scenes || typeof scenes !== 'object' || Array.isArray(scenes)) {
    throw new Error('STORE_TERMINAL_RULE_INVALID');
  }
  const declaredScenes = new Set<string>(
    storeTerminalScenesForFunction(functionForm.functionKey as StoreTerminalFunctionKey).map(scene => scene.key),
  );
  if (Object.keys(scenes).some(sceneKey => !declaredScenes.has(sceneKey))) {
    throw new Error('STORE_TERMINAL_RULE_INVALID');
  }
  return storeTerminalScenesForFunction(functionForm.functionKey as StoreTerminalFunctionKey)
    .filter(scene => scenes[scene.key]?.selected === true)
    .map(scene => {
      const value = scenes[scene.key] ?? {selected: false, orderTypes: [], printerKeys: []};
      const orderTypes = strictStringValues(value?.orderTypes, 'STORE_TERMINAL_RULE_INVALID', true);
      const rawPrinterKeys: unknown = value?.printerKeys;
      if (rawPrinterKeys !== undefined && !Array.isArray(rawPrinterKeys)) {
        throw new Error('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');
      }
      const printerKeys = scenePrinterKeys(rawPrinterKeys);
      if (orderTypes.some(orderType => !STORE_TERMINAL_ORDER_TYPES.some(item => item.key === orderType))) {
        throw new Error('STORE_TERMINAL_RULE_INVALID');
      }
      if (new Set(orderTypes).size !== orderTypes.length) {
        throw new Error('STORE_TERMINAL_RULE_INVALID');
      }
      return {
        sceneKey: scene.key,
        orderTypes,
        printers: printerKeys.map(printerKey => {
          const printer = resolveTerminalPrinter(printerKey, printers);
          const identity = requireTerminalIdentity(terminalPrinterIdentity(printer), 'printer');
          return printer.ref ? {printerRef: wireUuid(printer.ref)} : {printerClientKey: identity};
        }),
      };
    });
}

function printerInputs(printers: readonly TerminalPrinterForm[]): StoreTerminalPrinterInput[] {
  const identities = printers.map(printer => requireTerminalIdentity(terminalPrinterIdentity(printer), 'printer'));
  if (new Set(identities).size !== identities.length) {
    throw new Error('STORE_TERMINAL_PRINTER_IDENTITY_DUPLICATE');
  }
  return printers.map(printer => {
    return {
      ...(printer.ref ? {ref: wireUuid(printer.ref)} : {clientKey: printer.clientKey}),
      name: stringValue(printer.name).trim(),
      brandKey: stringValue(printer.brandKey),
      modelKey: stringValue(printer.modelKey),
      paperSpecKey: stringValue(printer.paperSpecKey),
      connectionMethodKey: stringValue(printer.connectionMethodKey),
      connectionParameter: stringValue(printer.connectionParameter).trim() || null,
    };
  });
}

function functionInputs(
  functions: readonly TerminalFunctionForm[],
  printers: readonly TerminalPrinterForm[],
): StoreTerminalFunctionInput[] {
  const identities = functions.map(functionForm =>
    requireTerminalIdentity(terminalFunctionIdentity(functionForm), 'function'),
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error('STORE_TERMINAL_FUNCTION_IDENTITY_DUPLICATE');
  }
  return functions.map(functionForm => {
    const functionKey = stringValue(functionForm.functionKey);
    if (!functionKey.trim()) throw new Error('STORE_TERMINAL_FUNCTION_KEY_MISSING');
    if (!functionRuleForKey(functionKey)) throw new Error('STORE_TERMINAL_RULE_INVALID');
    return {
      ...(functionForm.ref ? {ref: wireUuid(functionForm.ref)} : {clientKey: functionForm.clientKey}),
      functionKey,
      ranges: rangeSelections(functionForm),
      scenes: sceneSelections(functionForm, printers),
    };
  });
}

export function configurationInput<TValues extends StoreTerminalConfigurationFormValues>(
  values: TValues,
): StoreTerminalConfigurationInput {
  const printers = strictRows<TerminalPrinterForm>(values.printers, 'STORE_TERMINAL_PRINTER_INPUT_INVALID', true);
  const functions = strictRows<TerminalFunctionForm>(values.functions, 'STORE_TERMINAL_FUNCTION_INPUT_INVALID');
  return {
    printers: printerInputs(printers),
    functions: functionInputs(functions, printers),
  };
}

export function configurationFromDetail(configuration: StoreTerminalConfiguration) {
  return configuration;
}

export function modelOptionsForBrand(brandKey: string) {
  return STORE_TERMINAL_PRINTER_MODELS.filter(model => model.brandKey === brandKey);
}

export function modelOptionsForBrandAndConnection(brandKey: string, connectionMethodKey?: string) {
  return modelOptionsForBrand(brandKey).filter(
    model =>
      !connectionMethodKey || (model.allowedConnectionMethodKeys as readonly string[]).includes(connectionMethodKey),
  );
}

export function modelByKey(modelKey: string) {
  return STORE_TERMINAL_PRINTER_MODELS.find(model => model.key === modelKey);
}

export function connectionOptionsForModel(modelKey: string) {
  const model = modelByKey(modelKey);
  const allowed = model?.allowedConnectionMethodKeys ?? [];
  return STORE_TERMINAL_CONNECTION_METHODS.filter(method => (allowed as readonly string[]).includes(method.key));
}

export function connectionOptionsForBrand(brandKey: string) {
  const allowed = new Set(modelOptionsForBrand(brandKey).flatMap(model => [...model.allowedConnectionMethodKeys]));
  return STORE_TERMINAL_CONNECTION_METHODS.filter(method => allowed.has(method.key));
}

export function connectionOptionsForPrinter(brandKey: string, modelKey?: string) {
  return modelKey ? connectionOptionsForModel(modelKey) : connectionOptionsForBrand(brandKey);
}

export function paperOptionsForModel(modelKey: string) {
  const model = modelByKey(modelKey);
  const allowed = model?.paperSpecKeys ?? [];
  return STORE_TERMINAL_PAPER_SPECS.filter(spec => (allowed as readonly string[]).includes(spec.key));
}

export function parameterForConnection(methodKey: string) {
  return STORE_TERMINAL_CONNECTION_METHODS.find(method => method.key === methodKey)?.parameter ?? null;
}

export function allowedRangesForFunction(functionKey: string) {
  return STORE_TERMINAL_FUNCTIONS.find(fn => fn.key === functionKey)?.allowedRangeKeys ?? [];
}

export function functionRuleForKey(functionKey: string) {
  return STORE_TERMINAL_FUNCTIONS.find(fn => fn.key === functionKey);
}

export function storeTerminalFunctionMaxInstances(functionKey: string) {
  return functionRuleForKey(functionKey)?.maxPerTerminal ?? null;
}

export function functionOptionsForDeviceType(deviceType: string, currentFunctionKey?: string) {
  return STORE_TERMINAL_FUNCTIONS.filter(
    fn => fn.supportedDeviceTypeKeys.includes(deviceType as never) || fn.key === currentFunctionKey,
  );
}

export function functionsForDeviceType(deviceType: string) {
  return STORE_TERMINAL_FUNCTIONS.filter(fn => fn.supportedDeviceTypeKeys.includes(deviceType as never));
}

export function addableFunctionsForDeviceType(
  deviceType: string,
  existingFunctions?: readonly Pick<TerminalFunctionForm, 'functionKey'>[],
) {
  const counts = new Map<string, number>();
  // Form.List can expose an empty slot while a newly added row is being
  // registered. Treat that transient value as absent at this pure derivation
  // boundary instead of allowing a render-time crash to replace the drawer.
  const currentFunctions = compactValues<Pick<TerminalFunctionForm, 'functionKey'>>(existingFunctions);
  for (const value of currentFunctions) {
    if (typeof value.functionKey !== 'string') continue;
    counts.set(value.functionKey, (counts.get(value.functionKey) ?? 0) + 1);
  }
  return functionsForDeviceType(deviceType).filter(value => {
    const max = value.maxPerTerminal;
    return max == null || (counts.get(value.key) ?? 0) < max;
  });
}

export function resolveTerminalSelection(
  items: readonly {terminalRef: string}[],
  selectedRef?: string,
  pendingRef?: string,
) {
  // A successful create is authoritative immediately.  The cursor page is a
  // window, not the source of truth, so waiting for the new ref to appear in
  // the current page can leave the detail pane showing the previous terminal.
  if (pendingRef) return {selectedRef: pendingRef, pendingRef: undefined};
  // Keep a known selection while the user is on another cursor page.  The
  // detail query is keyed by this ref and can read it independently.
  if (selectedRef) return {selectedRef, pendingRef: undefined};
  return {selectedRef: items[0] ? String(items[0].terminalRef) : undefined, pendingRef: undefined};
}

export function nextTerminalRefAfterVoid(
  previousItems: readonly {terminalRef: string}[],
  visibleItems: readonly {terminalRef: string}[],
  voidedRef: string,
) {
  const visible = visibleItems.filter(item => String(item.terminalRef) !== voidedRef);
  if (!visible.length) return undefined;

  const voidedIndex = previousItems.findIndex(item => String(item.terminalRef) === voidedRef);
  if (voidedIndex < 0) return String(visible[0].terminalRef);

  const previousOrder = new Map(previousItems.map((item, index) => [String(item.terminalRef), index]));
  const previousItem = [...visible]
    .reverse()
    .find(item => (previousOrder.get(String(item.terminalRef)) ?? -1) < voidedIndex);
  return String(
    visible.find(item => (previousOrder.get(String(item.terminalRef)) ?? -1) > voidedIndex)?.terminalRef ??
      previousItem?.terminalRef ??
      visible[0].terminalRef,
  );
}

export function scenesForFunction(functionKey: string) {
  return storeTerminalScenesForFunction(functionKey as StoreTerminalFunctionKey);
}

export function labelForKey(labels: Record<string, string>, key: string) {
  return labels[key] ?? key;
}

export type {
  StoreTerminalConnectionMethodKey,
  StoreTerminalDeviceTypeKey,
  StoreTerminalFunctionKey,
  StoreTerminalOrderTypeKey,
  StoreTerminalPrinterModelKey,
  StoreTerminalRangeKey,
};

export {
  STORE_TERMINAL_DEVICE_TYPES,
  STORE_TERMINAL_FUNCTIONS,
  STORE_TERMINAL_ORDER_TYPES,
  STORE_TERMINAL_PRINTER_BRANDS,
};
