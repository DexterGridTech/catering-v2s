import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  createAppError,
  createCommandId,
  createConnectionId,
  createDispatchId,
  createEnvelopeId,
  createModuleErrorFactory,
  createModuleParameterFactory,
  createNodeId,
  createProjectionId,
  createRequestId,
  createRuntimeId,
  createRuntimeInstanceId,
  createSessionId,
  isAppError,
  listDefinitions,
  renderErrorTemplate,
  runtimeIdPrefixes,
  type AppError,
  type ErrorDefinition,
  type RuntimeIdKind,
} from '@catering-v2s/kernel-base-contracts';

afterEach(() => {
  vi.useRealTimers();
});

describe('T-1, T-2 and T-9: runtime IDs', () => {
  const factories = {
    runtime: createRuntimeInstanceId,
    request: createRequestId,
    command: createCommandId,
    session: createSessionId,
    node: createNodeId,
    connection: createConnectionId,
    envelope: createEnvelopeId,
    dispatch: createDispatchId,
    projection: createProjectionId,
  } satisfies Record<RuntimeIdKind, () => string>;

  it('uses one distinct declared prefix for every runtime ID kind', () => {
    expect(Object.keys(runtimeIdPrefixes).sort()).toEqual(Object.keys(factories).sort());
    expect(new Set(Object.values(runtimeIdPrefixes)).size).toBe(9);

    for (const [kind, factory] of Object.entries(factories) as [RuntimeIdKind, () => string][]) {
      expect(factory()).toMatch(new RegExp(`^${runtimeIdPrefixes[kind]}_`));
      expect(createRuntimeId(kind)).toMatch(new RegExp(`^${runtimeIdPrefixes[kind]}_`));
    }
  });

  it('creates 32 unique IDs of one kind without losing its prefix', () => {
    const requestIds = Array.from({length: 32}, () => createRequestId());

    expect(new Set(requestIds).size).toBe(32);
    expect(requestIds.every((id) => id.startsWith('req_'))).toBe(true);
  });
});

describe('T-3: error templates', () => {
  it('renders every supplied placeholder and reports no missing key', () => {
    expect(renderErrorTemplate('item ${itemId} costs ${price}', {itemId: 'A-1', price: 12})).toEqual({
      message: 'item A-1 costs 12',
      missingKeys: [],
    });
  });

  it('preserves an identifiable placeholder and reports its key when an argument is missing', () => {
    expect(renderErrorTemplate('item ${itemId} costs ${price}', {itemId: 'A-1'})).toEqual({
      message: 'item A-1 costs ${price}',
      missingKeys: ['price'],
    });
  });
});

describe('T-4: AppError structural guard', () => {
  const validError: AppError = {
    name: 'ItemMissing',
    message: 'item A-1 is missing',
    key: 'catalog.item-missing',
    code: 'ITEM_MISSING',
    category: 'BUSINESS',
    severity: 'MEDIUM',
    createdAt: 1_735_689_600_000,
    templateMissingKeys: [],
  };

  it('accepts a complete AppError', () => {
    expect(isAppError(validError)).toBe(true);
  });

  it.each(['name', 'message', 'key', 'code', 'category', 'severity', 'createdAt', 'templateMissingKeys'] as const)(
    'rejects an AppError missing required field %s',
    (field) => {
      const candidate = {...validError};
      Reflect.deleteProperty(candidate, field);
      expect(isAppError(candidate)).toBe(false);
    },
  );
});

describe('T-5: module definition factories', () => {
  it('derives error keys from module and local key and separates equal local keys across modules', () => {
    const input = {
      name: 'Missing',
      defaultTemplate: 'missing',
      category: 'BUSINESS',
      severity: 'MEDIUM',
    } as const;
    const catalogError = createModuleErrorFactory('catalog')('missing', input);
    const orderError = createModuleErrorFactory('order')('missing', input);

    expect(catalogError.key).toBe('catalog.missing');
    expect(orderError.key).toBe('order.missing');
    expect(catalogError.key).not.toBe(orderError.key);
  });

  it('derives parameter keys from module and local key and separates equal local keys across modules', () => {
    const catalogParameter = createModuleParameterFactory('catalog').string('locale', {
      name: 'Locale',
      defaultValue: 'en-US',
    });
    const orderParameter = createModuleParameterFactory('order').string('locale', {
      name: 'Locale',
      defaultValue: 'en-US',
    });

    expect(catalogParameter.key).toBe('catalog.locale');
    expect(orderParameter.key).toBe('order.locale');
    expect(catalogParameter.key).not.toBe(orderParameter.key);
  });
});

describe('T-7: deterministic foundations', () => {
  it('returns deeply equal values for equal inputs on every pure foundation', () => {
    const definitionInput = {
      name: 'Missing',
      defaultTemplate: '${itemId}',
      category: 'BUSINESS',
      severity: 'LOW',
    } as const;
    const parameterInput = {name: 'Enabled', defaultValue: true} as const;
    const definitions = {
      first: {key: 'first', value: 1},
      second: {key: 'second', value: 2},
    } as const;
    const completeError: AppError = {
      name: 'Missing',
      message: 'A-1',
      key: 'catalog.missing',
      code: 'catalog.missing',
      category: 'BUSINESS',
      severity: 'LOW',
      createdAt: 1,
      templateMissingKeys: [],
    };

    expect(renderErrorTemplate('${itemId}', {itemId: 'A-1'})).toEqual(
      renderErrorTemplate('${itemId}', {itemId: 'A-1'}),
    );
    expect(createModuleErrorFactory('catalog')('missing', definitionInput)).toEqual(
      createModuleErrorFactory('catalog')('missing', definitionInput),
    );
    expect(createModuleParameterFactory('catalog').boolean('enabled', parameterInput)).toEqual(
      createModuleParameterFactory('catalog').boolean('enabled', parameterInput),
    );
    expect(listDefinitions(definitions)).toEqual(listDefinitions(definitions));
    expect(isAppError(completeError)).toBe(isAppError(completeError));
  });
});

describe('T-8: createAppError time', () => {
  it('uses the exact fake-clock timestamp and carries template diagnostics', () => {
    const fixedTime = 1_735_689_600_123;
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const definition: ErrorDefinition = {
      key: 'catalog.missing',
      name: 'Missing',
      defaultTemplate: 'item ${itemId} costs ${price}',
      category: 'BUSINESS',
      severity: 'MEDIUM',
    };

    const error = createAppError(definition, {args: {itemId: 'A-1'}});

    expect(error.createdAt).toBe(fixedTime);
    expect(error.message).toBe('item A-1 costs ${price}');
    expect(error.templateMissingKeys).toEqual(['price']);
  });
});
