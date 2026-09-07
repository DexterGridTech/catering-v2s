export type KeyboardLayout = 'full' | 'financial' | 'numeric' | 'alpha';

export type KeyboardKeyDefinition =
  | Readonly<{
      readonly keyId: `text-${string}`;
      readonly zone: 'letters' | 'digits' | 'symbols';
      readonly kind: 'text';
      readonly text: string;
    }>
  | Readonly<{
      readonly keyId: 'shift' | 'caps' | 'backspace' | 'complete';
      readonly zone: 'actions';
      readonly kind: 'shift' | 'caps' | 'backspace' | 'complete';
    }>;

export type KeyboardRow = Readonly<{
  readonly keys: readonly KeyboardKeyDefinition[];
  readonly align: 'start' | 'center';
}>;

export type KeyboardLayoutDefinition = Readonly<{
  readonly layout: KeyboardLayout;
  readonly rows: readonly KeyboardRow[];
  readonly maxColumns: number;
  readonly horizontalMode: 'dense' | 'standard';
}>;

const textKey = (text: string, zone: 'letters' | 'digits' | 'symbols'): KeyboardKeyDefinition => ({
  keyId: `text-${text}`,
  zone,
  kind: 'text',
  text,
});

const actionKey = (kind: 'shift' | 'caps' | 'backspace' | 'complete'): KeyboardKeyDefinition => ({
  keyId: kind,
  zone: 'actions',
  kind,
});

const row = (keys: readonly KeyboardKeyDefinition[], align: 'start' | 'center' = 'start'): KeyboardRow =>
  Object.freeze({keys: Object.freeze([...keys]), align});

const textRow = (
  value: string,
  zone: 'letters' | 'digits' | 'symbols',
  align: 'start' | 'center' = 'start',
): KeyboardRow =>
  row(
    Array.from(value, character => textKey(character, zone)),
    align,
  );

const actionsRow = (kinds: readonly ('shift' | 'caps' | 'backspace' | 'complete')[]): KeyboardRow =>
  row(kinds.map(actionKey), 'center');

const definitions: Readonly<Record<KeyboardLayout, KeyboardLayoutDefinition>> = Object.freeze({
  full: Object.freeze({
    layout: 'full',
    rows: Object.freeze([
      textRow('1234567890', 'digits'),
      textRow('qwertyuiop', 'letters'),
      textRow('asdfghjkl', 'letters', 'center'),
      textRow('zxcvbnm', 'letters', 'center'),
      actionsRow(['shift', 'caps', 'backspace', 'complete']),
    ]),
    maxColumns: 10,
    horizontalMode: 'dense',
  }),
  alpha: Object.freeze({
    layout: 'alpha',
    rows: Object.freeze([
      textRow('qwertyuiop', 'letters'),
      textRow('asdfghjkl', 'letters', 'center'),
      textRow('zxcvbnm', 'letters', 'center'),
      actionsRow(['shift', 'backspace', 'complete']),
    ]),
    maxColumns: 10,
    horizontalMode: 'dense',
  }),
  numeric: Object.freeze({
    layout: 'numeric',
    rows: Object.freeze([
      textRow('123', 'digits'),
      textRow('456', 'digits'),
      textRow('789', 'digits'),
      textRow('0', 'digits', 'center'),
      actionsRow(['backspace', 'complete']),
    ]),
    maxColumns: 3,
    horizontalMode: 'standard',
  }),
  financial: Object.freeze({
    layout: 'financial',
    rows: Object.freeze([
      textRow('123', 'digits'),
      textRow('456', 'digits'),
      textRow('789', 'digits'),
      row([textKey('-', 'symbols'), textKey('0', 'digits'), textKey('.', 'symbols')], 'center'),
      actionsRow(['backspace', 'complete']),
    ]),
    maxColumns: 3,
    horizontalMode: 'standard',
  }),
});

export const getKeyboardLayout = (layout: KeyboardLayout): KeyboardLayoutDefinition => definitions[layout];

export const keyboardLayoutDefinitions = definitions;
