package com.catering.v2s.terminal.adapter.android.device

import android.content.Context
import android.hardware.display.DisplayManager
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalDeviceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalDevice")

    AsyncFunction("getDisplayInfo") { _timeoutMs: Double ->
      val context = appContext.reactContext?.applicationContext
        ?: return@AsyncFunction unavailableResult("ADAPTER_NOT_INJECTED", "application context is unavailable")
      val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
        ?: return@AsyncFunction unavailableResult("PLATFORM_UNSUPPORTED", "DisplayManager is unavailable")

      try {
        val displayCount = displayManager.displays.size
        Log.i(LOG_TAG, "event=display-info-read status=succeeded displayCount=$displayCount")
        mapOf(
          "status" to "succeeded",
          "value" to mapOf("displayCount" to displayCount),
          "completedAt" to System.currentTimeMillis(),
        )
      } catch (_error: Throwable) {
        Log.e(LOG_TAG, "event=display-info-read status=failed")
        failedResult()
      }
    }
  }

  private fun unavailableResult(reason: String, message: String): Map<String, Any?> {
    Log.w(LOG_TAG, "event=display-info-read status=unavailable reason=$reason")
    return mapOf(
      "status" to "unavailable",
      "port" to "device",
      "capability" to "getDisplayInfo",
      "reason" to reason,
      "message" to message,
    )
  }

  private fun failedResult(): Map<String, Any?> = mapOf(
    "status" to "failed",
    "port" to "device",
    "capability" to "getDisplayInfo",
    "error" to mapOf(
      "code" to "DEVICE_DISPLAY_INFO_READ_FAILED",
      "message" to "DisplayManager display snapshot failed",
      "retryable" to true,
    ),
  )

  private companion object {
    const val LOG_TAG = "TerminalDevice"
  }
}
