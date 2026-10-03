import {afterEach, describe, expect, it, vi} from 'vitest';
import {androidStructuredLoggerBinding} from '../src/foundations/androidStructuredLoggerBinding';

describe('Android structured logger binding', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes one JSON line so Android logcat retains the sanitized event fields', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const event = {
      timestamp: 1_791_018_001_000,
      level: 'info' as const,
      category: 'terminal.activation.http',
      event: 'activation-request-result',
      scope: {moduleName: 'kernel.base.terminal-data-client', layer: 'kernel' as const},
      context: {commandId: 'command-1'},
      data: {profileId: 'terminal-data-client', status: 200},
      security: {containsSensitiveRaw: false, maskingMode: 'masked' as const},
    };

    androidStructuredLoggerBinding.write(event);

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toBe(JSON.stringify(event));
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual(event);
  });

  it('routes each event level to the matching console method', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = {
      timestamp: 1_791_018_001_000,
      category: 'test',
      event: 'test-event',
      scope: {moduleName: 'test'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked' as const},
    };

    androidStructuredLoggerBinding.write({...base, level: 'debug'});
    androidStructuredLoggerBinding.write({...base, level: 'warn'});
    androidStructuredLoggerBinding.write({...base, level: 'error'});

    expect(debug).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
