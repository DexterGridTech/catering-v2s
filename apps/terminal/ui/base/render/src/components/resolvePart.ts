import {createElement, type ReactNode} from 'react'
import {Text} from 'react-native'
import type {
  ContainerKey,
  DisplayMode,
  UiCatalogContext,
  UiCatalog,
} from '@catering-v2s/kernel-base-ui-state'
import {isUiCatalogEntryAvailable} from '@catering-v2s/kernel-base-ui-state'
import type {RendererCatalog} from '../types/catalog'
import type {RenderPartDiagnosticReporter} from '../foundations/diagnostics'
import type {
  ContentFailureReason,
  RenderFailure,
  SystemFailureReason,
  TransitionFailureReason,
} from '../types/props'

type RenderFailureReason = ContentFailureReason | SystemFailureReason | TransitionFailureReason
type ContentRenderFailure = Extract<RenderFailure, {readonly category: 'content'}>
type SystemRenderFailure = Extract<RenderFailure, {readonly category: 'system'}>
type ContentRenderFailureFor<Reason extends ContentFailureReason> = Omit<ContentRenderFailure, 'reason'> & Readonly<{readonly reason: Reason}>
type SystemRenderFailureFor<Reason extends SystemFailureReason> = Omit<SystemRenderFailure, 'reason'> & Readonly<{readonly reason: Reason}>

const fallbackTestIds: Readonly<Record<RenderFailureReason, string>> = Object.freeze({
  'runtime-not-started': 'ui-base-render:fallback:runtime-not-started',
  'runtime-start-failed': 'ui-base-render:fallback:runtime-start-failed',
  'surface-host-unavailable': 'ui-base-render:fallback:surface-host-unavailable',
  'container-empty': 'ui-base-render:fallback:container-empty',
  'missing-catalog-entry': 'ui-base-render:fallback:missing-catalog-entry',
  'missing-renderer': 'ui-base-render:fallback:missing-renderer',
  'invalid-props': 'ui-base-render:fallback:invalid-props',
  'incompatible-catalog-entry': 'ui-base-render:fallback:incompatible-catalog-entry',
})

const fallbackMessage = (failure: RenderFailure): string => {
  if (failure.category === 'content') {
    const location = failure.partKey === null ? failure.containerKey : `${failure.containerKey}/${failure.partKey}`
    return `页面找不到：${location}（${failure.surfaceForm}）`
  }
  if (failure.category === 'transition') return '终端正在加载'
  return '终端内容暂不可用'
}

export const RenderFallback = ({failure}: Readonly<{readonly failure: RenderFailure}>) => {
  const testID = fallbackTestIds[failure.reason]
  return createElement(Text, {
    testID,
    accessibilityRole: failure.category === 'content' ? 'alert' : undefined,
  }, fallbackMessage(failure))
}

type Placement = Readonly<{
  readonly partKey: string
  readonly props?: unknown
}>

type ResolvePartInput = Readonly<{
  readonly placement: Placement
  readonly displayMode: DisplayMode
  readonly containerKey: ContainerKey | null
  readonly catalogContext: UiCatalogContext
  readonly uiCatalog: UiCatalog
  readonly rendererCatalog: RendererCatalog
  readonly reportPartDiagnostic: RenderPartDiagnosticReporter['report']
  readonly clearPartDiagnostic: RenderPartDiagnosticReporter['clearForPart']
  readonly elementKey?: string
}>

export type PartResolution = Readonly<{
  readonly kind: 'resolved'
  readonly node: ReactNode
}> | Readonly<{
  readonly kind: 'fallback'
  readonly failure: RenderFailure
  readonly node: ReactNode
}>

const createContentFailure = <Reason extends ContentFailureReason>(
  input: ResolvePartInput,
  reason: Reason,
): ContentRenderFailureFor<Reason> => Object.freeze({
  category: 'content' as const,
  reason,
  partKey: input.placement.partKey,
  containerKey: input.containerKey ?? 'layer',
  surfaceForm: input.catalogContext.surfaceForm,
})

const createSystemFailure = <Reason extends SystemFailureReason>(reason: Reason): SystemRenderFailureFor<Reason> => Object.freeze({
  category: 'system' as const,
  reason,
})

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

export const resolvePartWithStatus = (input: ResolvePartInput): PartResolution => {
  const entry = input.uiCatalog.byPartKey[input.placement.partKey]
  if (entry === undefined) {
    const failure = createContentFailure(input, 'missing-catalog-entry')
    input.reportPartDiagnostic({
      event: 'missing-catalog-entry',
      data: {
        category: 'content',
        reason: failure.reason,
        partKey: input.placement.partKey,
        displayMode: input.displayMode,
        containerKey: input.containerKey,
        surfaceForm: input.catalogContext.surfaceForm,
      },
    })
    return {
      kind: 'fallback',
      failure,
      node: createElement(RenderFallback, {failure, key: input.elementKey}),
    }
  }

  if (!isUiCatalogEntryAvailable(entry, input.containerKey, input.catalogContext)) {
    const failure = createContentFailure(input, 'incompatible-catalog-entry')
    input.reportPartDiagnostic({
      event: 'incompatible-catalog-entry',
      data: {
        category: 'content',
        reason: failure.reason,
        partKey: input.placement.partKey,
        displayMode: input.displayMode,
        containerKey: input.containerKey,
        surfaceForm: input.catalogContext.surfaceForm,
      },
    })
    return {
      kind: 'fallback',
      failure,
      node: createElement(RenderFallback, {failure, key: input.elementKey}),
    }
  }

  const binding = input.rendererCatalog.resolve(entry.rendererKey)
  if (binding === undefined) {
    const failure = createSystemFailure('missing-renderer')
    input.reportPartDiagnostic({
      event: 'missing-renderer',
      data: {
        category: 'system',
        reason: failure.reason,
        partKey: input.placement.partKey,
        displayMode: input.displayMode,
        rendererKey: entry.rendererKey,
      },
    })
    return {
      kind: 'fallback',
      failure,
      node: createElement(RenderFallback, {failure, key: input.elementKey}),
    }
  }

  const componentProps = readComponentProps(input.placement)
  if (componentProps.props === undefined) {
    const failure = createContentFailure(input, 'invalid-props')
    input.reportPartDiagnostic({
      event: 'invalid-props-shape',
      data: {
        category: 'content',
        reason: failure.reason,
        partKey: input.placement.partKey,
        displayMode: input.displayMode,
        containerKey: input.containerKey,
        surfaceForm: input.catalogContext.surfaceForm,
        valueType: valueType(componentProps.invalidValue),
      },
    })
    return {
      kind: 'fallback',
      failure,
      node: createElement(RenderFallback, {failure, key: input.elementKey}),
    }
  }

  const props = input.elementKey === undefined
    ? componentProps.props
    : {...componentProps.props, key: input.elementKey}
  input.clearPartDiagnostic(input.placement.partKey, input.displayMode)
  return {kind: 'resolved', node: createElement(binding.component, props)}
}

export const resolvePart = (input: ResolvePartInput): ReactNode => resolvePartWithStatus(input).node
