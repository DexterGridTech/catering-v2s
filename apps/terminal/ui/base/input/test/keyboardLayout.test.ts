import {describe, expect, it} from 'vitest';
import {getKeyboardLayout} from '../src/foundations/keyboardLayout';

describe('virtual keyboard visual row alignment', () => {
  it('integrates modifier and edit keys into the final content row', () => {
    expect(getKeyboardLayout('full').rows.map(row => row.align)).toEqual(['start', 'start', 'start', 'start']);
    expect(getKeyboardLayout('full').rows.map(row => row.keys.map(key => key.keyId))).toEqual([
      ['text-1', 'text-2', 'text-3', 'text-4', 'text-5', 'text-6', 'text-7', 'text-8', 'text-9', 'text-0'],
      ['text-q', 'text-w', 'text-e', 'text-r', 'text-t', 'text-y', 'text-u', 'text-i', 'text-o', 'text-p'],
      ['caps', 'text-a', 'text-s', 'text-d', 'text-f', 'text-g', 'text-h', 'text-j', 'text-k', 'text-l'],
      ['shift', 'text-z', 'text-x', 'text-c', 'text-v', 'text-b', 'text-n', 'text-m', 'backspace', 'complete'],
    ]);
    expect(getKeyboardLayout('alpha').rows.map(row => row.align)).toEqual(['start', 'start', 'start']);
    expect(getKeyboardLayout('alpha').rows.map(row => row.region)).toEqual(['letters', 'actions', 'actions']);
    expect(getKeyboardLayout('alpha').rows[1]?.keys.map(key => key.keyId)).toEqual([
      'caps', 'text-a', 'text-s', 'text-d', 'text-f', 'text-g', 'text-h', 'text-j', 'text-k', 'text-l',
    ]);
    expect(
      getKeyboardLayout('alpha')
        .rows.at(-1)
        ?.keys.map(key => key.keyId),
    ).toEqual(['shift', 'text-z', 'text-x', 'text-c', 'text-v', 'text-b', 'text-n', 'text-m', 'backspace', 'complete']);
  });

  it('keeps numeric actions in the keypad row and fits the financial row', () => {
    expect(getKeyboardLayout('numeric').rows.map(row => row.align)).toEqual(['start', 'start', 'start', 'start']);
    expect(
      getKeyboardLayout('numeric')
        .rows.at(-1)
        ?.keys.map(key => key.keyId),
    ).toEqual(['backspace', 'text-0', 'complete']);
    expect(getKeyboardLayout('numeric').visualRowCount).toBe(4);
    expect(
      getKeyboardLayout('numeric')
        .rows.at(-1)
        ?.grid?.columns.map(column => ({
          span: column.span,
          direction: column.direction,
          keys: column.keys.map(key => key.keyId),
        })),
    ).toEqual([
      {span: 1, direction: 'row', keys: ['backspace']},
      {span: 1, direction: 'row', keys: ['text-0']},
      {span: 1, direction: 'row', keys: ['complete']},
    ]);
    expect(getKeyboardLayout('financial').rows.map(row => row.align)).toEqual(['start', 'start', 'start', 'start']);
    expect(
      getKeyboardLayout('financial')
        .rows.at(-1)
        ?.keys.map(key => key.keyId),
    ).toEqual(['text--', 'text-0', 'text-.', 'backspace', 'complete']);
    expect(getKeyboardLayout('financial').rows.at(-1)?.sizing).toBe('shared');
    expect(getKeyboardLayout('financial').visualRowCount).toBe(4);
    expect(getKeyboardLayout('financial').maxColumns).toBe(3);
    expect(
      getKeyboardLayout('financial')
        .rows.at(-1)
        ?.grid?.columns.map(column => ({
          span: column.span,
          direction: column.direction,
          keys: column.keys.map(key => key.keyId),
        })),
    ).toEqual([
      {span: 1, direction: 'row', keys: ['text--', 'text-.']},
      {span: 1, direction: 'row', keys: ['text-0']},
      {span: 1, direction: 'row', keys: ['backspace', 'complete']},
    ]);
  });
});
