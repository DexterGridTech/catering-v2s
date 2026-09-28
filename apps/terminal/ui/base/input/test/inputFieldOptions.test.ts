import {describe, expect, it} from 'vitest';
import type {InputFieldOptions} from '../src/types/types';

describe('InputFieldOptions', () => {
  it('keeps the virtual layout contract and supports a native-less field', () => {
    const virtualField: InputFieldOptions = {
      fieldId: 'virtual',
      testID: 'virtual',
      keyboardKind: 'virtual',
      layout: 'numeric',
      nativeLess: true,
      focusScopeId: 'admin.console',
    };

    expect(virtualField.keyboardKind).toBe('virtual');
    expect(virtualField.layout).toBe('numeric');
    expect(virtualField.nativeLess).toBe(true);
    expect(virtualField.focusScopeId).toBe('admin.console');
  });
});
