import {describe, expect, it} from 'vitest';
import {createUiCatalog, selectAvailableParts, type UiCatalogEntry} from '../src/index';

const entry = (overrides: Partial<UiCatalogEntry> = {}): UiCatalogEntry => ({
  partKey: 'orders',
  rendererKey: 'orders-screen',
  containerKeys: ['root'],
  displayModes: ['PRIMARY'],
  workspaces: ['MAIN'],
  instanceModes: ['MASTER'],
  surfaceForm: ['laptop', 'mobile'],
  title: 'Orders',
  description: 'Orders screen',
  ...overrides,
});

describe('ui-state catalog', () => {
  it('builds an immutable canonical catalog and filters only during enumeration', () => {
    const catalog = createUiCatalog([
      entry(),
      entry({
        partKey: 'payment',
        rendererKey: 'payment-screen',
        displayModes: ['SECONDARY'],
        instanceModes: ['SLAVE'],
      }),
    ]);

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.entries)).toBe(true);
    expect(Object.isFrozen(catalog.entries[0])).toBe(true);
    expect(Object.isFrozen(catalog.entries[0].containerKeys)).toBe(true);
    expect(Object.isFrozen(catalog.entries[0].displayModes)).toBe(true);
    expect(Reflect.ownKeys(catalog.entries[0]).sort()).toEqual([
      'containerKeys',
      'description',
      'displayModes',
      'instanceModes',
      'partKey',
      'rendererKey',
      'surfaceForm',
      'title',
      'workspaces',
    ]);
    expect(Object.prototype.hasOwnProperty.call(catalog, 'register')).toBe(false);
    expect(
      selectAvailableParts(catalog, 'root', {
        displayMode: 'SECONDARY',
        workspace: 'MAIN',
        instanceMode: 'SLAVE',
        surfaceForm: 'laptop',
      }).map(candidate => candidate.partKey),
    ).toEqual(['payment']);
  });

  it('rejects duplicate part keys instead of overwriting the index', () => {
    expect(() => createUiCatalog([entry(), entry()])).toThrow(/duplicate partKey/);
  });

  it('rejects React-like and non-enumerable additions at construction', () => {
    const withComponent = entry() as UiCatalogEntry & {component: () => null};
    withComponent.component = () => null;
    expect(() => createUiCatalog([withComponent])).toThrow(/own keys/);

    const withHidden = entry();
    Object.defineProperty(withHidden, 'hidden', {value: true, enumerable: false});
    expect(() => createUiCatalog([withHidden])).toThrow(/own keys/);
  });

  it('allows a layer-only entry but excludes it from every container enumeration', () => {
    const catalog = createUiCatalog([entry({partKey: 'layer-only', containerKeys: []})]);

    expect(catalog.entries[0].containerKeys).toEqual([]);
    expect(
      selectAvailableParts(catalog, 'root', {
        displayMode: 'PRIMARY',
        workspace: 'MAIN',
        instanceMode: 'MASTER',
        surfaceForm: 'laptop',
      }),
    ).toEqual([]);
    expect(
      selectAvailableParts(catalog, 'overlay', {
        displayMode: 'PRIMARY',
        workspace: 'MAIN',
        instanceMode: 'MASTER',
        surfaceForm: 'laptop',
      }),
    ).toEqual([]);
  });

  it('keeps only containerKeys allowed to be empty', () => {
    expect(() => createUiCatalog([entry({containerKeys: []})])).not.toThrow();
    expect(() => createUiCatalog([entry({displayModes: []})])).toThrow(/array/);
    expect(() => createUiCatalog([entry({workspaces: []})])).toThrow(/array/);
    expect(() => createUiCatalog([entry({instanceModes: []})])).toThrow(/array/);
  });

  it('matches any declared container key during enumeration', () => {
    const catalog = createUiCatalog([entry({containerKeys: ['root', 'sidebar']})]);

    expect(
      selectAvailableParts(catalog, 'sidebar', {
        displayMode: 'PRIMARY',
        workspace: 'MAIN',
        instanceMode: 'MASTER',
        surfaceForm: 'laptop',
      }).map(candidate => candidate.partKey),
    ).toEqual(['orders']);
  });

  it('rejects missing, invalid, and duplicate container key entries', () => {
    const missing = {...entry()};
    expect(Reflect.deleteProperty(missing, 'containerKeys')).toBe(true);
    expect(() => createUiCatalog([missing as UiCatalogEntry])).toThrow(/approved field set/);

    expect(() => createUiCatalog([entry({containerKeys: null as unknown as readonly string[]})])).toThrow(/array/);
    expect(() => createUiCatalog([entry({containerKeys: ['']})])).toThrow(/invalid value/);
    expect(() => createUiCatalog([entry({containerKeys: ['root', 'root']})])).toThrow(/duplicate value/);
  });
});
