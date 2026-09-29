import assert from 'node:assert/strict'
import net from 'node:net'
import test from 'node:test'
import {createTcpBridge} from '../../tools/terminal-topology/tcp-bridge.mjs'
import {
  prepareMemberJourneySurface,
  memberJourneyCustomerSurfaceReady,
} from '../../tools/terminal-topology/member-journey-admission.mjs'
import {
  memberFinancialProbeId,
  memberSubmitId,
  submitMemberFormWithClosedKeyboard,
  virtualKeyboardCompleteId,
} from '../../tools/terminal-topology/member-form-submit.mjs'

const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    server.off('error', reject)
    resolve(server.address().port)
  })
})

const connect = (port, allowHalfOpen = false) => new Promise((resolve, reject) => {
  const socket = net.connect({host: '127.0.0.1', port, allowHalfOpen})
  socket.once('connect', () => resolve(socket))
  socket.once('error', reject)
})

test('disconnect closes existing TCP sessions and resume permits a fresh session', async () => {
  const upstreamServer = net.createServer(socket => socket.pipe(socket))
  const upstreamPort = await listen(upstreamServer)
  const bridge = createTcpBridge({listenHost: '127.0.0.1', listenPort: 0, targetHost: '127.0.0.1', targetPort: upstreamPort})
  try {
    const address = await bridge.listen()
    const first = await connect(address.port)
    await new Promise((resolve, reject) => {
      first.once('data', resolve)
      first.once('error', reject)
      first.write('connected')
    })
    assert.equal(bridge.activeConnections, 1)
    assert.equal(bridge.pause(), 1)
    await new Promise((resolve, reject) => {
      first.once('close', resolve)
      first.once('error', reject)
    })
    assert.equal(bridge.activeConnections, 0)
    bridge.resume()
    const second = await connect(address.port)
    second.destroy()
  } finally {
    await bridge.close()
    await new Promise(resolve => upstreamServer.close(resolve))
  }
})

test('closing the upstream side also closes and accounts for the accepted client', async () => {
  let acceptedUpstream = null
  const upstreamServer = net.createServer({allowHalfOpen: true}, socket => {
    acceptedUpstream = socket
    socket.on('data', chunk => socket.write(chunk))
  })
  const upstreamPort = await listen(upstreamServer)
  const bridge = createTcpBridge({listenHost: '127.0.0.1', listenPort: 0, targetHost: '127.0.0.1', targetPort: upstreamPort})
  try {
    const address = await bridge.listen()
    const client = await connect(address.port, true)
    await new Promise((resolve, reject) => {
      client.once('data', resolve)
      client.once('error', reject)
      client.write('connected')
    })
    assert.equal(bridge.activeConnections, 1)
    const upstreamClosed = new Promise(resolve => acceptedUpstream.once('close', resolve))
    acceptedUpstream.destroySoon()
    await upstreamClosed
    const bridgeClosed = bridge.close()
    let timeout
    await Promise.race([
      bridgeClosed,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('bridge cleanup did not close its accepted client')), 1_000) }),
    ]).finally(() => clearTimeout(timeout))
    assert.equal(bridge.activeConnections, 0)
  } finally {
    await bridge.close()
    await new Promise(resolve => upstreamServer.close(resolve))
  }
})

test('member submit closes the final sample-only keyboard before tapping submit', async () => {
  const actions = []
  await submitMemberFormWithClosedKeyboard({
    tap: async testId => actions.push(`tap:${testId}`),
    waitForKeyboardClosed: async () => actions.push('wait:keyboard-absent'),
  })
  assert.deepEqual(actions, [
    `tap:${memberFinancialProbeId}`,
    `tap:${virtualKeyboardCompleteId}`,
    'wait:keyboard-absent',
    `tap:${memberSubmitId}`,
  ])
})

test('member journey closes both Admin overlays before reading the slave customer surface', async () => {
  const events = []
  const openAdminTargets = new Set(['master', 'slave'])
  await prepareMemberJourneySurface({
    master: 'master',
    slave: 'slave',
    closeAdmin: async target => {
      events.push(`close:${target}`)
      openAdminTargets.delete(target)
    },
    assertCustomerSurface: async target => {
      assert.equal(target, 'slave')
      assert.deepEqual([...openAdminTargets], [])
      events.push(`surface:${target}`)
    },
  })
  assert.deepEqual(events, ['close:master', 'close:slave', 'surface:slave'])
})

test('member journey customer surface rejects a welcome node covered by the Admin layer', () => {
  const covered = '<node resource-id="sample.desk.customer-welcome"></node><node resource-id="ui-base-render:layer:admin.console.layer"></node>'
  const exposed = '<node resource-id="sample.desk.customer-welcome"></node>'
  assert.equal(memberJourneyCustomerSurfaceReady(covered), false)
  assert.equal(memberJourneyCustomerSurfaceReady(exposed), true)
  assert.equal(memberJourneyCustomerSurfaceReady('<node resource-id="sample.desk.customer-member"></node>'), false)
})
