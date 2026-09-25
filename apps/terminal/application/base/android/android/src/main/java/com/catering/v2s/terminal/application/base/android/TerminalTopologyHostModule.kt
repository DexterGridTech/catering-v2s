package com.catering.v2s.terminal.application.base.android

import android.util.Log
import com.facebook.react.bridge.ReadableMap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalTopologyHostModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalTopologyHost")
    Events(TOPOLOGY_CONNECTION, TOPOLOGY_FRAME)

    AsyncFunction("start") { port: Double,
      basePath: String,
      heartbeatIntervalMs: Double,
      heartbeatTimeoutMs: Double,
      identity: ReadableMap ->
      val nodeId = requiredIdentityValue(identity, "nodeId")
      val moduleName = requiredIdentityValue(identity, "moduleName")
      val displayName = requiredIdentityValue(identity, "displayName")
      val instanceMode = requiredIdentityValue(identity, "instanceMode")
      val displayRole = requiredIdentityValue(identity, "displayRole")
      Log.i(
        LOG_TAG,
        "event=topology-host-start-request port=${port.toInt()} moduleName=$moduleName instanceMode=$instanceMode displayRole=$displayRole",
      )
      TerminalTopologyHostRegistry.start(
        port = port.toInt(),
        basePath = basePath,
        heartbeatIntervalMs = heartbeatIntervalMs.toLong(),
        heartbeatTimeoutMs = heartbeatTimeoutMs.toLong(),
        nodeId = nodeId,
        moduleName = moduleName,
        displayName = displayName,
        instanceMode = instanceMode,
        displayRole = displayRole,
      )
    }

    AsyncFunction("stop") { _timeoutMs: Double ->
      TerminalTopologyHostRegistry.stop()
    }

    AsyncFunction("getStatus") { _timeoutMs: Double ->
      TerminalTopologyHostRegistry.status()
    }

    AsyncFunction("getDiagnosticsSnapshot") { _timeoutMs: Double ->
      TerminalTopologyHostRegistry.diagnostics()
    }

    AsyncFunction("sendFrame") { raw: String ->
      TerminalTopologyHostRegistry.sendFrame(raw)
    }

    AsyncFunction("closePeer") {
      TerminalTopologyHostRegistry.closePeer()
    }

    OnCreate {
      TerminalTopologyHostRegistry.registerPublisher { eventName, payload ->
        sendEvent(eventName, payload)
      }
    }

    OnDestroy {
      TerminalTopologyHostRegistry.clearPublisher()
    }
  }

  private companion object {
    const val LOG_TAG = "TER-Topology"
    const val TOPOLOGY_CONNECTION = "onTopologyConnection"
    const val TOPOLOGY_FRAME = "onTopologyFrame"

    fun requiredIdentityValue(identity: ReadableMap, key: String): String {
      val value = identity.getString(key)
      require(!value.isNullOrEmpty()) { "topology host identity field '$key' is required" }
      return value
    }
  }
}
