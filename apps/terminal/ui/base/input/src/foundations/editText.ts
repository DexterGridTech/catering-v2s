export type InputSelection = Readonly<{
  readonly start: number;
  readonly end: number;
}>;

export type EditState = Readonly<{
  readonly value: string;
  readonly selection: InputSelection;
  readonly shift: boolean;
}>;

export type KeyboardKey =
  | Readonly<{readonly kind: 'text'; readonly text: string}>
  | Readonly<{readonly kind: 'backspace'}>
  | Readonly<{readonly kind: 'shift'}>
  | Readonly<{readonly kind: 'space'}>
  | Readonly<{readonly kind: 'complete'; readonly hasNextField: boolean}>;

export type EditEffect = 'edit' | 'mode' | 'focus-next' | 'close-only';

export type EditResult = Readonly<{
  readonly state: EditState;
  readonly effect: EditEffect;
}>;

const clamp = (value: number, lower: number, upper: number): number =>
  Math.min(upper, Math.max(lower, Number.isFinite(value) ? Math.trunc(value) : lower));

export const normalizeSelection = (
  value: string,
  selection: Readonly<{readonly start: number; readonly end?: number}>,
): InputSelection => {
  const start = clamp(selection.start, 0, value.length);
  const end = clamp(selection.end ?? selection.start, 0, value.length);
  return start <= end ? {start, end} : {start: end, end: start};
};

const withSelection = (state: EditState, value: string, selection: InputSelection): EditState => ({
  ...state,
  value,
  selection: normalizeSelection(value, selection),
});

const insertText = (state: EditState, text: string, maxLength?: number): EditState => {
  const selection = normalizeSelection(state.value, state.selection);
  const before = state.value.slice(0, selection.start);
  const after = state.value.slice(selection.end);
  // Layout definitions provide lowercase alphabetic payloads. Preserve the
  // payload when uppercase mode is off so callers can still supply semantic
  // text without the edit model rewriting it unexpectedly.
  const transformed = state.shift ? text.toUpperCase() : text;
  const available =
    maxLength === undefined ? transformed.length : Math.max(0, Math.trunc(maxLength) - before.length - after.length);
  const inserted = transformed.slice(0, available);
  const value = before + inserted + after;
  return withSelection(inserted.length > 0 ? {...state, shift: false} : state, value, {
    start: before.length + inserted.length,
    end: before.length + inserted.length,
  });
};

const backspace = (state: EditState): EditState => {
  const selection = normalizeSelection(state.value, state.selection);
  if (selection.start !== selection.end) {
    return withSelection(state, state.value.slice(0, selection.start) + state.value.slice(selection.end), {
      start: selection.start,
      end: selection.start,
    });
  }
  if (selection.start === 0) return withSelection(state, state.value, selection);
  const cursor = selection.start - 1;
  return withSelection(state, state.value.slice(0, cursor) + state.value.slice(selection.end), {
    start: cursor,
    end: cursor,
  });
};

export const applyKeyboardKey = (state: EditState, key: KeyboardKey, maxLength?: number): EditResult => {
  if (key.kind === 'text') return {state: insertText(state, key.text, maxLength), effect: 'edit'};
  if (key.kind === 'space') return {state: insertText(state, ' ', maxLength), effect: 'edit'};
  if (key.kind === 'backspace') return {state: backspace(state), effect: 'edit'};
  if (key.kind === 'shift')
    return {
      state: {...state, shift: !state.shift},
      effect: 'mode',
    };
  return {
    state: withSelection(state, state.value, normalizeSelection(state.value, state.selection)),
    effect: key.hasNextField ? 'focus-next' : 'close-only',
  };
};
