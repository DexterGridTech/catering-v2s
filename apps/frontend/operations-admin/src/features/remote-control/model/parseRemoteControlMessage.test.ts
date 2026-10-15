import {describe, expect, it} from 'vitest';
import {parseRemoteControlMessage} from './parseRemoteControlMessage';

const sessionId = '3b241101-e2bb-4255-8caf-4136c566a962';
const endpointId = '431a2202-e3cc-4366-9daf-5247d677b073';
const streamId = '542b3313-f4dd-4477-aeb0-6358e788c184';
const gestureId = '653c4424-a5ee-4588-8fc1-7469f899d295';

function parse(message: Readonly<Record<string, unknown>>) {
  return parseRemoteControlMessage(new TextEncoder().encode(JSON.stringify(message)));
}

function envelope(type: string, body: Readonly<Record<string, unknown>>) {
  return {v: 1, type, sessionId, seq: 1, body};
}

describe('parseRemoteControlMessage', () => {
  it('uses generated enum values for every enum field', () => {
    expect(parse(envelope('SCREEN_READY', {
      endpointId, streamId, screen: 'main', trackSid: 'track-1', widthPx: 800, heightPx: 600,
    }))?.type).toBe('SCREEN_READY');
    expect(parse(envelope('POINTER', {
      endpointId, streamId, gestureId, screen: 'secondary', phase: 'cancel',
    }))?.type).toBe('POINTER');
    expect(parse(envelope('INPUT_RESULT', {
      forSeq: 1, gestureId, status: 'CANCELLED', reason: 'DUPLICATE',
    }))?.type).toBe('INPUT_RESULT');
    expect(parse(envelope('INPUT_RESULT', {
      forSeq: 1, gestureId, status: 'DISPATCHED', reason: null,
    }))?.type).toBe('INPUT_RESULT');
    expect(parse(envelope('SESSION_END', {reason: 'WORKSPACE_CLOSED'}))?.type).toBe('SESSION_END');
  });

  it('rejects unknown and non-string enum values without coercion', () => {
    expect(parse(envelope('SCREEN_READY', {
      endpointId, streamId, screen: 'future', trackSid: 'track-1', widthPx: 800, heightPx: 600,
    }))).toBeNull();
    expect(parse(envelope('SCREEN_READY', {
      endpointId, streamId, screen: ['main'], trackSid: 'track-1', widthPx: 800, heightPx: 600,
    }))).toBeNull();
    expect(parse(envelope('POINTER', {endpointId, streamId, gestureId, screen: 'main', phase: {value: 'down'}, u: 0.5, v: 0.5}))).toBeNull();
    expect(parse(envelope('INPUT_RESULT', {forSeq: 1, gestureId, status: 0, reason: null}))).toBeNull();
    expect(parse(envelope('SESSION_END', {reason: ['WORKSPACE_CLOSED']}))).toBeNull();
  });

  it('requires the nullable reason field and preserves pointer coordinate rules', () => {
    expect(parse(envelope('INPUT_RESULT', {forSeq: 1, gestureId, status: 'DISPATCHED'}))).toBeNull();
    expect(parse(envelope('POINTER', {endpointId, streamId, gestureId, screen: 'main', phase: 'cancel'}))?.type).toBe('POINTER');
    expect(parse(envelope('POINTER', {endpointId, streamId, gestureId, screen: 'main', phase: 'cancel', u: 0.25, v: 0.75}))?.type).toBe('POINTER');
    expect(parse(envelope('POINTER', {endpointId, streamId, gestureId, screen: 'main', phase: 'down'}))).toBeNull();
  });
});
