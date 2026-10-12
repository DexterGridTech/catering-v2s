import {describe, expect, it} from 'vitest';
import {
  remoteControlMessageTypes,
  remoteControlProtocolMaxMessageBytes,
  remoteControlTopic,
} from '../src';

describe('remote control protocol contract', () => {
  it('exposes exactly the six approved message kinds and message boundary', () => {
    expect(remoteControlMessageTypes).toEqual([
      'SCREEN_READY',
      'POINTER',
      'INPUT_RESULT',
      'KEEPALIVE',
      'KEEPALIVE_ACK',
      'SESSION_END',
    ]);
    expect(remoteControlProtocolMaxMessageBytes).toBe(4096);
    expect(remoteControlTopic).toBe('ter.remote-control.v1');
  });
});
