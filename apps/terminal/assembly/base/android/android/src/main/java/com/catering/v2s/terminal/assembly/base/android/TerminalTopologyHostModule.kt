package com.catering.v2s.terminal.assembly.base.android

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
      nodeId: String,
      displayName: String,
      instanceMode: String,
      displayRole: String ->
      TerminalTopologyHostRegistry.start(
        port = port.toInt(),
        basePath = basePath,
        heartbeatIntervalMs = heartbeatIntervalMs.toLong(),
        heartbeatTimeoutMs = heartbeatTimeoutMs.toLong(),
        nodeId = nodeId,
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
    const val TOPOLOGY_CONNECTION = "onTopologyConnection"
    const val TOPOLOGY_FRAME = "onTopologyFrame"
  }
}
