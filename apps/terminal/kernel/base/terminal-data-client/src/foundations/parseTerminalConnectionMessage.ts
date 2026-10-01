const MAX_MESSAGE_BYTES = 65_536;

const utf8ByteLength = (value: string): number => {
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    length += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        length += 1;
        index += 1;
      }
    }
    if (length > MAX_MESSAGE_BYTES) return length;
  }
  return length;
};

type ContainerFrame =
  | {
      readonly kind: 'object';
      readonly keys: Set<string>;
      phase: 'key-or-end' | 'key' | 'colon' | 'value' | 'comma-or-end';
    }
  | {readonly kind: 'array'; phase: 'value-or-end' | 'value' | 'comma-or-end'};

const scanStringEnd = (raw: string, start: number): number => {
  let index = start + 1;
  while (index < raw.length) {
    const character = raw[index];
    if (character === '\\') {
      index += 2;
    } else if (character === '"') {
      return index + 1;
    } else {
      index += 1;
    }
  }
  throw new Error('TERMINAL_CONNECTION_MESSAGE_INVALID');
};

const scanDuplicateKeys = (raw: string): void => {
  const stack: ContainerFrame[] = [];
  const markValue = (): void => {
    const parent = stack.at(-1);
    if (parent !== undefined) parent.phase = 'comma-or-end';
  };
  let index = 0;
  while (index < raw.length) {
    const character = raw[index];
    if (character === ' ' || character === '\n' || character === '\r' || character === '\t') {
      index += 1;
      continue;
    }
    const top = stack.at(-1);
    if (top?.kind === 'object' && (top.phase === 'key-or-end' || top.phase === 'key')) {
      if (character === '}') {
        stack.pop();
        index += 1;
        continue;
      }
      const start = index;
      index = scanStringEnd(raw, index);
      const key = JSON.parse(raw.slice(start, index)) as string;
      if (top.keys.has(key)) throw new Error('TERMINAL_CONNECTION_MESSAGE_DUPLICATE_FIELD');
      top.keys.add(key);
      top.phase = 'colon';
      continue;
    }
    if (top?.kind === 'array' && (top.phase === 'value-or-end' || top.phase === 'value') && character === ']') {
      stack.pop();
      index += 1;
      continue;
    }
    if (character === ':') {
      if (top?.kind === 'object') top.phase = 'value';
      index += 1;
      continue;
    }
    if (character === ',') {
      if (top?.kind === 'object') top.phase = 'key';
      if (top?.kind === 'array') top.phase = 'value';
      index += 1;
      continue;
    }
    if (character === '{') {
      markValue();
      stack.push({kind: 'object', keys: new Set(), phase: 'key-or-end'});
      index += 1;
      continue;
    }
    if (character === '[') {
      markValue();
      stack.push({kind: 'array', phase: 'value-or-end'});
      index += 1;
      continue;
    }
    if (character === '"') {
      index = scanStringEnd(raw, index);
      markValue();
      continue;
    }
    if (character === '}' || character === ']') {
      stack.pop();
      index += 1;
      continue;
    }
    while (index < raw.length && !/[\s,}\]]/.test(raw[index]!)) index += 1;
    markValue();
  }
};

/** Parses one bounded protocol message and rejects repeated member names at any depth. */
export const parseTerminalConnectionMessage = (raw: string): unknown => {
  if (utf8ByteLength(raw) > MAX_MESSAGE_BYTES) throw new Error('TERMINAL_CONNECTION_MESSAGE_TOO_LARGE');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('TERMINAL_CONNECTION_MESSAGE_INVALID');
  }
  scanDuplicateKeys(raw);
  return parsed;
};

export const terminalConnectionMessageUtf8ByteLength = utf8ByteLength;
