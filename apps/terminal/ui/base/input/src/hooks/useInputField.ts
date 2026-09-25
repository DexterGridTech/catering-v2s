import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {
  applyKeyboardKey,
  normalizeSelection,
  type EditResult,
  type EditState,
  type KeyboardKey,
} from '../foundations/editText'
import type {InputRegistrationToken} from '../foundations/snapshot'
import {useInputController, useInputKeyboardState, useInputScrollAncestor} from '../contexts/context'
import {useInputSurfaceGeometry} from '../contexts/InputSurfaceGeometryContext'
import type {InputFieldOptions, InputFieldResult, InputVisibleAnchorHandle} from '../types/types'
import type {PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives'
import {BUSINESS_FOCUS_SCOPE_ID} from '../foundations/focusScope'
import type {LayoutRect} from '../foundations/scrollIntoView'

type InputPressEvent = Readonly<{
  readonly stopPropagation: () => void
}>

type FocusRectMeasurement = readonly [number, number, number, number]

type FocusRectPresentationInput = Readonly<{
  readonly fieldId: string
  readonly rect: LayoutRect
}>

const focusRectOf = (measurement: FocusRectMeasurement): Readonly<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}> | null => {
  const [x, y, width, height] = measurement
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return {x, y, width, height}
}

export const useInputField = (options: InputFieldOptions): InputFieldResult => {
  const controller = useInputController()
  const keyboardState = useInputKeyboardState()
  const scrollAncestor = useInputScrollAncestor()
  const geometry = useInputSurfaceGeometry()
  const presentFocusRect = useCallback((input: FocusRectPresentationInput): number => {
    return geometry?.presentFocusRect(input.fieldId, input.rect) ?? 0
  }, [geometry?.presentFocusRect])
  const initialValue = options.initialValue ?? ''
  const initialSelection = normalizeSelection(initialValue, options.initialSelection ?? {
    start: initialValue.length,
    end: initialValue.length,
  })
  const [editState, setEditState] = useState<EditState>(() => ({
    value: initialValue,
    selection: initialSelection,
    shift: false,
  }))
  const editStateRef = useRef(editState)
  editStateRef.current = editState
  const nativeInputRef = useRef<PrimitiveInputHandle | null>(null)
  const visibleAnchorRef = useRef<InputVisibleAnchorHandle | null>(null)
  const inputRef = options.nativeLess ? null : nativeInputRef
  const tokenRef = useRef<InputRegistrationToken | null>(null)

  const applyKey = useCallback((key: KeyboardKey): EditResult => {
    const result = applyKeyboardKey(editStateRef.current, key, options.maxLength)
    editStateRef.current = result.state
    setEditState(result.state)
    const token = tokenRef.current
    if (token !== null) {
      controller.updateValue(token, result.state.value)
      controller.updateSelection(token, result.state.selection)
    }
    return result
  }, [controller, options.maxLength])
  const applyKeyRef = useRef(applyKey)
  applyKeyRef.current = applyKey
  const applyKeyProxy = useCallback((key: KeyboardKey): EditResult => applyKeyRef.current(key), [])
  const getEditState = useCallback((): EditState => editStateRef.current, [])
  const clearShift = useCallback((): void => {
    if (!editStateRef.current.shift) return
    const next = {...editStateRef.current, shift: false}
    editStateRef.current = next
    setEditState(next)
  }, [])

  useLayoutEffect(() => {
    const token = controller.registerField({
      fieldId: options.fieldId,
      testID: options.testID,
      value: editStateRef.current.value,
      selection: editStateRef.current.selection,
      keyboardKind: options.keyboardKind,
      layout: options.layout ?? 'full',
      maxLength: options.maxLength,
      focusScopeId: options.focusScopeId ?? BUSINESS_FOCUS_SCOPE_ID,
      inputRef,
      visibleAnchorRef,
      applyKey: applyKeyProxy,
      getEditState,
      clearShift,
    })
    tokenRef.current = token
    return () => {
      controller.unregisterField(token)
      if (tokenRef.current === token) tokenRef.current = null
    }
  }, [applyKeyProxy, clearShift, controller, getEditState, inputRef, options.fieldId, options.focusScopeId, options.keyboardKind, options.layout, options.maxLength])

  useLayoutEffect(() => {
    const token = tokenRef.current
    if (token === null) return
    controller.updateFieldConfig(token, {
      keyboardKind: options.keyboardKind,
      layout: options.layout ?? 'full',
      maxLength: options.maxLength,
      focusScopeId: options.focusScopeId ?? BUSINESS_FOCUS_SCOPE_ID,
    })
  }, [controller, options.focusScopeId, options.keyboardKind, options.layout, options.maxLength])

  useLayoutEffect(() => {
    const activeVirtualField = keyboardState.owner === 'virtual'
      && keyboardState.visible
      && keyboardState.activeFieldId === options.fieldId
    const pendingVirtualField = keyboardState.owner === 'none'
      && keyboardState.activeFieldId === null
      && keyboardState.blockedFieldId === options.fieldId
      && keyboardState.blockedCapacity === null
    if (!activeVirtualField && !pendingVirtualField) return
    const keyboardHeight = keyboardState.height
    if (keyboardHeight <= 0) return
    if (scrollAncestor !== null) {
      scrollAncestor(options.fieldId, inputRef, keyboardHeight)
      return
    }
    const input = options.nativeLess ? visibleAnchorRef.current : inputRef?.current ?? null
    const surfaceRoot = geometry?.surfaceRoot ?? null
    if (geometry === null) return
    if (surfaceRoot === null) {
      geometry.reportFocusVisibilityFailure(options.fieldId, 'surface-root-unavailable')
      return
    }
    if (input === null) {
      geometry.reportFocusVisibilityFailure(options.fieldId, options.nativeLess ? 'visible-anchor-unavailable' : 'input-ref-unavailable')
      return
    }
    input.measureLayout(
      surfaceRoot,
      (...measurement: FocusRectMeasurement) => {
        const rect = focusRectOf(measurement)
        if (rect === null) {
          geometry.reportFocusVisibilityFailure(options.fieldId, 'invalid-focus-rectangle')
          return
        }
        const offsetY = presentFocusRect({fieldId: options.fieldId, rect})
        const visibleBottom = geometry.surfaceHeight - geometry.keyboardHeight
        const fullyVisible = rect.y + offsetY >= 0 && rect.y + rect.height + offsetY <= visibleBottom
        if (fullyVisible) geometry.reportFocusVisibilitySuccess(options.fieldId)
        else geometry.reportFocusVisibilityFailure(options.fieldId, 'focus-rectangle-outside-visible-band')
      },
      () => {
        geometry.reportFocusVisibilityFailure(options.fieldId, 'surface-root-measurement-failed')
      },
    )
  }, [
    keyboardState.activeFieldId,
    keyboardState.blockedCapacity,
    keyboardState.blockedFieldId,
    keyboardState.height,
    keyboardState.owner,
    keyboardState.visible,
    options.fieldId,
    options.nativeLess,
    geometry?.keyboardHeight,
    presentFocusRect,
    geometry?.reportFocusVisibilityFailure,
    geometry?.reportFocusVisibilitySuccess,
    geometry?.surfaceRoot,
    geometry?.surfaceHeight,
    geometry?.surfaceWidth,
    scrollAncestor,
  ])

  const updateState = useCallback((next: EditState): void => {
    editStateRef.current = next
    setEditState(next)
    const token = tokenRef.current
    if (token !== null) {
      controller.updateValue(token, next.value)
      controller.updateSelection(token, next.selection)
    }
  }, [controller])

  const onChangeText = useCallback((value: string): void => {
    const current = editStateRef.current
    updateState({
      ...current,
      value,
      selection: normalizeSelection(value, current.selection),
    })
  }, [updateState])

  const onSelectionChange = useCallback((event: {readonly nativeEvent: {readonly selection: {
    readonly start: number
    readonly end: number
  }}}): void => {
    const current = editStateRef.current
    updateState({
      ...current,
      selection: normalizeSelection(current.value, event.nativeEvent.selection),
    })
  }, [updateState])

  const onFocus = useCallback(() => controller.handleFocus(options.fieldId), [controller, options.fieldId])
  const onBlur = useCallback(() => controller.handleBlur(options.fieldId), [controller, options.fieldId])
  const onPressIn = useCallback((event: InputPressEvent) => {
    event.stopPropagation()
    controller.preflightFocusTarget(options.fieldId)
  }, [controller, options.fieldId])
  const onTouchEnd = useCallback((event: InputPressEvent) => {
    event.stopPropagation()
  }, [])
  const focus = useCallback(() => controller.focusField(options.fieldId), [controller, options.fieldId])
  const blur = useCallback(() => controller.blurField(options.fieldId), [controller, options.fieldId])
  const complete = useCallback(() => controller.completeField(options.fieldId), [controller, options.fieldId])

  const inputProps = useMemo(() => ({
    testID: options.testID,
    accessibilityLabel: options.accessibilityLabel,
    editable: options.editable,
    inputRef,
    maxLength: options.maxLength,
    onBlur,
    onChangeText,
    onFocus,
    onPressIn,
    onTouchEnd,
    onSelectionChange,
    selection: editState.selection,
    secureTextEntry: options.secureTextEntry,
    value: editState.value,
  }), [
    editState.selection,
    editState.value,
    onBlur,
    onChangeText,
    onFocus,
    onPressIn,
    onTouchEnd,
    onSelectionChange,
    options.accessibilityLabel,
    options.editable,
    options.maxLength,
    options.secureTextEntry,
    options.testID,
  ])

  return useMemo(() => ({
    inputProps,
    visibleAnchorRef,
    captureInputSnapshot: controller.captureInputSnapshot,
    focus,
    blur,
    complete,
  }), [blur, complete, controller.captureInputSnapshot, focus, inputProps, visibleAnchorRef])
}
