import {describe, expect, it} from 'vitest';
import {
  STORE_TERMINAL_FUNCTIONS,
  addableFunctionsForDeviceType,
  allowedRangesForFunction,
  clearTerminalSceneConfiguration,
  configurationInput,
  connectionOptionsForBrand,
  connectionOptionsForModel,
  modelOptionsForBrand,
  modelOptionsForBrandAndConnection,
  nextFunctionIdentityAfterRemoval,
  nextTerminalRefAfterVoid,
  newTerminalFunction,
  newTerminalPrinter,
  paperOptionsForModel,
  replaceTerminalFunctionConfiguration,
  resolveFunctionSelection,
  scenesForFunction,
  storeTerminalStatusLabels,
  terminalFunctionIdentity,
  terminalFormValuesFromDetail,
  resolveTerminalSelection,
  type StoreTerminalFormValues,
} from './storeTerminalModel';
import {
  STORE_TERMINAL_CONNECTION_METHODS,
  STORE_TERMINAL_PAPER_SPECS,
} from '../../../app/api/generated/storeTerminalRules';

describe('store terminal form model', () => {
  it('selects the next visible terminal after the current terminal is voided', () => {
    const before = [{terminalRef: 'terminal-1'}, {terminalRef: 'terminal-2'}, {terminalRef: 'terminal-3'}];
    expect(nextTerminalRefAfterVoid(before, [{terminalRef: 'terminal-2'}, {terminalRef: 'terminal-3'}], 'terminal-1')).toBe(
      'terminal-2',
    );
    expect(nextTerminalRefAfterVoid(before, [{terminalRef: 'terminal-1'}, {terminalRef: 'terminal-3'}], 'terminal-2')).toBe(
      'terminal-3',
    );
    expect(nextTerminalRefAfterVoid(before, [{terminalRef: 'terminal-1'}, {terminalRef: 'terminal-2'}], 'terminal-3')).toBe(
      'terminal-2',
    );
    expect(nextTerminalRefAfterVoid([{terminalRef: 'terminal-1'}], [], 'terminal-1')).toBeUndefined();
  });

  it('keeps function selection on stable ref/clientKey identities', () => {
    const existing = {ref: 'function-ref', clientKey: 'function-existing'};
    const draft = {clientKey: 'function-draft'};
    expect(terminalFunctionIdentity(existing)).toBe('function-ref');
    expect(resolveFunctionSelection([existing, draft], 'function-draft')).toBe('function-draft');
    expect(resolveFunctionSelection([existing, draft], 'removed')).toBe('function-ref');
    expect(nextFunctionIdentityAfterRemoval([existing, draft], 'function-ref')).toBe('function-draft');
    expect(nextFunctionIdentityAfterRemoval([existing, draft], 'function-draft')).toBe('function-ref');
  });

  it('keeps the lifecycle vocabulary and rule-driven selection sets complete', () => {
    expect(storeTerminalStatusLabels).toEqual({ENABLED: '启用', DISABLED: '停用', VOIDED: '作废'});
    expect(allowedRangesForFunction('KITCHEN_PRINT')).toEqual(['PRODUCTION_TAG']);
    expect(STORE_TERMINAL_FUNCTIONS.map(item => item.key)).toContain('ORDERING_CASHIER');
    expect(STORE_TERMINAL_PAPER_SPECS.map(item => item.key)).toContain('LABEL_40_30');
    expect(STORE_TERMINAL_CONNECTION_METHODS.map(item => item.key)).toContain('USB');
  });

  it('derives model, paper and connection candidates from the contract rules', () => {
    const thermalBrand = modelOptionsForBrand('EPSON');
    expect(thermalBrand.length).toBeGreaterThan(0);
    const model = thermalBrand[0];
    expect(
      connectionOptionsForModel(model.key)
        .map(item => item.key)
        .sort(),
    ).toEqual([...model.allowedConnectionMethodKeys].sort());
    expect(paperOptionsForModel(model.key).map(item => item.key)).toEqual(model.paperSpecKeys);
    expect(newTerminalPrinter().modelKey).toBe('');
    expect(newTerminalFunction('ORDERING_CASHIER').scenes[scenesForFunction('ORDERING_CASHIER')[0].key].selected).toBe(
      false,
    );
  });

  it('keeps printer model and connection candidates mutually constrained', () => {
    const builtinModels = modelOptionsForBrandAndConnection('GENERIC', 'BUILT_IN');
    expect(builtinModels.map(item => item.key)).toEqual(['BUILTIN_THERMAL_58', 'BUILTIN_THERMAL_80']);
    expect(
      connectionOptionsForBrand('EPSON')
        .map(item => item.key)
        .sort(),
    ).toEqual(['BLUETOOTH', 'NETWORK', 'USB']);
  });

  it('allows repeated kitchen printers but keeps singleton functions bounded', () => {
    const options = addableFunctionsForDeviceType('laptop', [{functionKey: 'KITCHEN_PRINT'}]);
    expect(options.filter(item => item.key === 'KITCHEN_PRINT')).toHaveLength(1);
    expect(
      addableFunctionsForDeviceType('laptop', [{functionKey: 'ORDERING_CASHIER'}]).map(item => item.key),
    ).not.toContain('ORDERING_CASHIER');
  });

  it('selects a newly created ref immediately instead of waiting for the current cursor page', () => {
    const pending = resolveTerminalSelection([{terminalRef: 'old'}], 'old', 'new');
    expect(pending).toEqual({selectedRef: 'new', pendingRef: undefined});
    expect(resolveTerminalSelection([{terminalRef: 'old'}, {terminalRef: 'new'}], 'old', 'new')).toEqual({
      selectedRef: 'new',
      pendingRef: undefined,
    });
    expect(resolveTerminalSelection([{terminalRef: 'old'}], 'new')).toEqual({
      selectedRef: 'new',
      pendingRef: undefined,
    });
  });

  it('clears ranges and scenes when a function instance changes type while preserving its identity', () => {
    const current = newTerminalFunction('KITCHEN_PRINT');
    current.ref = 'function-ref';
    current.selectedRangeKeys = ['PRODUCTION_TAG'];
    current.productionTagRefs = ['tag-ref'];
    current.scenes.PREPARATION_TICKET = {selected: true, orderTypes: ['DINE_IN'], printerKeys: ['printer-ref']};

    const replaced = replaceTerminalFunctionConfiguration(current, 'ORDERING_CASHIER');
    expect(replaced.ref).toBe('function-ref');
    expect(replaced.clientKey).toBe(current.clientKey);
    expect(replaced.functionKey).toBe('ORDERING_CASHIER');
    expect(replaced.selectedRangeKeys).toEqual([]);
    expect(replaced.productionTagRefs).toEqual([]);
    expect(Object.values(replaced.scenes).every(scene => !scene.selected && scene.printerKeys.length === 0)).toBe(true);
  });

  it('preserves same-function scene independence and new child identity in one request', () => {
    const first = newTerminalPrinter();
    const second = {...newTerminalPrinter(), clientKey: 'printer-second'};
    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const scenes = scenesForFunction('ORDERING_CASHIER');
    expect(scenes.length).toBeGreaterThan(1);
    functionForm.scenes[scenes[0].key] = {selected: true, orderTypes: ['DINE_IN'], printerKeys: [first.clientKey]};
    functionForm.scenes[scenes[1].key] = {selected: true, orderTypes: ['DINE_IN'], printerKeys: [second.clientKey]};
    const values: StoreTerminalFormValues = {
      name: '测试终端',
      deviceType: 'laptop',
      activationCode: '',
      printers: [first, second],
      functions: [functionForm],
    };

    const configuration = configurationInput(values);
    expect(configuration.printers).toHaveLength(2);
    expect(configuration.printers.every(printer => 'clientKey' in printer)).toBe(true);
    expect(configuration.functions[0].scenes[0].printers[0]).toEqual({printerClientKey: first.clientKey});
    expect(configuration.functions[0].scenes[1].printers[0]).toEqual({printerClientKey: second.clientKey});
    expect(configuration.functions[0].scenes[0].printers).not.toEqual(configuration.functions[0].scenes[1].printers);
  });

  it('clears only a scene draft when that scene is unchecked', () => {
    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const [first, second] = scenesForFunction('ORDERING_CASHIER');
    functionForm.scenes[first.key] = {selected: true, orderTypes: ['DINE_IN'], printerKeys: ['printer-a']};
    functionForm.scenes[second.key] = {selected: true, orderTypes: ['TAKEOUT'], printerKeys: ['printer-b']};

    const cleared = clearTerminalSceneConfiguration(functionForm, first.key);
    expect(cleared.scenes[first.key]).toEqual({selected: false, orderTypes: [], printerKeys: []});
    expect(cleared.scenes[second.key]).toEqual(functionForm.scenes[second.key]);
    expect(cleared.clientKey).toBe(functionForm.clientKey);
  });

  it('serializes only explicitly selected scenes and preserves stable detail identities', () => {
    const terminal = {
      terminalRef: '11111111-1111-4111-8111-111111111111',
      storeRef: '22222222-2222-4222-8222-222222222222',
      name: '终端',
      deviceType: 'laptop',
      status: 'ENABLED',
      version: 1,
      createdAt: 1,
      updatedAt: 2,
      activationCode: '01234567',
      areaReferences: [],
      tagReferences: [],
      configuration: {
        printers: [],
        functions: [
          {
            ref: '33333333-3333-4333-8333-333333333333',
            functionKey: 'ORDERING_CASHIER',
            ranges: [],
            scenes: [{sceneKey: 'TABLE_ORDER_TICKET', orderTypes: ['DINE_IN'], printers: []}],
          },
        ],
      },
    } as never;
    const values = terminalFormValuesFromDetail(terminal);
    expect(values.functions[0].clientKey).toBe('function-existing-33333333-3333-4333-8333-333333333333');
    expect(values.functions[0].scenes.TABLE_ORDER_TICKET.selected).toBe(true);
    expect(values.functions[0].scenes.PRECHECK_TICKET.selected).toBe(false);
    const unselected = {
      ...values,
      functions: [
        {
          ...values.functions[0],
          scenes: {
            ...values.functions[0].scenes,
            TABLE_ORDER_TICKET: {selected: false, orderTypes: ['DINE_IN'], printerKeys: []},
          },
        },
      ],
    };
    expect(configurationInput(unselected).functions[0].scenes).toHaveLength(0);
  });
});
