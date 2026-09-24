import {useEffect, useState} from 'react'
import {Linking, StyleSheet, Text, View} from 'react-native'
import {InputSurfaceFrame, useInputField} from '@catering-v2s/ui-base-input'
import {PrimitiveInput} from '@catering-v2s/ui-base-primitives'

export const CONTROLLED_KEYBOARD_HARNESS_URL = 'ter-vk://controlled/full'

export const isControlledKeyboardHarnessUrl = (value: string): boolean =>
  value === CONTROLLED_KEYBOARD_HARNESS_URL

export const useControlledKeyboardHarness = (enabled: boolean): boolean => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const subscription = Linking.addEventListener('url', event => {
      if (isControlledKeyboardHarnessUrl(event.url)) setActive(true)
    })
    return () => subscription.remove()
  }, [enabled])

  return active
}

export const ControlledKeyboardHarness = () => (
  <InputSurfaceFrame>
    <ControlledKeyboardHarnessField />
  </InputSurfaceFrame>
)

const ControlledKeyboardHarnessField = () => {
  const field = useInputField({
    fieldId: 'harness:full-field',
    testID: 'harness:full-field',
    accessibilityLabel: '受控全键盘验证输入框',
    keyboardKind: 'virtual',
    layout: 'full',
    initialValue: '',
  })

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>受控全键盘验证</Text>
      <Text style={styles.description}>此空输入框仅用于验证按键实际插入值。</Text>
      <PrimitiveInput {...field.inputProps} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f5f7fb',
  },
  heading: {fontSize: 20, fontWeight: '600', color: '#172033'},
  description: {fontSize: 14, color: '#536179'},
})
