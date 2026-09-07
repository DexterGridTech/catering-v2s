import {describe, expect, it} from 'vitest';
import {getKeyboardLayout} from '../src/model/keyboardLayout';

describe('virtual keyboard visual row alignment', () => {
  it('centers short alphabet and action rows like a soft keyboard', () => {
    expect(getKeyboardLayout('full').rows.map(row => row.align)).toEqual([
      'start',
      'start',
      'center',
      'center',
      'center',
    ]);
    expect(getKeyboardLayout('alpha').rows.map(row => row.align)).toEqual(['start', 'center', 'center', 'center']);
  });

  it('keeps numeric zero and financial symbols centered', () => {
    expect(getKeyboardLayout('numeric').rows.map(row => row.align)).toEqual([
      'start',
      'start',
      'start',
      'center',
      'center',
    ]);
    expect(getKeyboardLayout('financial').rows.map(row => row.align)).toEqual([
      'start',
      'start',
      'start',
      'center',
      'center',
    ]);
  });
});
