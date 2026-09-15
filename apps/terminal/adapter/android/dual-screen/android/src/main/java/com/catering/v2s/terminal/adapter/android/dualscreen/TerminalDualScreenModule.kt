package com.catering.v2s.terminal.adapter.android.dualscreen

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalDualScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalDualScreen")
    Events(SURFACE_HOST_CHANGED)

    AsyncFunction("getSurfaceHostSnapshot") { surfaceKey: String ->
      TerminalSurfaceHostRegistry.event(surfaceKey)?.toMap()
    }

    OnCreate {
      TerminalSurfaceHostRegistry.registerPublisher { event ->
        sendEvent(SURFACE_HOST_CHANGED, event.toMap())
      }
    }

    OnDestroy {
      TerminalSurfaceHostRegistry.clearPublisher()
    }
  }

  private companion object {
    const val SURFACE_HOST_CHANGED = "onSurfaceHostChanged"
  }
}

private fun TerminalSurfaceHostEvent.toMap(): Map<String, Any?> = when (this) {
  is TerminalSurfaceHostEvent.Ready -> snapshot.toMap()
  is TerminalSurfaceHostEvent.RecoverableRemoval -> mapOf(
    "available" to false,
    "status" to "recovering",
    "surfaceKey" to surfaceKey,
    "generation" to generation,
    "displayId" to displayId,
    "windowIdentity" to windowIdentity,
    "reason" to reason,
  )
  is TerminalSurfaceHostEvent.Unavailable -> mapOf(
    "available" to false,
    "status" to "unavailable",
    "surfaceKey" to surfaceKey,
    "generation" to generation,
    "displayId" to displayId,
    "windowIdentity" to windowIdentity,
    "reason" to reason,
  )
}

private fun TerminalSurfaceHostSnapshot.toMap(): Map<String, Any?> = mapOf(
  "available" to true,
  "surfaceKey" to surfaceKey,
  "generation" to generation,
  "displayId" to displayId,
  "isHostPrimaryDisplay" to isHostPrimaryDisplay,
  "windowIdentity" to windowIdentity,
  "orientation" to orientation,
  "stableHostLogicalSize" to mapOf(
    "width" to stableWidthLogical,
    "height" to stableHeightLogical,
  ),
  "currentHostLogicalSize" to mapOf(
    "width" to currentWidthLogical,
    "height" to currentHeightLogical,
  ),
  "diagnostics" to mapOf(
    "stableWidthPx" to stableWidthPx,
    "stableHeightPx" to stableHeightPx,
    "currentWidthPx" to currentWidthPx,
    "currentHeightPx" to currentHeightPx,
    "hardwareDensityDpi" to hardwareDensityDpi,
    "hardwareDensity" to hardwareDensity,
    "hardwareScaledDensity" to hardwareScaledDensity,
    "surfaceDensityDpi" to surfaceDensityDpi,
    "surfaceDensity" to surfaceDensity,
    "source" to "android-display-context",
    "stableMeasurementContext" to "owner-decorView-layout",
  ),
)
