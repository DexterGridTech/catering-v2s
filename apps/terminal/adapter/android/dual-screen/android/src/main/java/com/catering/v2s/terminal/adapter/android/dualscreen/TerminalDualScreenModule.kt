package com.catering.v2s.terminal.adapter.android.dualscreen

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalDualScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalDualScreen")
    Events(IME_INSETS_CHANGED)

    AsyncFunction("getImeInsetsSnapshot") { displayIndex: Double ->
      TerminalImeInsetsEventBus.snapshot(displayIndex.toInt())?.toMap()
    }

    OnCreate {
      TerminalImeInsetsEventBus.registerPublisher { snapshot ->
        sendEvent(IME_INSETS_CHANGED, snapshot.toMap())
      }
    }

    OnDestroy {
      TerminalImeInsetsEventBus.clearPublisher()
    }
  }

  private companion object {
    const val IME_INSETS_CHANGED = "onImeInsetsChanged"
  }
}

private fun TerminalImeInsetsSnapshot.toMap(): Map<String, Any?> = mapOf(
  "displayIndex" to displayIndex,
  "displayId" to displayId,
  "windowIdentity" to windowIdentity,
  "visible" to visible,
  "bottomPx" to bottomPx,
  "bottomLogical" to bottomLogical,
)
