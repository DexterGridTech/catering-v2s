import {describe, expect, it} from 'vitest'
import {
  createUiCatalog,
  selectAvailableParts,
  type UiCatalogEntry,
} from '../src/index'

const entry = (overrides: Partial<UiCatalogEntry> = {}): UiCatalogEntry => ({
  partKey: 'orders',
  rendererKey: 'orders-screen',
  containerKey: 'root',
  displayModes: ['PRIMARY'],
  workspaces: ['MAIN'],
  instanceModes: ['MASTER'],
  title: 'Orders',
  description: 'Orders screen',
  ...overrides,
})

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
    ])

    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.entries)).toBe(true)
    expect(Object.isFrozen(catalog.entries[0])).toBe(true)
    expect(Object.isFrozen(catalog.entries[0].displayModes)).toBe(true)
    expect(Reflect.ownKeys(catalog.entries[0]).sort()).toEqual([
      'containerKey',
      'description',
      'displayModes',
      'instanceModes',
      'partKey',
      'rendererKey',
      'title',
      'workspaces',
    ])
    expect(Object.prototype.hasOwnProperty.call(catalog, 'register')).toBe(false)
    expect(selectAvailableParts(catalog, 'root', {
      displayMode: 'SECONDARY',
      workspace: 'MAIN',
      instanceMode: 'SLAVE',
    }).map(candidate => candidate.partKey)).toEqual(['payment'])
  })

  it('rejects duplicate part keys instead of overwriting the index', () => {
    expect(() => createUiCatalog([entry(), entry()])).toThrow(/duplicate partKey/)
  })

  it('rejects React-like and non-enumerable additions at construction', () => {
    const withComponent = entry() as UiCatalogEntry & {component: () => null}
    withComponent.component = () => null
    expect(() => createUiCatalog([withComponent])).toThrow(/own keys/)

    const withHidden = entry()
    Object.defineProperty(withHidden, 'hidden', {value: true, enumerable: false})
    expect(() => createUiCatalog([withHidden])).toThrow(/own keys/)
  })
})
