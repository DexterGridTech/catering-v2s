import {describe, expect, it} from 'vitest'
import {parseTopologyIdentityResponse, parseTopologyWireMessage, serializeTopologyWireMessage} from '../src/foundations/topologyWire'

const hello = {
  type: 'hello' as const,
  protocolVersion: 1 as const,
  wireId: 'hello-1',
  nodeId: 'node-1',
  displayName: 'TER',
  instanceMode: 'MASTER' as const,
  displayRole: 'CHIEF' as const,
}

const identity = {
  type: 'identity' as const,
  protocolVersion: 1 as const,
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

  it('rejects a state-full message outside the allowed direction and slice', () => {
    expect(() => parseTopologyWireMessage(JSON.stringify({
      type: 'state-full', protocolVersion: 1, wireId: 'state-1',
      sliceName: 'kernel.base.runtime.request-ledger', direction: 'slave-to-master',
      revision: 1, value: {},
    }))).toThrow()
  })

  it('round trips every supported message shape and parses the HTTP identity separately', () => {
    const messages = [
      hello,
      {type: 'hello-accepted' as const, protocolVersion: 1 as const, wireId: 'accepted-1', nodeId: 'node-2'},
      {type: 'hello-rejected' as const, protocolVersion: 1 as const, wireId: 'rejected-1', error: {code: 'TOPOLOGY_ROLE_OCCUPIED' as const, retryable: false}},
      {type: 'command-request' as const, protocolVersion: 1 as const, wireId: 'command-1', requestId: null, commandId: 'command-id', parentCommandId: null, commandName: 'test.command', payload: {value: true}},
      {type: 'command-result' as const, protocolVersion: 1 as const, wireId: 'result-1', requestId: null, commandId: 'command-id', status: 'completed' as const, result: {value: true}, error: null},
      {type: 'command-cancel' as const, protocolVersion: 1 as const, wireId: 'cancel-1', requestId: null, commandId: 'command-id'},
      {type: 'state-full' as const, protocolVersion: 1 as const, wireId: 'state-1', sliceName: 'kernel.feature.sample-member-registry.members' as const, direction: 'master-to-slave' as const, revision: 1, value: {}},
      {type: 'ping' as const, protocolVersion: 1 as const, wireId: 'ping-1', sequence: 1},
      {type: 'pong' as const, protocolVersion: 1 as const, wireId: 'pong-1', sequence: 1},
      {type: 'closed-error' as const, protocolVersion: 1 as const, wireId: 'closed-1', error: {code: 'TOPOLOGY_HOST_FAILED' as const, retryable: true}},
    ]
    for (const message of messages) {
      expect(parseTopologyWireMessage(serializeTopologyWireMessage(message))).toEqual(message)
    }
    expect(parseTopologyIdentityResponse(JSON.stringify(identity))).toEqual(identity)
    expect(() => parseTopologyIdentityResponse(JSON.stringify({...identity, surfaceForm: 'laptop'}))).toThrow()
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
})
