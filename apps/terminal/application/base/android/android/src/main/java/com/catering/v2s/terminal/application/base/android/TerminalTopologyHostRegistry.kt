package com.catering.v2s.terminal.application.base.android

import android.util.Log
import java.net.BindException

internal fun topologySocketReadTimeoutMs(heartbeatTimeoutMs: Long, heartbeatIntervalMs: Long): Int {
  require(heartbeatTimeoutMs > 0) { "heartbeatTimeoutMs must be positive" }
  require(heartbeatIntervalMs > 0) { "heartbeatIntervalMs must be positive" }
  val upperExclusive = Math.addExact(heartbeatTimeoutMs, heartbeatIntervalMs)
  val timeout = heartbeatTimeoutMs + heartbeatIntervalMs / 2
  require(timeout < upperExclusive && timeout <= Int.MAX_VALUE) {
    "topology socket read timeout is outside NanoHTTPD's supported range"
  }
  return timeout.toInt()
}

object TerminalTopologyHostRegistry {
  private const val LOG_TAG = "TER-Topology"

  private val lifecycleLock = Any()
  private val lock = Any()
  private var server: TerminalTopologyServer? = null
  private var config: HostConfig? = null
  private var currentState = "stopped"
  private var errorCode: String? = null
  private var errorMessage: String? = null
  private var publisher: ((String, Map<String, Any?>) -> Unit)? = null

  data class HostConfig(
    val port: Int,
    val basePath: String,
    val heartbeatIntervalMs: Long,
    val heartbeatTimeoutMs: Long,
    val nodeId: String,
    val moduleName: String,
    val displayName: String,
    val instanceMode: String,
    val displayRole: String,
  )

  fun registerPublisher(next: (String, Map<String, Any?>) -> Unit) {
    synchronized(lock) { publisher = next }
  }

  fun clearPublisher() {
    synchronized(lock) { publisher = null }
  }

  fun start(
    port: Int,
    basePath: String,
    heartbeatIntervalMs: Long,
    heartbeatTimeoutMs: Long,
    nodeId: String,
    moduleName: String,
    displayName: String,
    instanceMode: String,
    displayRole: String,
  ): Map<String, Any?> {
    val nextConfig = HostConfig(
      port = port,
      basePath = basePath,
      heartbeatIntervalMs = heartbeatIntervalMs,
      heartbeatTimeoutMs = heartbeatTimeoutMs,
      nodeId = nodeId,
      moduleName = moduleName,
      displayName = displayName,
      instanceMode = instanceMode,
      displayRole = displayRole,
    )
    return synchronized(lifecycleLock) {
      val (existing, sameConfig) = synchronized(lock) { server to (config == nextConfig) }
      if (existing != null && existing.isAlive && sameConfig) {
        synchronized(lock) { currentState = "running" }
        return@synchronized success(existing.address())
      }
      synchronized(lock) {
        if (server === existing) server = null
        config = nextConfig
        currentState = "starting"
        errorCode = null
        errorMessage = null
      }
      try {
        existing?.shutdown()
        val created = TerminalTopologyServer(
          config = nextConfig,
          publish = { eventName, payload -> publish(eventName, payload) },
        )
        created.start(topologySocketReadTimeoutMs(nextConfig.heartbeatTimeoutMs, nextConfig.heartbeatIntervalMs))
        created.startHeartbeat()
        synchronized(lock) {
          server = created
          currentState = "running"
        }
        Log.i(LOG_TAG, "event=topology-host-started port=${nextConfig.port}")
        success(created.address())
      } catch (error: Throwable) {
        val failureSnapshot = synchronized(lock) {
          server = null
          currentState = "error"
          if (isBindFailure(error)) {
            errorCode = "TOPOLOGY_HOST_PORT_OCCUPIED"
            errorMessage = "topology host port is occupied"
          } else {
            errorCode = "TOPOLOGY_HOST_FAILED"
            errorMessage = "topology host failed to start"
          }
          errorCode!! to errorMessage!!
        }
        Log.e(LOG_TAG, "event=topology-host-start-failed code=${failureSnapshot.first}")
        failure("start", failureSnapshot.first, failureSnapshot.second, retryable = failureSnapshot.first != "TOPOLOGY_HOST_PORT_OCCUPIED")
      }
    }
  }

  fun stop(): Map<String, Any?> {
    return synchronized(lifecycleLock) {
      val stopping = synchronized(lock) {
        val current = server
        server = null
        currentState = "stopped"
        errorCode = null
        errorMessage = null
        current
      }
      stopping?.shutdown()
      Log.i(LOG_TAG, "event=topology-host-stopped")
      success(mapOf("completed" to true))
    }
  }

  fun sendFrame(raw: String): Map<String, Any?> {
    val active = synchronized(lock) { server }
    if (active == null || !active.isAlive) return failure("sendFrame", "TOPOLOGY_UNAVAILABLE", "topology host is not running", true)
    return try {
      active.sendFrame(raw)
      success(mapOf("sent" to true))
    } catch (_error: Throwable) {
      failure("sendFrame", "TOPOLOGY_PEER_UNREACHABLE", "topology peer is unavailable", true)
    }
  }

  fun closePeer(reason: String = "TOPOLOGY_HOST_STOPPED"): Map<String, Any?> {
    val active = synchronized(lock) { server }
    active?.closePeer(reason)
    return success(mapOf("completed" to true))
  }

  fun status(): Map<String, Any?> {
    val snapshot = synchronized(lock) {
      StatusSnapshot(
        server = server,
        state = currentState,
        config = configMap(),
        errorCode = errorCode,
        errorMessage = errorMessage,
      )
    }
    val address = snapshot.server?.address()
    return mapOf(
      "status" to "succeeded",
      "value" to buildMap {
        put("state", snapshot.state)
        put("config", snapshot.config)
        address?.let { put("address", it) }
        snapshot.errorCode?.let { put("errorCode", it) }
        snapshot.errorMessage?.let { put("errorMessage", it) }
      },
      "completedAt" to System.currentTimeMillis(),
    )
  }

  fun diagnostics(): Map<String, Any?> {
    val snapshot = synchronized(lock) {
      server to mapOf(
        "status" to currentState,
        "config" to configMap(),
      )
    }
    return mapOf(
      "status" to "succeeded",
      "value" to mapOf(
        "status" to snapshot.second,
        "stats" to (snapshot.first?.stats() ?: mapOf("sessionCount" to 0, "peerCount" to 0, "stalePeerCount" to 0)),
        "capturedAt" to System.currentTimeMillis(),
      ),
      "completedAt" to System.currentTimeMillis(),
    )
  }

  private data class StatusSnapshot(
    val server: TerminalTopologyServer?,
    val state: String,
    val config: Map<String, Any>,
    val errorCode: String?,
    val errorMessage: String?,
  )

  private fun configMap(): Map<String, Any> {
    val current = config ?: return emptyMap()
    return mapOf(
      "port" to current.port,
      "basePath" to current.basePath,
      "heartbeatIntervalMs" to current.heartbeatIntervalMs,
      "heartbeatTimeoutMs" to current.heartbeatTimeoutMs,
    )
  }

  private fun success(value: Any?): Map<String, Any?> = mapOf(
    "status" to "succeeded",
    "value" to value,
    "completedAt" to System.currentTimeMillis(),
  )

  private fun failure(capability: String, code: String, message: String, retryable: Boolean): Map<String, Any?> = mapOf(
    "status" to "failed",
    "port" to "topologyHost",
    "capability" to capability,
    "error" to mapOf("code" to code, "message" to message, "retryable" to retryable),
  )

  private fun publish(eventName: String, payload: Map<String, Any?>) {
    synchronized(lock) { publisher }?.invoke(eventName, payload)
  }

  private fun isBindFailure(error: Throwable): Boolean {
    var current: Throwable? = error
    while (current != null) {
      if (current is BindException) return true
      current = current.cause
    }
    return false
  }
}
