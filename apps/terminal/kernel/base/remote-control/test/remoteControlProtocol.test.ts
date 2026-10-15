import {describe, expect, it} from 'vitest';
import {
  remoteControlMessageTypes,
  remoteControlProtocolMaxMessageBytes,
  remoteControlTopic,
  remoteControlScreenReadyScreenValues,
  remoteControlPointerScreenValues,
  remoteControlPointerPhaseValues,
  remoteControlInputResultStatusValues,
  remoteControlInputResultReasonValues,
  remoteControlSessionEndReasonValues,
} from '../src/generated/terminalRemoteControlProtocol';
import {parseRemoteControlMessage} from '../src/foundations/parseRemoteControlMessage';

const sessionId = '10000000-0000-4000-8000-000000000001';
const endpointId = '20000000-0000-4000-8000-000000000002';
const streamId = '30000000-0000-4000-8000-000000000003';
const gestureId = '40000000-0000-4000-8000-000000000004';
const parseMessage = (message: unknown) => parseRemoteControlMessage([...new TextEncoder().encode(JSON.stringify(message))]);

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

  it('accepts additive canonical enum values through the generated runtime consumer and rejects unknown values', () => {
    const cases = [
      {
        values: remoteControlScreenReadyScreenValues,
        added: 'screen-ready-additive',
        message: {type: 'SCREEN_READY', body: {endpointId, screen: 'screen-ready-additive', streamId, trackSid: 'track', widthPx: 1, heightPx: 1}},
      },
      {
        values: remoteControlPointerScreenValues,
        added: 'pointer-screen-additive',
        message: {type: 'POINTER', body: {endpointId, screen: 'pointer-screen-additive', streamId, gestureId, phase: 'down', u: 0, v: 0}},
      },
      {
        values: remoteControlPointerPhaseValues,
        added: 'pointer-phase-additive',
        message: {type: 'POINTER', body: {endpointId, screen: 'main', streamId, gestureId, phase: 'pointer-phase-additive', u: 0, v: 0}},
      },
      {
        values: remoteControlInputResultStatusValues,
        added: 'input-status-additive',
        message: {type: 'INPUT_RESULT', body: {forSeq: 1, gestureId, status: 'input-status-additive', reason: null}},
      },
      {
        values: remoteControlInputResultReasonValues,
        added: 'input-reason-additive',
        message: {type: 'INPUT_RESULT', body: {forSeq: 1, gestureId, status: 'DISPATCHED', reason: 'input-reason-additive'}},
      },
      {
        values: remoteControlSessionEndReasonValues,
        added: 'session-end-reason-additive',
        message: {type: 'SESSION_END', body: {reason: 'session-end-reason-additive'}},
      },
    ] as const;

    for (const {values, added, message} of cases) {
      const mutableValues = values as unknown as string[];
      mutableValues.push(added);
      try {
        expect(parseMessage({v: 1, type: message.type, sessionId, seq: 1, body: message.body}).kind).toBe('message');
      } finally {
        mutableValues.pop();
      }
    }

    expect(parseMessage({v: 1, type: 'SESSION_END', sessionId, seq: 1, body: {reason: 'unknown-reason'}}).kind).toBe('invalid');
  });
});
