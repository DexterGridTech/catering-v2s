import {describe, expect, it} from 'vitest';
import {
  parseTerminalConnectionMessage,
  terminalConnectionMessageUtf8ByteLength,
} from '../src/foundations/parseTerminalConnectionMessage';

describe('terminal connection message parser', () => {
  it('accepts unknown nested fields while preserving strict JSON and UTF-8 limits', () => {
    const raw = JSON.stringify({
      type: 'SESSION_READY',
      sessionId: 'session-1',
      extension: {items: [1, {note: 'x'.repeat(1_024)}]},
    });
    expect(parseTerminalConnectionMessage(raw)).toMatchObject({
      type: 'SESSION_READY',
      extension: {items: [1, {note: 'x'.repeat(1_024)}]},
    });
    expect(terminalConnectionMessageUtf8ByteLength('a😀é')).toBe(7);
    expect(() => parseTerminalConnectionMessage('{"type":"SESSION_READY"} trailing')).toThrow(
      'TERMINAL_CONNECTION_MESSAGE_INVALID',
    );
    expect(() => parseTerminalConnectionMessage(JSON.stringify({extension: 'x'.repeat(65_536)}))).toThrow(
      'TERMINAL_CONNECTION_MESSAGE_TOO_LARGE',
    );
  });

  it('rejects duplicate known, unknown, nested, and escape-equivalent member names', () => {
    for (const raw of [
      '{"type":"PONG","seq":1,"seq":2}',
      '{"type":"PONG","extra":1,"extra":2}',
      '{"type":"PONG","extra":{"seq":1,"seq":2}}',
      '{"type":"PONG","seq":1,"\\u0073eq":2}',
    ]) {
      expect(() => parseTerminalConnectionMessage(raw)).toThrow('TERMINAL_CONNECTION_MESSAGE_DUPLICATE_FIELD');
    }
  });
});
