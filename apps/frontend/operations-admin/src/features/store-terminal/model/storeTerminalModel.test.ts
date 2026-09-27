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
  newTerminalCreateFormValues,
  newTerminalFunction,
  newTerminalPrinter,
  normalizeTerminalFunctionForm,
  paperOptionsForModel,
  resolveFunctionSelection,
  resolveTerminalPrinter,
  scenesForFunction,
  storeTerminalStatusLabels,
  terminalDraftMatchesFormValues,
  terminalFunctionIdentity,
  terminalPrinterIdentity,
  terminalSceneDraftHasInvalidCollections,
  requireTerminalIdentity,
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
    expect(
      nextTerminalRefAfterVoid(before, [{terminalRef: 'terminal-2'}, {terminalRef: 'terminal-3'}], 'terminal-1'),
    ).toBe('terminal-2');
    expect(
      nextTerminalRefAfterVoid(before, [{terminalRef: 'terminal-1'}, {terminalRef: 'terminal-3'}], 'terminal-2'),
    ).toBe('terminal-3');
    expect(
      nextTerminalRefAfterVoid(before, [{terminalRef: 'terminal-1'}, {terminalRef: 'terminal-2'}], 'terminal-3'),
    ).toBe('terminal-2');
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
    expect(terminalFunctionIdentity(undefined)).toBe('');
    expect(terminalPrinterIdentity({ref: 'printer-ref', clientKey: 'printer-draft'})).toBe('printer-ref');
    expect(terminalPrinterIdentity({clientKey: 'printer-draft'})).toBe('printer-draft');
    expect(terminalPrinterIdentity(undefined)).toBe('');
    expect(requireTerminalIdentity('function-ref', 'function')).toBe('function-ref');
    expect(() => requireTerminalIdentity('', 'printer')).toThrow('STORE_TERMINAL_PRINTER_IDENTITY_MISSING');
    const invalid = newTerminalPrinter();
    invalid.clientKey = '';
    expect(() => configurationInput({name: '终端', deviceType: 'laptop', printers: [invalid], functions: []})).toThrow(
      'STORE_TERMINAL_PRINTER_IDENTITY_MISSING',
    );
    const whitespaceIdentity = {...newTerminalPrinter(), clientKey: '   '};
    expect(() =>
      configurationInput({name: '终端', deviceType: 'laptop', printers: [whitespaceIdentity], functions: []}),
    ).toThrow('STORE_TERMINAL_PRINTER_IDENTITY_MISSING');
  });

  it('rejects empty, unknown, and stale scene printer identities instead of serializing them', () => {
    const printer = newTerminalPrinter();
    const existingPrinter = {
      ...printer,
      ref: '11111111-1111-4111-8111-111111111111',
      clientKey: 'printer-existing-client',
    };
    expect(resolveTerminalPrinter(printer.clientKey, [printer])).toBe(printer);
    for (const missing of ['', '   ', undefined, null]) {
      expect(() => resolveTerminalPrinter(missing, [printer])).toThrow('TERMINAL_SCENE_PRINTER_IDENTITY_MISSING');
    }
    expect(() => resolveTerminalPrinter('printer-unknown', [printer])).toThrow(
      'TERMINAL_SCENE_PRINTER_IDENTITY_INVALID',
    );
    expect(() => resolveTerminalPrinter(existingPrinter.clientKey, [existingPrinter])).toThrow(
      'TERMINAL_SCENE_PRINTER_IDENTITY_INVALID',
    );

    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    functionForm.scenes[scene.key] = {selected: true, orderTypes: [], printerKeys: ['printer-unknown']};
    expect(() =>
      configurationInput({
        name: '失效绑定终端',
        deviceType: 'laptop',
        printers: [printer],
        functions: [functionForm],
      }),
    ).toThrow('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');

    for (const missing of ['', '   ', undefined, null]) {
      const missingFunction = newTerminalFunction('ORDERING_CASHIER');
      missingFunction.scenes[scene.key] = {selected: true, orderTypes: [], printerKeys: [missing] as never};
      expect(() =>
        configurationInput({
          name: '缺少场景打印机身份',
          deviceType: 'laptop',
          printers: [printer],
          functions: [missingFunction],
        }),
      ).toThrow('TERMINAL_SCENE_PRINTER_IDENTITY_MISSING');
    }

    const missingPrinterKeys = newTerminalFunction('ORDERING_CASHIER');
    missingPrinterKeys.scenes[scene.key] = {selected: true, orderTypes: []} as never;
    expect(
      configurationInput({
        name: '未配置场景打印机',
        deviceType: 'laptop',
        printers: [printer],
        functions: [missingPrinterKeys],
      }),
    ).toMatchObject({functions: [{scenes: [{sceneKey: scene.key, printers: []}]}]});

    const staleFunction = newTerminalFunction('ORDERING_CASHIER');
    staleFunction.scenes[scene.key] = {
      selected: true,
      orderTypes: [],
      printerKeys: [existingPrinter.clientKey],
    };
    expect(() =>
      configurationInput({
        name: '陈旧场景打印机身份',
        deviceType: 'laptop',
        printers: [existingPrinter],
        functions: [staleFunction],
      }),
    ).toThrow('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');
  });

  it('keeps malformed scene printer keys visible through normalization until strict serialization rejects them', () => {
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    const base = newTerminalFunction('ORDERING_CASHIER');
    const cases = [
      {label: 'null', printerKeys: [null] as never, error: 'TERMINAL_SCENE_PRINTER_IDENTITY_MISSING'},
      {label: 'undefined', printerKeys: [undefined] as never, error: 'TERMINAL_SCENE_PRINTER_IDENTITY_MISSING'},
      {label: 'empty', printerKeys: [''] as never, error: 'TERMINAL_SCENE_PRINTER_IDENTITY_MISSING'},
      {label: 'whitespace', printerKeys: ['   '] as never, error: 'TERMINAL_SCENE_PRINTER_IDENTITY_MISSING'},
      {label: 'unknown', printerKeys: ['printer-unknown'], error: 'TERMINAL_SCENE_PRINTER_IDENTITY_INVALID'},
    ];
    for (const testCase of cases) {
      const functionForm = {
        ...base,
        scenes: {...base.scenes, [scene.key]: {selected: true, orderTypes: [], printerKeys: testCase.printerKeys}},
      };
      const normalized = normalizeTerminalFunctionForm(functionForm);
      expect(normalized?.scenes[scene.key].printerKeys, testCase.label).toEqual(testCase.printerKeys);
      expect(() =>
        configurationInput({
          name: `非法${testCase.label}场景绑定`,
          deviceType: 'laptop',
          printers: [],
          functions: [functionForm],
        }),
      ).toThrow(testCase.error);
    }

    const emptySelection = {
      ...base,
      scenes: {...base.scenes, [scene.key]: {selected: true, orderTypes: [], printerKeys: []}},
    };
    expect(normalizeTerminalFunctionForm(emptySelection)?.scenes[scene.key].printerKeys).toEqual([]);
    expect(
      configurationInput({name: '空打印机场景', deviceType: 'laptop', printers: [], functions: [emptySelection]}),
    ).toMatchObject({functions: [{scenes: [{sceneKey: scene.key, printers: []}]}]});

    const nonArray = {
      ...base,
      scenes: {...base.scenes, [scene.key]: {selected: true, orderTypes: [], printerKeys: 'printer-unknown'}},
    } as never;
    expect(() =>
      configurationInput({name: '非数组场景绑定', deviceType: 'laptop', printers: [], functions: [nonArray]}),
    ).toThrow('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');
  });

  it('keeps malformed order types visible through normalization until strict serialization rejects them', () => {
    const [scene] = scenesForFunction('KITCHEN_PRINT');
    const base = newTerminalFunction('KITCHEN_PRINT');
    const functionForm = {
      ...base,
      scenes: {...base.scenes, [scene.key]: {selected: true, orderTypes: ['UNKNOWN_ORDER_TYPE'], printerKeys: []}},
    };

    expect(normalizeTerminalFunctionForm(functionForm)?.scenes[scene.key].orderTypes).toEqual(['UNKNOWN_ORDER_TYPE']);
    expect(() =>
      configurationInput({name: '非法订单类型', deviceType: 'countertop', printers: [], functions: [functionForm]}),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');
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
    expect(addableFunctionsForDeviceType('laptop')).toEqual(
      STORE_TERMINAL_FUNCTIONS.filter(item => item.supportedDeviceTypeKeys.includes('laptop')),
    );
    expect(addableFunctionsForDeviceType('laptop', {} as never)).toEqual(
      STORE_TERMINAL_FUNCTIONS.filter(item => item.supportedDeviceTypeKeys.includes('laptop')),
    );
    const options = addableFunctionsForDeviceType('laptop', [{functionKey: 'KITCHEN_PRINT'}]);
    expect(options.filter(item => item.key === 'KITCHEN_PRINT')).toHaveLength(1);
    expect(addableFunctionsForDeviceType('laptop', [{functionKey: 'KITCHEN_PRINT'}, undefined] as never)).toEqual(
      options,
    );
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

  it('allows a selected scene whose printer collection is omitted before building the wire request', () => {
    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    functionForm.selectedRangeKeys = ['TABLE_AREA'];
    functionForm.tableAreaAll = true;
    functionForm.scenes[scene.key] = {selected: true} as never;

    expect(
      configurationInput({
        name: '稀疏表单终端',
        deviceType: 'laptop',
        activationCode: '',
        printers: [],
        functions: [functionForm],
      }),
    ).toMatchObject({functions: [{scenes: [{sceneKey: scene.key, printers: []}]}]});
  });

  it('normalizes sparse values in the readback comparison path too', () => {
    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    functionForm.scenes[scene.key] = {selected: true} as never;
    const terminal = {
      terminalRef: '11111111-1111-4111-8111-111111111111',
      storeRef: '22222222-2222-4222-8222-222222222222',
      name: '稀疏比较终端',
      deviceType: 'laptop',
      status: 'ENABLED',
      version: 1,
      createdAt: 1,
      updatedAt: 2,
      activationCode: '01234567',
      areaReferences: [],
      tagReferences: [],
      configuration: {printers: [], functions: []},
    } as never;
    expect(
      terminalDraftMatchesFormValues(terminal, {
        name: '稀疏比较终端',
        printers: [],
        functions: [functionForm],
      }),
    ).toBe(false);
  });

  it('rejects transient undefined list entries and invalid collection values before serializing', () => {
    const printer = newTerminalPrinter();
    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    functionForm.selectedRangeKeys = ['TABLE_AREA'];
    functionForm.tableAreaAll = true;
    functionForm.scenes[scene.key] = {
      selected: true,
      orderTypes: ['DINE_IN'],
      printerKeys: [printer.clientKey],
    };

    const values = {
      name: '边界终端',
      deviceType: 'laptop',
      activationCode: '',
      printers: [undefined, {...printer, name: undefined}] as never,
      functions: [undefined, functionForm] as never,
    } as StoreTerminalFormValues;

    expect(() => configurationInput(values)).toThrow('STORE_TERMINAL_PRINTER_INPUT_INVALID');
    const withoutMissingPrinter = {
      ...values,
      printers: [{...printer, name: undefined}] as never,
      functions: [{...functionForm, selectedRangeKeys: ['TABLE_AREA', undefined]} as never],
    };
    expect(() => configurationInput(withoutMissingPrinter)).toThrow('STORE_TERMINAL_RULE_INVALID');
    const withoutMissingFunction = {
      ...values,
      printers: [{...printer, name: undefined}],
      functions: [undefined, functionForm],
    } as never;
    expect(() => configurationInput(withoutMissingFunction)).toThrow('STORE_TERMINAL_FUNCTION_INPUT_INVALID');

    expect(
      terminalDraftMatchesFormValues(
        {
          terminalRef: '11111111-1111-4111-8111-111111111111',
          storeRef: '22222222-2222-4222-8222-222222222222',
          name: '边界终端',
          deviceType: 'laptop',
          status: 'ENABLED',
          version: 1,
          createdAt: 1,
          updatedAt: 2,
          activationCode: '01234567',
          areaReferences: [],
          tagReferences: [],
          configuration: {printers: [], functions: []},
        } as never,
        values,
      ),
    ).toBe(false);
  });

  it('rejects missing function identity data and invalid empty range/order values', () => {
    const incompleteFunction = newTerminalFunction('ORDERING_CASHIER');
    incompleteFunction.functionKey = undefined as never;
    expect(() =>
      configurationInput({
        name: '缺少功能类型',
        deviceType: 'laptop',
        activationCode: '',
        printers: [],
        functions: [incompleteFunction],
      }),
    ).toThrow('STORE_TERMINAL_FUNCTION_KEY_MISSING');

    const functionForm = newTerminalFunction('ORDERING_CASHIER');
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    functionForm.selectedRangeKeys = ['', 'TABLE_AREA'] as never;
    functionForm.tableAreaAll = true;
    functionForm.scenes[scene.key] = {
      selected: true,
      orderTypes: ['', 'DINE_IN'] as never,
      printerKeys: ['printer-client'],
    };
    expect(() =>
      configurationInput({
        name: '过滤空值',
        deviceType: 'laptop',
        activationCode: '',
        printers: [{...newTerminalPrinter(), clientKey: 'printer-client'}],
        functions: [functionForm],
      }),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');
  });

  it('rejects unknown or function-incompatible ranges and unknown order types before wire serialization', () => {
    const functionForm = newTerminalFunction('KITCHEN_PRINT');
    functionForm.selectedRangeKeys = ['TABLE_AREA'];
    expect(() =>
      configurationInput({
        name: '不适用范围',
        deviceType: 'countertop',
        printers: [],
        functions: [functionForm],
      }),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');

    const unknownRangeFunction = newTerminalFunction('KITCHEN_PRINT');
    unknownRangeFunction.selectedRangeKeys = ['NOT_A_RANGE'];
    expect(() =>
      configurationInput({
        name: '未知范围',
        deviceType: 'countertop',
        printers: [],
        functions: [unknownRangeFunction],
      }),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');

    const unknownOrderFunction = newTerminalFunction('KITCHEN_PRINT');
    const [scene] = scenesForFunction('KITCHEN_PRINT');
    unknownOrderFunction.scenes[scene.key] = {
      selected: true,
      orderTypes: ['NOT_AN_ORDER_TYPE'],
      printerKeys: [],
    };
    expect(() =>
      configurationInput({
        name: '未知订单类型',
        deviceType: 'countertop',
        printers: [],
        functions: [unknownOrderFunction],
      }),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');

    const unknownSceneFunction = newTerminalFunction('KITCHEN_PRINT');
    unknownSceneFunction.scenes.NOT_A_SCENE = {selected: true, orderTypes: [], printerKeys: []};
    expect(() =>
      configurationInput({
        name: '未知场景',
        deviceType: 'countertop',
        printers: [],
        functions: [unknownSceneFunction],
      }),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');
  });

  it('rejects duplicate top-level identities and duplicate scene order types', () => {
    const printer = newTerminalPrinter();
    const duplicatePrinter = {...printer, name: '重复打印机'};
    expect(() =>
      configurationInput({name: '终端', deviceType: 'laptop', printers: [printer, duplicatePrinter], functions: []}),
    ).toThrow('STORE_TERMINAL_PRINTER_IDENTITY_DUPLICATE');

    const firstFunction = newTerminalFunction('ORDERING_CASHIER');
    const secondFunction = {...newTerminalFunction('ORDERING_CASHIER'), clientKey: firstFunction.clientKey};
    expect(() =>
      configurationInput({
        name: '终端',
        deviceType: 'laptop',
        printers: [],
        functions: [firstFunction, secondFunction],
      }),
    ).toThrow('STORE_TERMINAL_FUNCTION_IDENTITY_DUPLICATE');

    const functionWithDuplicateOrders = newTerminalFunction('ORDERING_CASHIER');
    const [scene] = scenesForFunction('ORDERING_CASHIER');
    functionWithDuplicateOrders.scenes[scene.key] = {
      selected: true,
      orderTypes: ['DINE_IN', 'DINE_IN'],
      printerKeys: [],
    };
    expect(() =>
      configurationInput({name: '终端', deviceType: 'laptop', printers: [], functions: [functionWithDuplicateOrders]}),
    ).toThrow('STORE_TERMINAL_RULE_INVALID');
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
    expect(values).not.toHaveProperty('deviceType');
    expect(values).not.toHaveProperty('activationCode');
    expect(newTerminalCreateFormValues()).toMatchObject({deviceType: '', activationCode: ''});
    expect(terminalDraftMatchesFormValues(terminal, values)).toBe(true);
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

  it('fails closed for malformed readback drafts instead of throwing', () => {
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
      configuration: {printers: [], functions: []},
    } as never;
    expect(
      terminalDraftMatchesFormValues(terminal, {
        name: undefined,
        printers: [],
        functions: [],
      } as never),
    ).toBe(false);
    expect(
      terminalDraftMatchesFormValues(terminal, {
        name: '终端',
        printers: undefined,
        functions: [],
      } as never),
    ).toBe(false);
    const malformedTerminal = Object.assign({}, terminal as object, {configuration: {printers: null, functions: []}});
    expect(
      terminalDraftMatchesFormValues(malformedTerminal as never, {
        name: '终端',
        printers: [],
        functions: [],
      }),
    ).toBe(false);
  });

  it('does not classify malformed scene collections as empty during stale cleanup', () => {
    expect(terminalSceneDraftHasInvalidCollections({orderTypes: null, printerKeys: []})).toBe(true);
    expect(terminalSceneDraftHasInvalidCollections({orderTypes: [''], printerKeys: []})).toBe(true);
    expect(terminalSceneDraftHasInvalidCollections({orderTypes: [], printerKeys: 'invalid'})).toBe(true);
    expect(terminalSceneDraftHasInvalidCollections({orderTypes: [], printerKeys: []})).toBe(false);
    expect(terminalSceneDraftHasInvalidCollections({orderTypes: undefined, printerKeys: undefined})).toBe(false);
    expect(
      terminalSceneDraftHasInvalidCollections(
        {orderTypes: ['UNKNOWN'], printerKeys: ['printer-1']},
        ['DINE_IN'],
        ['printer-1'],
      ),
    ).toBe(true);
    expect(
      terminalSceneDraftHasInvalidCollections({orderTypes: ['DINE_IN', 'DINE_IN'], printerKeys: []}, ['DINE_IN'], []),
    ).toBe(true);
    expect(
      terminalSceneDraftHasInvalidCollections(
        {orderTypes: ['DINE_IN'], printerKeys: ['printer-unknown']},
        ['DINE_IN'],
        ['printer-1'],
      ),
    ).toBe(true);
  });
});
