import {describe, expect, it} from 'vitest'
import {createElement, type ComponentType} from 'react'
import {
  createRendererCatalog,
  definePart,
  type RendererCatalog,
} from '../src/index'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {expectTypeOf} from 'vitest'

type PartProps = Readonly<{label: string}>

const Part: ComponentType<PartProps> = props => createElement('render-part', {label: props.label})

type CountProps = Readonly<{count: number}>
const CountPart: ComponentType<CountProps> = props => createElement('render-count-part', {count: props.count})

const partInput = () => ({
  partKey: 'catalog-part',
  rendererKey: 'catalog-renderer',
  containerKeys: ['surface-container'],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  title: 'Catalog part',
  description: 'Catalog part description',
  component: Part,
})

describe('renderer catalog boundaries', () => {
  it('transfers two separate canonical halves to the real catalogs', () => {
    const defined = definePart(partInput())
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])

    expect(Reflect.ownKeys(uiCatalog.entries[0]).sort()).toEqual([
      'containerKeys',
      'description',
      'displayModes',
      'instanceModes',
      'partKey',
      'rendererKey',
      'title',
      'workspaces',
    ])
    expect(Reflect.ownKeys(rendererCatalog.resolve('catalog-renderer') ?? {}).sort()).toEqual([
      'component',
      'layerTier',
      'rendererKey',
    ])
    expect(Object.prototype.hasOwnProperty.call(defined.catalogEntry, 'component')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(defined.catalogEntry, 'layerTier')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(defined.rendererBinding, 'title')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(defined.rendererBinding, 'description')).toBe(false)
    expect(defined.rendererBinding.layerTier).toBe('standard')
  })

  it('rejects duplicate renderer keys and exposes no mutation entry point', () => {
    const defined = definePart(partInput())
    expect(() => createRendererCatalog([defined.rendererBinding, defined.rendererBinding])).toThrow(/duplicate rendererKey/)

    const catalog = createRendererCatalog([defined.rendererBinding])
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(catalog, 'register')).toBe(false)
    expect(Object.isFrozen(catalog.resolve('catalog-renderer'))).toBe(true)
  })

  it('keeps omitted layerTier distinct from an own undefined layerTier', () => {
    const control = definePart(partInput())
    expect(control.rendererBinding.layerTier).toBe('standard')

    const negative = partInput()
    Object.defineProperty(negative, 'layerTier', {
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true,
    })
    expect(Object.prototype.hasOwnProperty.call(negative, 'layerTier')).toBe(true)
    expect(() => definePart(negative)).toThrow(/layerTier/)
  })

  it('R-20 rejects extra catalog fields through the real ui-state validator', () => {
    const defined = definePart(partInput())
    const forged = {...defined.catalogEntry, extraCatalogField: true}
    expect(() => createUiCatalog([forged])).toThrow(/approved field set/)
  })

  it('rejects extra renderer binding fields at the render catalog boundary', () => {
    const defined = definePart(partInput())
    const forged = {...defined.rendererBinding, title: 'renderer metadata is not binding data'}
    expect(() => createRendererCatalog([forged])).toThrow(/renderer binding fields/)
  })

  it('freezes copied declaration arrays at construction', () => {
    const input = partInput()
    const defined = definePart(input)

    expect(defined.catalogEntry.containerKeys).not.toBe(input.containerKeys)
    input.containerKeys.push('another-container')
    expect(defined.catalogEntry.containerKeys).toEqual(['surface-container'])

    expect(defined.catalogEntry.displayModes).not.toBe(input.displayModes)
    expect(defined.catalogEntry.workspaces).not.toBe(input.workspaces)
    expect(defined.catalogEntry.instanceModes).not.toBe(input.instanceModes)
    Reflect.set(input.displayModes, 0, 'SECONDARY')
    Reflect.set(input.workspaces, 0, 'BRANCH')
    Reflect.set(input.instanceModes, 0, 'SLAVE')
    expect(defined.catalogEntry.displayModes).toEqual(['PRIMARY'])
    expect(defined.catalogEntry.workspaces).toEqual(['MAIN'])
    expect(defined.catalogEntry.instanceModes).toEqual(['MASTER'])

    expect(Object.isFrozen(defined.catalogEntry)).toBe(true)
    expect(Object.isFrozen(defined.catalogEntry.containerKeys)).toBe(true)
    expect(Object.isFrozen(defined.catalogEntry.displayModes)).toBe(true)
    expect(Object.isFrozen(defined.catalogEntry.workspaces)).toBe(true)
    expect(Object.isFrozen(defined.catalogEntry.instanceModes)).toBe(true)
  })

  it('retains the named generic boundary for heterogeneous renderer bindings', () => {
    const first = definePart(partInput())
    const second = definePart({
      ...partInput(),
      partKey: 'count-part',
      rendererKey: 'count-renderer',
      component: CountPart,
    })
    const catalog = createRendererCatalog([first.rendererBinding, second.rendererBinding])

    expectTypeOf(catalog).toMatchTypeOf<RendererCatalog>()
    expect(catalog.resolve('count-renderer')?.component).toBeTypeOf('function')
  })

  it('rejects a non-component at the typed catalog boundary', () => {
    expect(() => {
      // @ts-expect-error A renderer binding must use the named React component boundary.
      createRendererCatalog([{rendererKey: 'invalid-renderer', component: 42, layerTier: 'standard'}])
    }).toThrow(/component/)
  })
})
