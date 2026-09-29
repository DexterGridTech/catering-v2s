package com.catering.v2s.terminal.application.base.android

import java.io.DataInputStream
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
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

  @Test
  fun `production socket read timeout stays within the heartbeat interval window`() {
    val config = productionHeartbeatConfig()
    assertAcceptedProductionHeartbeatConfig(config)

    val readTimeoutMs = topologySocketReadTimeoutMs(config.heartbeatTimeoutMs, config.heartbeatIntervalMs)

    assertEquals(config.heartbeatTimeoutMs + config.heartbeatIntervalMs / 2, readTimeoutMs.toLong())
    assertTrue(readTimeoutMs >= config.heartbeatTimeoutMs)
    assertTrue(readTimeoutMs < config.heartbeatTimeoutMs + config.heartbeatIntervalMs)
  }

  @Test
  fun `production registry keeps a heartbeat-only control-pong socket alive`() {
    val port = freePort()
    val timeoutMs = 1_000L
    val intervalMs = 200L
    try {
      startRegistry(port, intervalMs, timeoutMs)
      openWebSocket(port).use { connection ->
        val endAt = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(2_300L)
        var pongCount = 0
        while (System.nanoTime() < endAt) {
          val (opcode, payload) = readWebSocketFrame(connection.input)
          assertTrue("server closed while the peer replied to control pings", opcode != 0x8)
          assertEquals("heartbeat-only window emitted a non-control frame", 0x9, opcode)
          writeMaskedFrame(connection.output, 0xA, payload)
          pongCount += 1
        }
        assertTrue("expected multiple control Ping/Pong exchanges", pongCount >= 5)
      }
    } finally {
      stopRegistryAndClearPublisher()
    }
  }

  @Test
  fun `production registry lock paths complete without a reverse lock cycle in ten fresh JVMs`() {
    val java = java.io.File(System.getProperty("java.home"), "bin/java").absolutePath
    val classpath = System.getProperty("java.class.path")
    val results = (1..10).map { attempt ->
      val process = ProcessBuilder(
        java,
        "-cp",
        classpath,
        TerminalTopologyLockOrderProbe::class.java.name,
      ).redirectErrorStream(true).start()
      val completed = process.waitFor(5, TimeUnit.SECONDS)
      if (!completed) process.destroyForcibly().waitFor()
      val output = process.inputStream.bufferedReader().readText().trim()
      "attempt=$attempt exit=${if (completed) process.exitValue() else "TIMEOUT"} output=$output"
    }

    assertTrue("lock-order probe failed in one or more fresh JVMs:\n${results.joinToString("\n")}", results.all {
      it.contains("exit=0") && it.contains("A9_LOCK_ORDER_COMPLETED")
    })
  }

  @Test
  fun `production registry close reasons match local intent and peer origin table`() {
    assertCloseReasonCase("TOPOLOGY_HOST_STOPPED") { _, _ -> TerminalTopologyHostRegistry.stop() }
    assertCloseReasonCase("TOPOLOGY_HOST_STOPPED") { _, _ -> TerminalTopologyHostRegistry.closePeer() }
    assertCloseReasonCase("TOPOLOGY_UNPAIRED") { _, _ -> TerminalTopologyHostRegistry.closePeer("TOPOLOGY_UNPAIRED") }
    assertCloseReasonCase("TOPOLOGY_UNPAIRED", expectedPeerCloseReply = "TOPOLOGY_UNPAIRED") { _, peer ->
      writeMaskedFrame(peer.output, 0x8, closePayload("TOPOLOGY_UNPAIRED"))
    }
    assertCloseReasonCase("TOPOLOGY_PEER_UNREACHABLE") { _, peer ->
      writeMaskedFrame(peer.output, 0x8, closePayload("UNRECOGNIZED_REMOTE_REASON"))
    }
    assertCloseReasonCase("TOPOLOGY_PEER_UNREACHABLE") { _, peer ->
      writeMaskedFrame(peer.output, 0x8, byteArrayOf(0x03.toByte(), 0xE8.toByte()))
    }
    assertCloseReasonCase("TOPOLOGY_PEER_UNREACHABLE", expectPeerCloseHandshake = false) { _, peer ->
      peer.socket.close()
    }
    assertLocalCloseIntentWinsOverConflictingPeerReason()

    val port = freePort()
    val events = CopyOnWriteArrayList<ConnectionEvent>()
    TerminalTopologyHostRegistry.registerPublisher { event, payload ->
      if (event == "onTopologyConnection") events += ConnectionEvent(
        event = payload["event"] as? String ?: "",
        connectionId = payload["connectionId"] as? String ?: "",
        reason = payload["reason"] as? String,
      )
    }
    try {
      startRegistry(port, 10_000L, 30_000L)
      openWebSocket(port).use { accepted ->
        val priorEvents = events.size
        openWebSocket(port).use {
          // The occupied peer receives a rejection text frame before the close handshake.
          readUntilCloseAndRespond(it)
          val rejected = awaitValue(2_000L, "occupied role did not publish its rejected close") {
            events.drop(priorEvents).firstOrNull {
              it.event == "close" && it.reason == "TOPOLOGY_ROLE_OCCUPIED"
            }
          }
          assertEquals("TOPOLOGY_ROLE_OCCUPIED", rejected.reason)
        }
        assertTrue(accepted.socket.isConnected)
      }
    } finally {
      stopRegistryAndClearPublisher()
    }
  }

  @Test
  fun `production registry closes half-open sockets and reclaims request threads across twenty cycles`() {
    val port = freePort()
    val timeoutMs = 500L
    val intervalMs = 100L
    val events = CopyOnWriteArrayList<ConnectionEvent>()
    TerminalTopologyHostRegistry.registerPublisher { event, payload ->
      if (event == "onTopologyConnection") {
        events += ConnectionEvent(
          event = payload["event"] as? String ?: "",
          connectionId = payload["connectionId"] as? String ?: "",
          reason = payload["reason"] as? String,
        )
      }
    }
    try {
      val started = TerminalTopologyHostRegistry.start(
        port = port,
        basePath = "/terminal-topology",
        heartbeatIntervalMs = intervalMs,
        heartbeatTimeoutMs = timeoutMs,
        nodeId = "jvm-cycle-test",
        moduleName = "application.base.android",
        displayName = "TER JVM test",
        instanceMode = "MASTER",
        displayRole = "CHIEF",
      )
      assertEquals("succeeded", started["status"])
      awaitCondition(2_000L, "NanoHTTPD listener/heartbeat threads did not start") {
        topologyThreadCount() >= 2
      }
      val baseline = topologyThreadCount()
      repeat(20) { cycle ->
        val priorEventCount = events.size
        openWebSocket(port).use { connection ->
          val openEvent = awaitValue(timeoutMs + intervalMs, "cycle $cycle did not publish an open event") {
            events.drop(priorEventCount).firstOrNull { it.event == "open" }
          }
          val connectionId = openEvent.connectionId
          if (cycle < 5) {
            val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs + intervalMs + 250L)
            var socketClosed = false
            while (!socketClosed && System.nanoTime() < deadline) {
              try {
                readWebSocketFrame(connection.input)
              } catch (_error: java.io.EOFException) {
                socketClosed = true
              }
            }
            assertTrue("half-open cycle $cycle remained connected past its bounded window", socketClosed)
          } else {
            writeMaskedFrame(connection.output, 0x8, byteArrayOf(0x03.toByte(), 0xE8.toByte()))
            val closeDeadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(1_000L)
            var serverClosed = false
            while (!serverClosed && System.nanoTime() < closeDeadline) {
              try {
                val (opcode, _) = readWebSocketFrame(connection.input)
                serverClosed = opcode == 0x8
              } catch (_error: java.io.EOFException) {
                serverClosed = true
              }
            }
            assertTrue("normal cycle $cycle did not close", serverClosed)
          }
          awaitCondition(timeoutMs + intervalMs, "cycle $cycle close event was not published") {
            events.any { it.event == "close" && it.connectionId == connectionId }
          }
          if (cycle < 5) {
            assertTrue("half-open cycle $cycle did not publish a timeout cause", events.any {
              it.event == "close" && it.connectionId == connectionId && it.reason == "TOPOLOGY_TIMEOUT"
            })
          }
        }
      }
      awaitCondition(timeoutMs + intervalMs, "topology request threads did not return to baseline") {
        topologyThreadCount() == baseline
      }
      assertEquals("topology request/heartbeat thread count changed", baseline, topologyThreadCount())
    } finally {
      stopRegistryAndClearPublisher()
    }
  }

  @Test
  fun `production registry keeps a heartbeat-only socket alive for three production timeouts`() {
    val config = productionHeartbeatConfig()
    assertAcceptedProductionHeartbeatConfig(config)
    val minimumDurationMs = Math.multiplyExact(config.heartbeatTimeoutMs, 3L)
    assertEquals("TP-A7 production heartbeat window", 90_000L, minimumDurationMs)
    val readTimeoutMs = topologySocketReadTimeoutMs(config.heartbeatTimeoutMs, config.heartbeatIntervalMs)
    val port = ServerSocket(0).use { it.localPort }
    val pongCount = AtomicInteger()
    val closeReason = java.util.concurrent.atomic.AtomicReference<String?>()
    TerminalTopologyHostRegistry.registerPublisher { event, payload ->
      if (event == "onTopologyConnection" && payload["event"] == "close") {
        closeReason.set(payload["reason"] as? String)
      }
    }
    try {
      val started = TerminalTopologyHostRegistry.start(
        port = port,
        basePath = "/terminal-topology",
        heartbeatIntervalMs = config.heartbeatIntervalMs,
        heartbeatTimeoutMs = config.heartbeatTimeoutMs,
        nodeId = "jvm-heartbeat-test",
        moduleName = "application.base.android",
        displayName = "TER JVM test",
        instanceMode = "MASTER",
        displayRole = "CHIEF",
      )
      assertEquals("succeeded", started["status"])
      Socket("127.0.0.1", port).use { socket ->
        socket.soTimeout = readTimeoutMs
        val input = DataInputStream(socket.getInputStream())
        val output = socket.getOutputStream()
        output.write(("GET /terminal-topology/ws HTTP/1.1\r\n"
          + "Host: 127.0.0.1:$port\r\n"
          + "Upgrade: websocket\r\n"
          + "Connection: Upgrade\r\n"
          + "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
          + "Sec-WebSocket-Version: 13\r\n\r\n").toByteArray(StandardCharsets.US_ASCII))
        output.flush()
        val response = readHttpHeaders(input)
        assertTrue("expected production NanoWSD upgrade, got $response", response.startsWith("HTTP/1.1 101"))

        val startedAt = System.nanoTime()
        val minimumNanos = TimeUnit.MILLISECONDS.toNanos(minimumDurationMs)
        while (System.nanoTime() - startedAt < minimumNanos) {
          val (opcode, payload) = readWebSocketFrame(input)
          assertTrue("server closed heartbeat-only connection early: $closeReason", opcode != 0x8)
          assertEquals("heartbeat-only window emitted a non-control frame", 0x9, opcode)
          writeMaskedFrame(output, 0xA, payload)
          pongCount.incrementAndGet()
        }
      }
      val expectedMinimumPongs = (minimumDurationMs / config.heartbeatIntervalMs - 1L).coerceAtLeast(1L)
      assertTrue("server did not send control heartbeats", pongCount.get() >= expectedMinimumPongs)
      assertEquals(null, closeReason.get())
    } finally {
      stopRegistryAndClearPublisher()
    }
  }

  private fun readHttpHeaders(input: DataInputStream): String {
    val bytes = ArrayList<Byte>()
    while (bytes.size < 16 * 1024) {
      bytes.add(input.readByte())
      val size = bytes.size
      if (size >= 4 && bytes[size - 4] == '\r'.code.toByte() && bytes[size - 3] == '\n'.code.toByte()
        && bytes[size - 2] == '\r'.code.toByte() && bytes[size - 1] == '\n'.code.toByte()) {
        return bytes.toByteArray().toString(StandardCharsets.US_ASCII)
      }
    }
    throw AssertionError("websocket handshake headers exceeded limit")
  }

  private fun startRegistry(port: Int, intervalMs: Long, timeoutMs: Long) {
    try {
      val started = TerminalTopologyHostRegistry.start(
        port = port,
        basePath = "/terminal-topology",
        heartbeatIntervalMs = intervalMs,
        heartbeatTimeoutMs = timeoutMs,
        nodeId = "jvm-window-test",
        moduleName = "application.base.android",
        displayName = "TER JVM test",
        instanceMode = "MASTER",
        displayRole = "CHIEF",
      )
      assertEquals("succeeded", started["status"])
    } catch (failure: Throwable) {
      try {
        TerminalTopologyHostRegistry.stop()
      } finally {
        TerminalTopologyHostRegistry.clearPublisher()
      }
      throw failure
    }
  }

  private fun stopRegistryAndClearPublisher() {
    try {
      TerminalTopologyHostRegistry.stop()
    } finally {
      TerminalTopologyHostRegistry.clearPublisher()
    }
  }

  private fun productionHeartbeatConfig(): ProductionHeartbeatConfig {
    val repositoryRoot = Path.of(
      System.getProperty("ter.repositoryRoot")
        ?: throw AssertionError("missing explicit TER repository root for production topology config"),
    ).toRealPath()
    assertTrue("TER repository root marker missing", Files.isRegularFile(repositoryRoot.resolve("AGENTS.md")))
    assertTrue("TER project-memory root marker missing", Files.isRegularFile(repositoryRoot.resolve("project-memory/index.md")))
    val configPath = repositoryRoot.resolve("apps/terminal/kernel/base/contracts/topology-transport.config.json").normalize()
    assertTrue("production topology config escaped the TER repository", configPath.startsWith(repositoryRoot))
    val path = configPath.toRealPath()
    assertTrue("production topology config symlink escaped the TER repository", path.startsWith(repositoryRoot))
    val jsonText = path.toFile().readText(StandardCharsets.UTF_8)
    val json = JSONObject(jsonText)
    return ProductionHeartbeatConfig(
      heartbeatIntervalMs = json.get("heartbeatIntervalMs").toString().toLong(),
      heartbeatTimeoutMs = json.get("heartbeatTimeoutMs").toString().toLong(),
    )
  }

  private fun assertAcceptedProductionHeartbeatConfig(config: ProductionHeartbeatConfig) {
    // These accepted production-contract values must not be inherited silently
    // from the file under test: a config reduction must not shorten this test.
    assertEquals("accepted production heartbeat interval", 10_000L, config.heartbeatIntervalMs)
    assertEquals("accepted production heartbeat timeout", 30_000L, config.heartbeatTimeoutMs)
  }

  private data class ProductionHeartbeatConfig(
    val heartbeatIntervalMs: Long,
    val heartbeatTimeoutMs: Long,
  )

  private fun assertCloseReasonCase(
    expectedReason: String,
    expectedPeerCloseReply: String? = null,
    expectPeerCloseHandshake: Boolean = true,
    trigger: (Int, TestWebSocket) -> Unit,
  ) {
    val port = freePort()
    val events = CopyOnWriteArrayList<ConnectionEvent>()
    TerminalTopologyHostRegistry.registerPublisher { event, payload ->
      if (event == "onTopologyConnection") events += ConnectionEvent(
        event = payload["event"] as? String ?: "",
        connectionId = payload["connectionId"] as? String ?: "",
        reason = payload["reason"] as? String,
      )
    }
    try {
      startRegistry(port, 10_000L, 30_000L)
      openWebSocket(port).use { peer ->
        val opened = awaitValue(2_000L, "production registry did not publish open") {
          events.firstOrNull { it.event == "open" }
        }
        trigger(port, peer)
        if (expectPeerCloseHandshake) {
          val peerCloseReply = readUntilCloseAndRespond(peer)
          expectedPeerCloseReply?.let {
            assertEquals("server did not echo the valid peer close reason", it, peerCloseReply)
          }
        }
        val closed = awaitValue(2_000L, "production registry did not publish close for $expectedReason") {
          events.firstOrNull { it.event == "close" && it.connectionId == opened.connectionId }
        }
        assertEquals("close origin mapped incorrectly; events=$events", expectedReason, closed.reason)
      }
    } finally {
      stopRegistryAndClearPublisher()
    }
  }

  private fun closePayload(reason: String): ByteArray {
    val reasonBytes = reason.toByteArray(StandardCharsets.UTF_8)
    return byteArrayOf(0x03.toByte(), 0xE8.toByte()) + reasonBytes
  }

  private fun assertLocalCloseIntentWinsOverConflictingPeerReason() {
    val port = freePort()
    val events = CopyOnWriteArrayList<ConnectionEvent>()
    TerminalTopologyHostRegistry.registerPublisher { event, payload ->
      if (event == "onTopologyConnection") events += ConnectionEvent(
        event = payload["event"] as? String ?: "",
        connectionId = payload["connectionId"] as? String ?: "",
        reason = payload["reason"] as? String,
      )
    }
    try {
      startRegistry(port, 10_000L, 30_000L)
      openWebSocket(port).use { peer ->
        val opened = awaitValue(2_000L, "production registry did not publish open") {
          events.firstOrNull { it.event == "open" }
        }
        TerminalTopologyHostRegistry.closePeer("TOPOLOGY_HOST_STOPPED")
        val serverCloseReason = readUntilCloseAndRespond(peer, "TOPOLOGY_UNPAIRED")
        assertEquals("TOPOLOGY_HOST_STOPPED", serverCloseReason)
        val closed = awaitValue(2_000L, "production registry did not publish close after conflicting peer reason") {
          events.firstOrNull { it.event == "close" && it.connectionId == opened.connectionId }
        }
        assertEquals("valid peer reason must not override a present local close intent", "TOPOLOGY_HOST_STOPPED", closed.reason)
      }
    } finally {
      stopRegistryAndClearPublisher()
    }
  }

  private fun readUntilCloseAndRespond(peer: TestWebSocket, responseReason: String? = null): String {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(1_500L)
    while (System.nanoTime() < deadline) {
      val frame = readWebSocketFrame(peer.input)
      if (frame.first == 0x8) {
        val closeReply = frame.second.drop(2).toByteArray().toString(StandardCharsets.UTF_8)
        if (responseReason == null) {
          try {
            writeMaskedFrame(peer.output, 0x8, frame.second)
          } catch (_error: java.io.IOException) {
            // NanoWSD may already have closed the transport after publishing onClose.
          }
        } else {
          writeMaskedFrame(peer.output, 0x8, closePayload(responseReason))
        }
        return closeReply
      }
    }
    throw AssertionError("server did not complete the WebSocket close handshake")
  }

  private fun freePort(): Int = ServerSocket(0).use { it.localPort }

  private fun openWebSocket(port: Int, soTimeoutMs: Int = 1_500): TestWebSocket {
    val socket = Socket("127.0.0.1", port)
    socket.soTimeout = soTimeoutMs
    val input = DataInputStream(socket.getInputStream())
    val output = socket.getOutputStream()
    output.write(("GET /terminal-topology/ws HTTP/1.1\r\n"
      + "Host: 127.0.0.1:$port\r\n"
      + "Upgrade: websocket\r\n"
      + "Connection: Upgrade\r\n"
      + "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
      + "Sec-WebSocket-Version: 13\r\n\r\n").toByteArray(StandardCharsets.US_ASCII))
    output.flush()
    val response = readHttpHeaders(input)
    assertTrue("expected production NanoWSD upgrade, got $response", response.startsWith("HTTP/1.1 101"))
    return TestWebSocket(socket, input, output)
  }

  private fun topologyThreadCount(): Int = Thread.getAllStackTraces().keys.count { thread ->
    thread.isAlive && (thread.name == "NanoHttpd Main Listener"
      || thread.name.startsWith("NanoHttpd Request Processor (#")
      || thread.name == "ter-topology-heartbeat")
  }

  private fun awaitCondition(timeoutMs: Long, failureMessage: String, condition: () -> Boolean) {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
    while (!condition() && System.nanoTime() < deadline) Thread.sleep(10)
    assertTrue(failureMessage, condition())
  }

  private fun <T : Any> awaitValue(timeoutMs: Long, failureMessage: String, value: () -> T?): T {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
    var result = value()
    while (result == null && System.nanoTime() < deadline) {
      Thread.sleep(10)
      result = value()
    }
    return result ?: throw AssertionError(failureMessage)
  }

  private data class ConnectionEvent(val event: String, val connectionId: String, val reason: String?)

  private data class TestWebSocket(
    val socket: Socket,
    val input: DataInputStream,
    val output: java.io.OutputStream,
  ) : AutoCloseable {
    override fun close() = socket.close()
  }

  private fun readWebSocketFrame(input: DataInputStream): Pair<Int, ByteArray> {
    val first = input.readUnsignedByte()
    val opcode = first and 0x0f
    val second = input.readUnsignedByte()
    var length = (second and 0x7f).toLong()
    if (length == 126L) length = input.readUnsignedShort().toLong()
    if (length == 127L) length = input.readLong()
    if (opcode == 0x8 || opcode == 0x9 || opcode == 0xA) {
      assertTrue("unexpectedly large server control frame", length <= 125)
    } else {
      assertTrue("unexpectedly large server data frame", length <= 64 * 1024)
    }
    val mask = (second and 0x80) != 0
    val maskKey = if (mask) ByteArray(4).also { input.readFully(it) } else null
    val payload = ByteArray(length.toInt()).also { input.readFully(it) }
    if (maskKey != null) payload.indices.forEach { index -> payload[index] = (payload[index].toInt() xor maskKey[index % 4].toInt()).toByte() }
    return opcode to payload
  }

  private fun writeMaskedFrame(output: java.io.OutputStream, opcode: Int, payload: ByteArray) {
    val mask = byteArrayOf(0x21, 0x43, 0x65, 0x07)
    output.write(0x80 or opcode)
    output.write(0x80 or payload.size)
    output.write(mask)
    payload.forEachIndexed { index, byte -> output.write(byte.toInt() xor mask[index % 4].toInt()) }
    output.flush()
  }

  private fun testConfig() = TerminalTopologyHostRegistry.HostConfig(
    port = 43_172,
    basePath = "/terminal-topology",
    heartbeatIntervalMs = 10_000L,
    heartbeatTimeoutMs = 30_000L,
    nodeId = "test-node",
    moduleName = "application.base.android",
    displayName = "TER test",
    instanceMode = "MASTER",
    displayRole = "CHIEF",
  )
}
