export type KeyboardLayout = 'full' | 'financial' | 'numeric' | 'alpha';

export type KeyboardRegion = 'letters' | 'digits' | 'symbols' | 'actions';

export type KeyboardKeyDefinition =
  | Readonly<{
      readonly keyId: `text-${string}`;
      readonly zone: 'letters' | 'digits' | 'symbols';
      readonly kind: 'text';
      readonly text: string;
      readonly shiftedText?: string;
    }>
  | Readonly<{
      readonly keyId: 'shift' | 'space' | 'backspace' | 'complete';
      readonly zone: 'actions';
      readonly kind: 'shift' | 'space' | 'backspace' | 'complete';
    }>;

export type KeyboardGridColumn = Readonly<{
  readonly span: number;
  readonly direction: 'row' | 'column';
  readonly keys: readonly KeyboardKeyDefinition[];
}>;

export type KeyboardGrid = Readonly<{
  readonly columns: readonly KeyboardGridColumn[];
  readonly rowCount: number;
}>;

export type KeyboardRow = Readonly<{
  readonly keys: readonly KeyboardKeyDefinition[];
  readonly align: 'start' | 'center';
  readonly region: KeyboardRegion;
  /** Use the shared layout cell width, or fit this row to the complete frame width. */
  readonly sizing: 'shared' | 'fit';
  /** Optional composite grid used when a key spans columns or sibling keys share one cell. */
  readonly grid?: KeyboardGrid;
}>;

export type KeyboardLayoutDefinition = Readonly<{
  readonly layout: KeyboardLayout;
  readonly rows: readonly KeyboardRow[];
  /** Total visual rows, including rows inside a composite grid row. */
  readonly visualRowCount: number;
  readonly maxColumns: number;
  readonly horizontalMode: 'dense' | 'standard';
}>;

const textKey = (
  text: string,
  zone: 'letters' | 'digits' | 'symbols',
  shiftedText?: string,
): KeyboardKeyDefinition => ({
  keyId: `text-${text}`,
  zone,
  kind: 'text',
  text,
  ...(shiftedText === undefined ? {} : {shiftedText}),
});

const actionKey = (kind: 'shift' | 'space' | 'backspace' | 'complete'): KeyboardKeyDefinition => ({
  keyId: kind,
  zone: 'actions',
  kind,
});

const row = (input: Readonly<{
  keys: readonly KeyboardKeyDefinition[];
  region: KeyboardRegion;
  align?: 'start' | 'center';
  sizing?: 'shared' | 'fit';
  grid?: KeyboardGrid;
}>): KeyboardRow => Object.freeze({
  keys: Object.freeze([...input.keys]),
  align: input.align ?? 'start',
  region: input.region,
  sizing: input.sizing ?? 'shared',
  grid: input.grid,
});

const textRow = (input: Readonly<{
  value: string;
  zone: 'letters' | 'digits' | 'symbols';
  align?: 'start' | 'center';
  sizing?: 'shared' | 'fit';
}>): KeyboardRow => row({
  keys: Array.from(input.value, character => textKey(character, input.zone)),
  region: input.zone,
  align: input.align,
  sizing: input.sizing,
});

const compoundRow = (keys: readonly KeyboardKeyDefinition[], sizing: 'shared' | 'fit' = 'shared'): KeyboardRow =>
  row({keys, region: 'actions', align: 'start', sizing});

const zeroKey = textKey('0', 'digits');
const minusKey = textKey('-', 'symbols');
const dotKey = textKey('.', 'symbols');
const urlShiftCharacters: Readonly<Record<string, string>> = Object.freeze({
  '1': ':',
  '2': '/',
  '3': '.',
  '4': '?',
  '5': '&',
  '6': '=',
  '7': '-',
  '8': '_',
  '9': '%',
  '0': '+',
});
const fullDigitRow = Array.from('1234567890', digit => textKey(digit, 'digits', urlShiftCharacters[digit]));
const spaceKey = actionKey('space');
const backspaceKey = actionKey('backspace');
const completeKey = actionKey('complete');

const gridRow = (
  columns: readonly KeyboardGridColumn[],
  orderedKeys: readonly KeyboardKeyDefinition[] = columns.flatMap(column => column.keys),
): KeyboardRow => {
  const normalizedColumns = Object.freeze(
    columns.map(column =>
      Object.freeze({span: column.span, direction: column.direction, keys: Object.freeze([...column.keys])}),
    ),
  );
  return row({
    keys: orderedKeys,
    region: 'actions',
    align: 'start',
    sizing: 'shared',
    grid: Object.freeze({columns: normalizedColumns, rowCount: 1}),
  });
};

const definitions: Readonly<Record<KeyboardLayout, KeyboardLayoutDefinition>> = Object.freeze({
  full: Object.freeze({
    layout: 'full',
    rows: Object.freeze([
      row({keys: fullDigitRow, region: 'digits'}),
      textRow({value: 'qwertyuiop', zone: 'letters'}),
      compoundRow([actionKey('shift'), ...Array.from('asdfghjkl', character => textKey(character, 'letters'))]),
      compoundRow([
        spaceKey,
        ...Array.from('zxcvbnm', character => textKey(character, 'letters')),
        backspaceKey,
        completeKey,
      ]),
    ]),
    visualRowCount: 4,
    maxColumns: 10,
    horizontalMode: 'dense',
  }),
  alpha: Object.freeze({
    layout: 'alpha',
    rows: Object.freeze([
      textRow({value: 'qwertyuiop', zone: 'letters'}),
      compoundRow([
        actionKey('shift'),
        ...Array.from('asdfghjkl', character => textKey(character, 'letters')),
      ]),
      compoundRow([
        spaceKey,
        ...Array.from('zxcvbnm', character => textKey(character, 'letters')),
        backspaceKey,
        completeKey,
      ]),
    ]),
    visualRowCount: 3,
    maxColumns: 10,
    horizontalMode: 'dense',
  }),
  numeric: Object.freeze({
    layout: 'numeric',
    rows: Object.freeze([
      textRow({value: '123', zone: 'digits'}),
      textRow({value: '456', zone: 'digits'}),
      textRow({value: '789', zone: 'digits'}),
      gridRow(
        [
          {span: 1, direction: 'row', keys: [backspaceKey]},
          {span: 1, direction: 'row', keys: [zeroKey]},
          {span: 1, direction: 'row', keys: [completeKey]},
        ],
        [backspaceKey, zeroKey, completeKey],
      ),
    ]),
    visualRowCount: 4,
    maxColumns: 3,
    horizontalMode: 'standard',
  }),
  financial: Object.freeze({
    layout: 'financial',
    rows: Object.freeze([
      textRow({value: '123', zone: 'digits'}),
      textRow({value: '456', zone: 'digits'}),
      textRow({value: '789', zone: 'digits'}),
      gridRow(
        [
          {span: 1, direction: 'row', keys: [minusKey, dotKey]},
          {span: 1, direction: 'row', keys: [zeroKey]},
          {span: 1, direction: 'row', keys: [backspaceKey, completeKey]},
        ],
        [minusKey, zeroKey, dotKey, backspaceKey, completeKey],
      ),
    ]),
    visualRowCount: 4,
    maxColumns: 3,
    horizontalMode: 'standard',
  }),
});

export const getKeyboardLayout = (layout: KeyboardLayout): KeyboardLayoutDefinition => definitions[layout];

export const keyboardLayoutDefinitions = definitions;
