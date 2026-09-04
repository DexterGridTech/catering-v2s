import {createElement, type ReactNode} from 'react'
import {Text} from 'react-native'
import type {
  DisplayMode,
  UiCatalog,
} from '@catering-v2s/kernel-base-ui-state'
import type {RendererCatalog} from '../types/catalog'
import type {RenderPartDiagnosticReporter} from './diagnostics'

export type RenderFallbackReason =
  | 'runtime-unavailable'
  | 'container-empty'
  | 'missing-catalog-entry'
  | 'missing-renderer'
  | 'invalid-props'

const fallbackTestIds: Readonly<Record<RenderFallbackReason, string>> = Object.freeze({
  'runtime-unavailable': 'ui-base-render:fallback:runtime-unavailable',
  'container-empty': 'ui-base-render:fallback:container-empty',
  'missing-catalog-entry': 'ui-base-render:fallback:missing-catalog-entry',
  'missing-renderer': 'ui-base-render:fallback:missing-renderer',
  'invalid-props': 'ui-base-render:fallback:invalid-props',
})

export const RenderFallback = ({
  reason,
}: Readonly<{readonly reason: RenderFallbackReason}>) => createElement(Text, {
  testID: fallbackTestIds[reason],
})

type Placement = Readonly<{
  readonly partKey: string
  readonly props?: unknown
}>

type ResolvePartInput = Readonly<{
  readonly placement: Placement
  readonly displayMode: DisplayMode
  readonly uiCatalog: UiCatalog
  readonly rendererCatalog: RendererCatalog
  readonly reportPartDiagnostic: RenderPartDiagnosticReporter['report']
  readonly clearPartDiagnostic: RenderPartDiagnosticReporter['clearForPart']
  readonly elementKey?: string
}>

const hasOwn = (value: object, property: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, property)

const isPlainObject = (value: unknown): value is object => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const valueType = (value: unknown): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const readComponentProps = (
  placement: Placement,
): Readonly<{readonly props?: object; readonly invalidValue?: unknown}> => {
  if (!hasOwn(placement, 'props')) return Object.freeze({props: Object.freeze({})})
  const value = Reflect.get(placement, 'props')
  return isPlainObject(value)
    ? Object.freeze({props: value})
    : Object.freeze({invalidValue: value})
}

export const resolvePart = (input: ResolvePartInput): ReactNode => {
  const entry = input.uiCatalog.byPartKey[input.placement.partKey]
  if (entry === undefined) {
    input.reportPartDiagnostic({
      event: 'missing-catalog-entry',
      data: {partKey: input.placement.partKey, displayMode: input.displayMode},
    })
    return createElement(RenderFallback, {reason: 'missing-catalog-entry', key: input.elementKey})
  }

  const binding = input.rendererCatalog.resolve(entry.rendererKey)
  if (binding === undefined) {
    input.reportPartDiagnostic({
      event: 'missing-renderer',
      data: {
        partKey: input.placement.partKey,
        displayMode: input.displayMode,
        rendererKey: entry.rendererKey,
      },
    })
    return createElement(RenderFallback, {reason: 'missing-renderer', key: input.elementKey})
  }

  const componentProps = readComponentProps(input.placement)
  if (componentProps.props === undefined) {
    input.reportPartDiagnostic({
      event: 'invalid-props-shape',
      data: {
        partKey: input.placement.partKey,
        displayMode: input.displayMode,
        valueType: valueType(componentProps.invalidValue),
      },
    })
    return createElement(RenderFallback, {reason: 'invalid-props', key: input.elementKey})
  }

  const props = input.elementKey === undefined
    ? componentProps.props
    : {...componentProps.props, key: input.elementKey}
  input.clearPartDiagnostic(input.placement.partKey, input.displayMode)
  return createElement(binding.component, props)
}
