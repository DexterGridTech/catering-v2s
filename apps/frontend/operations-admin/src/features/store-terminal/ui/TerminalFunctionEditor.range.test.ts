import {describe, expect, it} from 'vitest';
import {normalizeCandidateSelection, terminalFunctionDraftHasSceneChanges} from './TerminalFunctionEditor';

describe('store terminal candidate selection', () => {
  it('normalizes the aggregate option without mutating the caller array', () => {
    const selected = ['area-1', 'area-2'];
    const normalized = normalizeCandidateSelection(selected);
    expect(normalized).toEqual(['area-1', 'area-2']);
    expect(normalized).not.toBe(selected);
  });

  it('makes the aggregate option exclusive for both candidate types', () => {
    expect(normalizeCandidateSelection(['__ALL__'])).toEqual(['__ALL__']);
    expect(normalizeCandidateSelection(['__ALL__', 'area-1'])).toEqual(['__ALL__']);
  });

  it('treats malformed scene collections as draft changes instead of allowing a silent function switch', () => {
    expect(
      terminalFunctionDraftHasSceneChanges(
        {PREPARATION_TICKET: {selected: false, orderTypes: ['UNKNOWN_ORDER_TYPE'] as never, printerKeys: []}},
        [],
      ),
    ).toBe(true);
    expect(
      terminalFunctionDraftHasSceneChanges(
        {PREPARATION_TICKET: {selected: false, orderTypes: [], printerKeys: ['unknown-printer']}},
        ['known-printer'],
      ),
    ).toBe(true);
    expect(
      terminalFunctionDraftHasSceneChanges(
        {PREPARATION_TICKET: {selected: false, orderTypes: [], printerKeys: []}},
        [],
      ),
    ).toBe(false);
  });
});
