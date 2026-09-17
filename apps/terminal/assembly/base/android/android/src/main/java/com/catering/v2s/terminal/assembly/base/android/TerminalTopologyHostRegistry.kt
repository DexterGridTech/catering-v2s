package com.catering.v2s.terminal.assembly.base.android

import android.util.Log
import java.net.BindException

object TerminalTopologyHostRegistry {
  private const val LOG_TAG = "TER-Topology"
  private const val DEFAULT_PORT = 43172
  private const val DEFAULT_BASE_PATH = "/terminal-topology"
  private const val DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000L
  private const val DEFAULT_HEARTBEAT_TIMEOUT_MS = 30_000L

  private val lock = Any()
  private var server: TerminalTopologyServer? = null
  private var config: HostConfig = HostConfig(
    port = DEFAULT_PORT,
    basePath = DEFAULT_BASE_PATH,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS,
    nodeId = "",
    displayName = "",
    instanceMode = "MASTER",
    displayRole = "CHIEF",
  )
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
      displayName = displayName,
      instanceMode = instanceMode,
      displayRole = displayRole,
    )
    synchronized(lock) {
      val existing = server
      if (existing != null && existing.isAlive && config == nextConfig) {
        currentState = "running"
        return success(existing.address())
      }
      if (existing != null) {
        existing.shutdown()
        server = null
      }
      config = nextConfig
      currentState = "starting"
      errorCode = null
      errorMessage = null
      try {
        val created = TerminalTopologyServer(nextConfig) { eventName, payload -> publish(eventName, payload) }
        created.start()
        created.startHeartbeat()
        server = created
        currentState = "running"
        Log.i(LOG_TAG, "event=topology-host-started port=${nextConfig.port}")
        return success(created.address())
      } catch (error: Throwable) {
        server = null
        currentState = "error"
        if (isBindFailure(error)) {
          errorCode = "TOPOLOGY_HOST_PORT_OCCUPIED"
          errorMessage = "topology host port is occupied"
        } else {
          errorCode = "TOPOLOGY_HOST_FAILED"
          errorMessage = "topology host failed to start"
        }
        Log.e(LOG_TAG, "event=topology-host-start-failed code=$errorCode")
        return failure("start", errorCode!!, errorMessage!!, retryable = errorCode != "TOPOLOGY_HOST_PORT_OCCUPIED")
      }
    }
  }

  fun stop(): Map<String, Any?> {
    synchronized(lock) {
      server?.shutdown()
      server = null
      currentState = "stopped"
      errorCode = null
      errorMessage = null
      Log.i(LOG_TAG, "event=topology-host-stopped")
      return success(mapOf("completed" to true))
    }
  }

  fun sendFrame(raw: String): Map<String, Any?> {
    synchronized(lock) {
      val active = server
      if (active == null || !active.isAlive) return failure("sendFrame", "TOPOLOGY_UNAVAILABLE", "topology host is not running", true)
      return try {
        active.sendFrame(raw)
        success(mapOf("sent" to true))
      } catch (_error: Throwable) {
        failure("sendFrame", "TOPOLOGY_PEER_UNREACHABLE", "topology peer is unavailable", true)
      }
    }
  }

  fun closePeer(): Map<String, Any?> {
    synchronized(lock) {
      server?.closePeer()
      return success(mapOf("completed" to true))
    }
  }

  fun status(): Map<String, Any?> = synchronized(lock) {
    mapOf(
      "status" to "succeeded",
      "value" to statusValue(),
      "completedAt" to System.currentTimeMillis(),
    )
  }

  fun diagnostics(): Map<String, Any?> = synchronized(lock) {
    mapOf(
      "status" to "succeeded",
      "value" to mapOf(
        "status" to statusValue(),
        "stats" to (server?.stats() ?: mapOf("sessionCount" to 0, "peerCount" to 0, "stalePeerCount" to 0)),
        "capturedAt" to System.currentTimeMillis(),
      ),
      "completedAt" to System.currentTimeMillis(),
    )
  }

  private fun statusValue(): Map<String, Any?> {
    val address = server?.address()
    return buildMap {
      put("state", currentState)
      put("config", configMap())
      if (address != null) put("address", address)
      errorCode?.let { put("errorCode", it) }
      errorMessage?.let { put("errorMessage", it) }
    }
  }

  private fun configMap(): Map<String, Any> = mapOf(
    "port" to config.port,
    "basePath" to config.basePath,
    "heartbeatIntervalMs" to config.heartbeatIntervalMs,
    "heartbeatTimeoutMs" to config.heartbeatTimeoutMs,
  )

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
