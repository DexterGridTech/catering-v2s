package com.catering.v2s.terminal.assembly.base.android

import java.util.concurrent.ScheduledThreadPoolExecutor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalTopologyServerTest {
  @Test
  fun `heartbeat state uses an injected clock and observes pong across calls`() {
    var now = 1_000L
    val state = TerminalTopologyHeartbeatState { now }

    now = 1_000L + 29_999L
    assertFalse(state.isTimedOut(30_000L))
    now += 2L
    assertTrue(state.isTimedOut(30_000L))
    state.markPong()
    assertFalse(state.isTimedOut(30_000L))
  }

  @Test
  fun `server address reads the injected resolver instead of caching construction time`() {
    var host = "192.0.2.10"
    val executor = ScheduledThreadPoolExecutor(1)
    val server = TerminalTopologyServer(
      config = testConfig(),
      publish = { _, _ -> },
      hostAddressResolver = { host },
      clock = { 1_000L },
      heartbeatExecutor = executor,
    )

    try {
      assertEquals("192.0.2.10", server.address()["host"])
      host = "192.0.2.11"
      assertEquals("192.0.2.11", server.address()["host"])
    } finally {
      executor.shutdownNow()
    }
  }

  private fun testConfig() = TerminalTopologyHostRegistry.HostConfig(
    port = 43_172,
    basePath = "/terminal-topology",
    heartbeatIntervalMs = 10_000L,
    heartbeatTimeoutMs = 30_000L,
    nodeId = "test-node",
    displayName = "TER test",
    instanceMode = "MASTER",
    displayRole = "CHIEF",
  )
}
