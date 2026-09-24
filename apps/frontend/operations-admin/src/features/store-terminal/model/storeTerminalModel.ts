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

export type StoreTerminalFormValues = {
  name: string;
  deviceType: string;
  activationCode?: string;
  printers: TerminalPrinterForm[];
  functions: TerminalFunctionForm[];
};

export function terminalFunctionIdentity(
  value: Pick<TerminalFunctionForm, 'ref' | 'clientKey'> | undefined,
  fallback?: string,
) {
  return value?.ref ?? value?.clientKey ?? fallback ?? '';
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

export type StoreTerminalEditor = {
  mode: 'create' | 'edit';
  /** The selected store/workspace context that owns this draft. */
  contextKey: string;
  terminal?: StoreTerminalDetail;
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
 * A function change is a change of the rule owner, not a label edit.  Keep the
 * child identity so an existing function remains the same aggregate child,
 * but clear every function-specific range and scene value.  Carrying those
 * values across function types can leave a range that the new function does
 * not support and would only be rejected at save time.
 */
export function replaceTerminalFunctionConfiguration(
  current: TerminalFunctionForm,
  nextFunctionKey: string,
): TerminalFunctionForm {
  return {
    ...current,
    functionKey: nextFunctionKey,
    selectedRangeKeys: [],
    tableAreaAll: false,
    tableAreaRefs: [],
    productionTagAll: false,
    productionTagRefs: [],
    scenes: Object.fromEntries(
      scenesForFunction(nextFunctionKey).map(scene => [scene.key, {selected: false, orderTypes: [], printerKeys: []}]),
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

export function terminalFormValuesFromDetail(terminal?: StoreTerminalDetail): StoreTerminalFormValues {
  if (!terminal) {
    return {
      name: '',
      deviceType: '',
      activationCode: '',
      printers: [],
      functions: [],
    };
  }
  return {
    name: terminal.name,
    deviceType: terminal.deviceType,
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
      tableAreaAll: fn.ranges.find(range => range.key === 'TABLE_AREA')?.all ?? false,
      tableAreaRefs: fn.ranges.find(range => range.key === 'TABLE_AREA')?.refs.map(String) ?? [],
      productionTagAll: fn.ranges.find(range => range.key === 'PRODUCTION_TAG')?.all ?? false,
      productionTagRefs: fn.ranges.find(range => range.key === 'PRODUCTION_TAG')?.refs.map(String) ?? [],
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

function comparablePrinter(printer: TerminalPrinterForm) {
  return {
    name: printer.name.trim(),
    brandKey: printer.brandKey,
    modelKey: printer.modelKey,
    paperSpecKey: printer.paperSpecKey,
    connectionMethodKey: printer.connectionMethodKey,
    connectionParameter: printer.connectionParameter?.trim() ?? '',
  };
}

function comparableConfiguration(values: StoreTerminalFormValues) {
  const printerByKey = new Map(
    values.printers.flatMap(printer => {
      const identity = printer.ref ?? printer.clientKey;
      return identity ? [[String(identity), comparablePrinter(printer)] as const] : [];
    }),
  );
  const printerForScene = (key: string) => printerByKey.get(String(key)) ?? {identity: String(key)};
  return {
    printers: values.printers
      .map(comparablePrinter)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    functions: values.functions
      .map(functionForm => ({
        functionKey: functionForm.functionKey,
        ranges: functionForm.selectedRangeKeys
          .map(key => ({
            key,
            all:
              key === 'TABLE_AREA'
                ? functionForm.tableAreaAll
                : key === 'PRODUCTION_TAG'
                  ? functionForm.productionTagAll
                  : false,
            refs:
              key === 'TABLE_AREA'
                ? [...functionForm.tableAreaRefs].sort()
                : key === 'PRODUCTION_TAG'
                  ? [...functionForm.productionTagRefs].sort()
                  : [],
          }))
          .sort((left, right) => left.key.localeCompare(right.key)),
        scenes: Object.entries(functionForm.scenes)
          .filter(([, scene]) => scene.selected)
          .map(([sceneKey, scene]) => ({
            sceneKey,
            orderTypes: [...scene.orderTypes].sort(),
            printers: scene.printerKeys
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
  values: StoreTerminalFormValues,
): boolean {
  const readBack = terminalFormValuesFromDetail(terminal);
  return (
    terminal.name === values.name.trim() &&
    terminal.deviceType === values.deviceType &&
    JSON.stringify(comparableConfiguration(readBack)) === JSON.stringify(comparableConfiguration(values))
  );
}

function rangeSelections(functionForm: TerminalFunctionForm): StoreTerminalRangeSelection[] {
  return functionForm.selectedRangeKeys.map(key => ({
    key,
    all:
      key === 'TABLE_AREA'
        ? functionForm.tableAreaAll
        : key === 'PRODUCTION_TAG'
          ? functionForm.productionTagAll
          : false,
    refs:
      key === 'TABLE_AREA'
        ? functionForm.tableAreaAll
          ? []
          : functionForm.tableAreaRefs.map(ref => wireUuid(ref))
        : key === 'PRODUCTION_TAG'
          ? functionForm.productionTagAll
            ? []
            : functionForm.productionTagRefs.map(ref => wireUuid(ref))
          : [],
  }));
}

function sceneSelections(
  functionForm: TerminalFunctionForm,
  printers: readonly TerminalPrinterForm[],
): StoreTerminalSceneSelection[] {
  const printerRefs = new Set(printers.flatMap(printer => (printer.ref ? [String(printer.ref)] : [])));
  return storeTerminalScenesForFunction(functionForm.functionKey as StoreTerminalFunctionKey)
    .filter(scene => functionForm.scenes[scene.key]?.selected === true)
    .map(scene => {
      const value = functionForm.scenes[scene.key] ?? {selected: false, orderTypes: [], printerKeys: []};
      return {
        sceneKey: scene.key,
        orderTypes: value.orderTypes,
        printers: value.printerKeys.map(printerKey =>
          printerRefs.has(printerKey) ? {printerRef: wireUuid(printerKey)} : {printerClientKey: printerKey},
        ),
      };
    });
}

function printerInputs(printers: readonly TerminalPrinterForm[]): StoreTerminalPrinterInput[] {
  return printers.map(printer => ({
    ...(printer.ref ? {ref: wireUuid(printer.ref)} : {clientKey: printer.clientKey}),
    name: printer.name.trim(),
    brandKey: printer.brandKey,
    modelKey: printer.modelKey,
    paperSpecKey: printer.paperSpecKey,
    connectionMethodKey: printer.connectionMethodKey,
    connectionParameter: printer.connectionParameter?.trim() || null,
  }));
}

function functionInputs(
  functions: readonly TerminalFunctionForm[],
  printers: readonly TerminalPrinterForm[],
): StoreTerminalFunctionInput[] {
  return functions.map(functionForm => ({
    ...(functionForm.ref ? {ref: wireUuid(functionForm.ref)} : {clientKey: functionForm.clientKey}),
    functionKey: functionForm.functionKey,
    ranges: rangeSelections(functionForm),
    scenes: sceneSelections(functionForm, printers),
  }));
}

export function configurationInput(values: StoreTerminalFormValues): StoreTerminalConfigurationInput {
  return {
    printers: printerInputs(values.printers),
    functions: functionInputs(values.functions, values.printers),
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
  existingFunctions: readonly Pick<TerminalFunctionForm, 'functionKey'>[],
) {
  const counts = new Map<string, number>();
  for (const value of existingFunctions) counts.set(value.functionKey, (counts.get(value.functionKey) ?? 0) + 1);
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
  const previousItem = [...visible].reverse().find(item => (previousOrder.get(String(item.terminalRef)) ?? -1) < voidedIndex);
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
