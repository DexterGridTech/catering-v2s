import {describe, expect, it} from 'vitest'
import type {InputFieldOptions} from '../src/types/types'

describe('InputFieldOptions', () => {
  it('keeps layout required for virtual fields and absent for system fields', () => {
    const systemField: InputFieldOptions = {
      fieldId: 'system',
      testID: 'system',
      keyboardKind: 'system',
    }
    const virtualField: InputFieldOptions = {
      fieldId: 'virtual',
      testID: 'virtual',
      keyboardKind: 'virtual',
      layout: 'numeric',
    }

    const invalidSystemField: InputFieldOptions = {
      fieldId: 'invalid-system',
      testID: 'invalid-system',
      keyboardKind: 'system',
      // @ts-expect-error system-keyboard fields cannot carry virtual layout semantics.
      layout: 'full',
    }

    expect(systemField.keyboardKind).toBe('system')
    expect(virtualField.layout).toBe('numeric')
    expect(invalidSystemField).toBeDefined()
  })
})
