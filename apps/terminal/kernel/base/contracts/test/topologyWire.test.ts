import {describe, expect, it} from 'vitest'
import {isTopologyJsonValue, parseTopologyIdentityResponse, parseTopologyWireMessage, serializeTopologyWireMessage} from '../src/foundations/topologyWire'

const hello = {
  type: 'hello' as const,
  protocolVersion: 1 as const,
  wireId: 'hello-1',
  moduleName: 'ui.integration.sample-console',
  nodeId: 'node-1',
  displayName: 'TER',
  instanceMode: 'MASTER' as const,
  displayRole: 'CHIEF' as const,
}

const identity = {
  type: 'identity' as const,
  protocolVersion: 1 as const,
  moduleName: 'ui.integration.sample-console',
  nodeId: 'node-1',
  displayName: 'TER',
  instanceMode: 'MASTER' as const,
  displayRole: 'CHIEF' as const,
}

describe('topology wire contract', () => {
  it('round trips a complete hello without dropping fields', () => {
    expect(parseTopologyWireMessage(serializeTopologyWireMessage(hello))).toEqual(hello)
  })

  it('rejects unknown fields and unknown types', () => {
    expect(() => parseTopologyWireMessage(JSON.stringify({...hello, extra: true}))).toThrow()
    expect(() => parseTopologyWireMessage(JSON.stringify({...hello, type: 'fault-rules'}))).toThrow()
  })

  it('rejects a state-full-chunk message with an invalid direction', () => {
    expect(() => parseTopologyWireMessage(JSON.stringify({
      type: 'state-full-chunk', protocolVersion: 1, wireId: 'state-1',
      sliceName: 'kernel.base.runtime.request-ledger', direction: 'invalid-direction',
      revision: 1, transferId: 'transfer-1', index: 0, total: 1,
      codec: 'raw-base64', rawBytes: 2, encodedBytes: 4,
      checksum: 'fnv1a32:00000000', payload: 'e30=',
    }))).toThrow()
  })

  it('round trips every supported message shape and parses the HTTP identity separately', () => {
    const messages = [
      hello,
      {type: 'hello-accepted' as const, protocolVersion: 1 as const, wireId: 'accepted-1', moduleName: 'ui.integration.sample-console', nodeId: 'node-2'},
      {type: 'hello-rejected' as const, protocolVersion: 1 as const, wireId: 'rejected-1', error: {code: 'TOPOLOGY_ROLE_OCCUPIED' as const, retryable: false}},
      {type: 'command-request' as const, protocolVersion: 1 as const, wireId: 'command-1', requestId: null, commandId: 'command-id', parentCommandId: null, commandName: 'test.command', payload: {value: true}},
      {type: 'command-result' as const, protocolVersion: 1 as const, wireId: 'result-1', requestId: null, commandId: 'command-id', status: 'completed' as const, result: {value: true}, error: null},
      {type: 'command-cancel' as const, protocolVersion: 1 as const, wireId: 'cancel-1', requestId: null, commandId: 'command-id'},
      {type: 'state-full-chunk' as const, protocolVersion: 1 as const, wireId: 'state-1', sliceName: 'kernel.feature.sample-member-registry.members' as const, direction: 'master-to-slave' as const, revision: 1, transferId: 'transfer-1', index: 0, total: 1, codec: 'raw-base64' as const, rawBytes: 2, encodedBytes: 4, checksum: 'fnv1a32:00000000', payload: 'e30='},
      {type: 'ping' as const, protocolVersion: 1 as const, wireId: 'ping-1', sequence: 1},
      {type: 'pong' as const, protocolVersion: 1 as const, wireId: 'pong-1', sequence: 1},
      {type: 'closed-error' as const, protocolVersion: 1 as const, wireId: 'closed-1', error: {code: 'TOPOLOGY_UNPAIRED' as const, retryable: false}},
    ]
    for (const message of messages) {
      expect(parseTopologyWireMessage(serializeTopologyWireMessage(message))).toEqual(message)
    }
    expect(parseTopologyIdentityResponse(JSON.stringify(identity))).toEqual(identity)
    expect(() => parseTopologyIdentityResponse(JSON.stringify({...identity, surfaceForm: 'laptop'}))).toThrow()
  })

  it('does not turn state payload arrays into a hidden business cap while bounding command payload arrays', () => {
    const largeMembers = Array.from({length: 4_097}, (_, index) => index)
    expect(isTopologyJsonValue({members: largeMembers})).toBe(true)
    expect(() => parseTopologyWireMessage(JSON.stringify({
      type: 'command-request',
      protocolVersion: 1,
      wireId: 'command-large-payload',
      requestId: null,
      commandId: 'command-large-payload-id',
      parentCommandId: null,
      commandName: 'test.command',
      payload: largeMembers,
    }))).toThrow(/invalid topology command-request fields/)
  })

  it('rejects extra fields nested inside wire errors', () => {
    const extraError = {code: 'TOPOLOGY_ROLE_OCCUPIED', retryable: false, diagnostic: 'not allowed'}
    expect(() => parseTopologyWireMessage(JSON.stringify({
      type: 'hello-rejected', protocolVersion: 1, wireId: 'wire-1', error: extraError,
    }))).toThrow()
    expect(() => parseTopologyWireMessage(JSON.stringify({
      type: 'closed-error', protocolVersion: 1, wireId: 'wire-2', error: extraError,
    }))).toThrow()
    expect(() => parseTopologyWireMessage(JSON.stringify({
      type: 'command-result', protocolVersion: 1, wireId: 'wire-3', requestId: null,
      commandId: 'command-1', status: 'error', result: null, error: extraError,
    }))).toThrow()
  })

  it('measures the HTTP identity envelope in UTF-8 bytes rather than UTF-16 code units', () => {
    const oversizedUtf8Identity = JSON.stringify({...identity, displayName: '中'.repeat(22_000)})
    expect(oversizedUtf8Identity.length).toBeLessThan(64 * 1024)
    expect(new TextEncoder().encode(oversizedUtf8Identity).byteLength).toBeGreaterThan(64 * 1024)
    expect(() => parseTopologyIdentityResponse(oversizedUtf8Identity)).toThrow(/maximum size/)
  })
})
