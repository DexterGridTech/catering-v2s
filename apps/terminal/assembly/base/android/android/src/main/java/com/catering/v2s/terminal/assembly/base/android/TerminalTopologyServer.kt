package com.catering.v2s.terminal.assembly.base.android

import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoWSD
import org.json.JSONObject
import java.io.IOException
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

internal class TerminalTopologyHeartbeatState(
  private val now: () -> Long,
) {
  @Volatile
  private var lastPongAt = now()

  fun markPong() {
    lastPongAt = now()
  }

  fun reset() {
    lastPongAt = now()
  }

  fun isTimedOut(timeoutMs: Long): Boolean = now() - lastPongAt > timeoutMs
}

private fun createDefaultHeartbeatExecutor(): ScheduledExecutorService =
  Executors.newSingleThreadScheduledExecutor { runnable ->
    Thread(runnable, "ter-topology-heartbeat").apply { isDaemon = true }
  }

class TerminalTopologyServer(
  private val config: TerminalTopologyHostRegistry.HostConfig,
  private val publish: (String, Map<String, Any?>) -> Unit,
  private val hostAddressResolver: () -> String = ::resolveHostAddress,
  private val clock: () -> Long = { System.currentTimeMillis() },
  private val heartbeatExecutor: ScheduledExecutorService = createDefaultHeartbeatExecutor(),
) : NanoWSD(config.port) {
  private val connectionSequence = AtomicLong(0L)
  private val heartbeatState = TerminalTopologyHeartbeatState(clock)
  private val peerLock = Any()
  private var peer: TopologySocket? = null
  private var heartbeatStarted = false
  private val hostAddress: String
    get() = hostAddressResolver()

  fun address(): Map<String, Any?> = mapOf(
    "host" to hostAddress,
    "port" to config.port,
    "basePath" to config.basePath,
    "httpBaseUrl" to "http://$hostAddress:${config.port}${config.basePath}",
    "wsUrl" to "ws://$hostAddress:${config.port}${config.basePath}/ws",
    "localHttpBaseUrl" to "http://127.0.0.1:${config.port}${config.basePath}",
    "localWsUrl" to "ws://127.0.0.1:${config.port}${config.basePath}/ws",
  )

  fun startHeartbeat() {
    synchronized(peerLock) {
      if (heartbeatStarted) return
      heartbeatStarted = true
      heartbeatExecutor.scheduleAtFixedRate({
        val current = synchronized(peerLock) { peer }
        if (current == null || !current.isOpen) return@scheduleAtFixedRate
        if (heartbeatState.isTimedOut(config.heartbeatTimeoutMs)) {
          try {
            current.close(NanoWSD.WebSocketFrame.CloseCode.GoingAway, "TOPOLOGY_TIMEOUT", false)
          } catch (_error: IOException) {
            // The peer is already gone; onClose will publish the close event.
          }
          return@scheduleAtFixedRate
        }
        try {
          current.ping(ByteArray(0))
        } catch (_error: IOException) {
          publishConnection("error", current.connectionId, "TOPOLOGY_PEER_UNREACHABLE")
        }
      }, config.heartbeatIntervalMs, config.heartbeatIntervalMs, TimeUnit.MILLISECONDS)
    }
  }

  fun sendFrame(raw: String) {
    val current = synchronized(peerLock) { peer }
      ?: throw IOException("topology peer is unavailable")
    current.send(raw)
  }

  fun closePeer() {
    val current = synchronized(peerLock) { peer } ?: return
    try {
      current.close(NanoWSD.WebSocketFrame.CloseCode.NormalClosure, "TOPOLOGY_HOST_STOPPED", false)
    } catch (_error: IOException) {
      // The peer is already closed.
    }
  }

  fun stats(): Map<String, Any> {
    val current = synchronized(peerLock) { peer }
    return mapOf(
      "sessionCount" to if (current?.isOpen == true) 1 else 0,
      "peerCount" to if (current?.isOpen == true) 1 else 0,
      "stalePeerCount" to 0,
    )
  }

  fun shutdown() {
    heartbeatExecutor.shutdownNow()
    closePeer()
    stop()
  }

  override fun serve(session: NanoHTTPD.IHTTPSession): NanoHTTPD.Response {
    if (session.uri == "${config.basePath}/status" && session.method == NanoHTTPD.Method.GET) {
      return NanoHTTPD.newFixedLengthResponse(
        NanoHTTPD.Response.Status.OK,
        "application/json; charset=utf-8",
        identityJson(),
      )
    }
    if (session.uri == "${config.basePath}/ws" && session.method == NanoHTTPD.Method.GET) {
      return super.serve(session)
    }
    val status = if (session.uri.startsWith(config.basePath)) {
      NanoHTTPD.Response.Status.METHOD_NOT_ALLOWED
    } else {
      NanoHTTPD.Response.Status.NOT_FOUND
    }
    return NanoHTTPD.newFixedLengthResponse(status, "text/plain; charset=utf-8", "topology endpoint unavailable")
  }

  override fun openWebSocket(handshake: NanoHTTPD.IHTTPSession): NanoWSD.WebSocket = TopologySocket(handshake)

  private fun identityJson(): String = JSONObject()
    .put("type", "identity")
    .put("protocolVersion", 1)
    .put("moduleName", config.moduleName)
    .put("nodeId", config.nodeId)
    .put("displayName", config.displayName)
    .put("instanceMode", config.instanceMode)
    .put("displayRole", config.displayRole)
    .toString()

  private fun publishConnection(event: String, connectionId: String, reason: String? = null) {
    val payload = buildMap<String, Any?> {
      put("event", event)
      put("connectionId", connectionId)
      reason?.let { put("reason", it) }
    }
    publish("onTopologyConnection", payload)
  }

  private inner class TopologySocket(handshake: NanoHTTPD.IHTTPSession) : NanoWSD.WebSocket(handshake) {
    val connectionId: String = "topology-connection-${connectionSequence.incrementAndGet()}"

    override fun onOpen() {
      synchronized(peerLock) {
        val existing = peer
        if (existing != null && existing.isOpen) {
          try {
            send(rejectionFrame())
            close(NanoWSD.WebSocketFrame.CloseCode.PolicyViolation, "TOPOLOGY_ROLE_OCCUPIED", false)
          } catch (_error: IOException) {
            // The rejected peer is already closed.
          }
          publishConnection("error", connectionId, "TOPOLOGY_ROLE_OCCUPIED")
          return
        }
        peer = this
        heartbeatState.reset()
      }
      publishConnection("open", connectionId)
    }

    override fun onClose(
      code: NanoWSD.WebSocketFrame.CloseCode?,
      reason: String?,
      initiatedByRemote: Boolean,
    ) {
      synchronized(peerLock) {
        if (peer === this) peer = null
      }
      publishConnection("close", connectionId, safeCloseReason(code, reason))
    }

    override fun onMessage(frame: NanoWSD.WebSocketFrame) {
      if (frame.opCode != NanoWSD.WebSocketFrame.OpCode.Text) {
        try {
          close(NanoWSD.WebSocketFrame.CloseCode.UnsupportedData, "TOPOLOGY_PROTOCOL_REJECTED", false)
        } catch (_error: IOException) {
          // The peer is already closed.
        }
        publishConnection("error", connectionId, "TOPOLOGY_PROTOCOL_REJECTED")
        return
      }
      val raw = frame.textPayload
      if (raw.length > 64 * 1024) {
        try {
          close(NanoWSD.WebSocketFrame.CloseCode.MessageTooBig, "TOPOLOGY_PROTOCOL_REJECTED", false)
        } catch (_error: IOException) {
          // The peer is already closed.
        }
        publishConnection("error", connectionId, "TOPOLOGY_PROTOCOL_REJECTED")
        return
      }
      publish(
        "onTopologyFrame",
        mapOf("connectionId" to connectionId, "raw" to raw),
      )
    }

    override fun onPong(frame: NanoWSD.WebSocketFrame) {
      synchronized(peerLock) { heartbeatState.markPong() }
    }

    override fun onException(exception: IOException) {
      publishConnection("error", connectionId, "TOPOLOGY_PEER_UNREACHABLE")
    }

    private fun rejectionFrame(): String = JSONObject()
      .put("type", "hello-rejected")
      .put("protocolVersion", 1)
      .put("wireId", "topology-rejection-${connectionSequence.incrementAndGet()}")
      .put("error", JSONObject().put("code", "TOPOLOGY_ROLE_OCCUPIED").put("retryable", false))
      .toString()

    private fun safeCloseReason(code: NanoWSD.WebSocketFrame.CloseCode?, reason: String?): String = when {
      reason == "TOPOLOGY_TIMEOUT" -> "TOPOLOGY_TIMEOUT"
      reason == "TOPOLOGY_ROLE_OCCUPIED" -> "TOPOLOGY_ROLE_OCCUPIED"
      reason == "TOPOLOGY_UNPAIRED" -> "TOPOLOGY_UNPAIRED"
      code == NanoWSD.WebSocketFrame.CloseCode.NormalClosure -> "TOPOLOGY_HOST_STOPPED"
      else -> "TOPOLOGY_PEER_UNREACHABLE"
    }
  }

}

private fun resolveHostAddress(): String {
  return try {
    val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
    interfaces.asSequence()
      .filter { it.isUp && !it.isLoopback }
      .flatMap { Collections.list(it.inetAddresses).asSequence() }
      .filterIsInstance<Inet4Address>()
      .firstOrNull { !it.isLoopbackAddress && !it.isLinkLocalAddress }
      ?.hostAddress
      ?: "127.0.0.1"
  } catch (_error: Throwable) {
    "127.0.0.1"
  }
}
