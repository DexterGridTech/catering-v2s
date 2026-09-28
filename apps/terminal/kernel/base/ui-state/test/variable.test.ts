import {describe, expect, it} from 'vitest';
import {createModuleUiVariableFactory, createUiVariableWrite, type UiVariableDeclaration} from '../src/index';

describe('ui-state variable declarations', () => {
  it('generates module-owned keys and keeps the default at declaration time', () => {
    const first = createModuleUiVariableFactory('sales');
    const second = createModuleUiVariableFactory('checkout');
    const firstDeclaration = first.define('order-no', {
      defaultValue: '',
      persistIntent: 'owner-only',
    });
    const secondDeclaration = second.define('order-no', {
      defaultValue: 0,
      persistIntent: 'never',
    });

    expect(firstDeclaration).toMatchObject({
      key: 'sales.order-no',
      moduleName: 'sales',
      defaultValue: '',
      persistIntent: 'owner-only',
    });
    expect(secondDeclaration.key).toBe('checkout.order-no');
    expect(firstDeclaration).not.toBe(secondDeclaration);
    expect(Object.isFrozen(firstDeclaration)).toBe(true);

    const write = createUiVariableWrite(firstDeclaration, 'A-100');
    expect(write).toEqual({key: 'sales.order-no', value: 'A-100'});
    expect(Object.isFrozen(write)).toBe(true);
  });

  it('rejects non-JSON defaults and write values at runtime', () => {
    const factory = createModuleUiVariableFactory('sales');
    expect(() =>
      factory.define('bad', {
        defaultValue: (() => null) as never,
        persistIntent: 'never',
      }),
    ).toThrow(/JSON/);

    const declaration: UiVariableDeclaration<string> = factory.define('order-no', {
      defaultValue: '',
      persistIntent: 'never',
    });
    expect(() => createUiVariableWrite(declaration, (() => null) as never)).toThrow(/JSON/);
  });
});
