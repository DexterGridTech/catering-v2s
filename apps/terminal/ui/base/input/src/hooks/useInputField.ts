import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {
  applyKeyboardKey,
  normalizeSelection,
  type EditResult,
  type EditState,
  type KeyboardKey,
} from '../foundations/editText'
import type {InputRegistrationToken} from '../foundations/snapshot'
import {useInputController, useInputFieldKeyboardState, useInputScrollAncestor} from '../contexts/context'
import type {InputFieldOptions, InputFieldResult} from '../types/types'
import type {PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives'
import {BUSINESS_FOCUS_SCOPE_ID} from '../foundations/focusScope'

type InputPressEvent = Readonly<{
  readonly stopPropagation: () => void
}>

export const useInputField = (options: InputFieldOptions): InputFieldResult => {
  const controller = useInputController()
  const keyboardState = useInputFieldKeyboardState()
  const scrollAncestor = useInputScrollAncestor()
  const initialValue = options.initialValue ?? ''
  const initialSelection = normalizeSelection(initialValue, options.initialSelection ?? {
    start: initialValue.length,
    end: initialValue.length,
  })
  const [editState, setEditState] = useState<EditState>(() => ({
    value: initialValue,
    selection: initialSelection,
    shift: false,
    capsLock: false,
  }))
  const editStateRef = useRef(editState)
  editStateRef.current = editState
  const nativeInputRef = useRef<PrimitiveInputHandle | null>(null)
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

  useLayoutEffect(() => {
    const token = controller.registerField({
      fieldId: options.fieldId,
      value: editStateRef.current.value,
      selection: editStateRef.current.selection,
      keyboardKind: options.keyboardKind,
      layout: options.layout ?? 'full',
      maxLength: options.maxLength,
      focusScopeId: options.focusScopeId ?? BUSINESS_FOCUS_SCOPE_ID,
      keyboardPlacement: options.keyboardPlacement ?? 'surface',
      inputRef,
      applyKey: applyKeyProxy,
      getEditState,
    })
    tokenRef.current = token
    return () => {
      controller.unregisterField(token)
      if (tokenRef.current === token) tokenRef.current = null
    }
  }, [applyKeyProxy, controller, getEditState, inputRef, options.fieldId, options.focusScopeId, options.keyboardKind, options.keyboardPlacement, options.layout, options.maxLength])

  useLayoutEffect(() => {
    const token = tokenRef.current
    if (token === null) return
    controller.updateFieldConfig(token, {
      keyboardKind: options.keyboardKind,
      layout: options.layout ?? 'full',
      maxLength: options.maxLength,
      focusScopeId: options.focusScopeId ?? BUSINESS_FOCUS_SCOPE_ID,
      keyboardPlacement: options.keyboardPlacement ?? 'surface',
    })
  }, [controller, options.focusScopeId, options.keyboardKind, options.keyboardPlacement, options.layout, options.maxLength])

  useLayoutEffect(() => {
    const keyboardVisible = keyboardState.owner === 'virtual' && keyboardState.visible
    if (keyboardState.activeFieldId !== options.fieldId || !keyboardVisible) return
    const keyboardHeight = keyboardState.height
    if (keyboardHeight <= 0) return
    scrollAncestor?.(inputRef, keyboardHeight)
  }, [
    keyboardState.activeFieldId,
    keyboardState.height,
    keyboardState.owner,
    keyboardState.visible,
    options.fieldId,
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
    captureInputSnapshot: controller.captureInputSnapshot,
    focus,
    blur,
    complete,
  }), [blur, complete, controller.captureInputSnapshot, focus, inputProps])
}
