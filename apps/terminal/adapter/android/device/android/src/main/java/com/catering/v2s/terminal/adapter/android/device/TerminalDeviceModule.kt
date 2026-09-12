package com.catering.v2s.terminal.adapter.android.device

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.provider.Settings
import android.view.Display
import android.util.DisplayMetrics
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalDeviceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalDevice")

    AsyncFunction("getDeviceInfo") { _timeoutMs: Double ->
      val context = appContext.reactContext?.applicationContext
        ?: return@AsyncFunction unavailableDeviceInfoResult("ADAPTER_NOT_INJECTED", "application context is unavailable")

      try {
        val deviceId = Settings.Secure.getString(
          context.contentResolver,
          Settings.Secure.ANDROID_ID,
        )?.trim().orEmpty()
        if (deviceId.isEmpty()) {
          return@AsyncFunction unavailableDeviceInfoResult(
            "PLATFORM_UNSUPPORTED",
            "stable device identifier is unavailable",
          )
        }

        Log.i(LOG_TAG, "event=device-info-read status=succeeded")
        mapOf(
          "status" to "succeeded",
          "value" to mapOf(
            "deviceId" to deviceId,
            "manufacturer" to Build.MANUFACTURER,
            "model" to Build.MODEL,
            "systemName" to "Android",
            "systemVersion" to Build.VERSION.RELEASE,
            "logicalProcessorCount" to Runtime.getRuntime().availableProcessors().coerceAtLeast(1),
          ),
          "completedAt" to System.currentTimeMillis(),
        )
      } catch (_error: Throwable) {
        Log.e(LOG_TAG, "event=device-info-read status=failed")
        deviceInfoFailedResult()
      }
    }

    AsyncFunction("getDisplayInfo") { _timeoutMs: Double ->
      val context = appContext.reactContext?.applicationContext
        ?: return@AsyncFunction unavailableResult("ADAPTER_NOT_INJECTED", "application context is unavailable")
      val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
        ?: return@AsyncFunction unavailableResult("PLATFORM_UNSUPPORTED", "DisplayManager is unavailable")

      try {
        val displays = displayManager.displays.toList()
        val displayCount = displays.size
        displays.forEachIndexed { index, display -> logDisplay(index, display) }
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

  private fun unavailableDeviceInfoResult(reason: String, message: String): Map<String, Any?> {
    Log.w(LOG_TAG, "event=device-info-read status=unavailable reason=$reason")
    return mapOf(
      "status" to "unavailable",
      "port" to "device",
      "capability" to "getDeviceInfo",
      "reason" to reason,
      "message" to message,
    )
  }

  private fun deviceInfoFailedResult(): Map<String, Any?> = mapOf(
    "status" to "failed",
    "port" to "device",
    "capability" to "getDeviceInfo",
    "error" to mapOf(
      "code" to "DEVICE_INFO_READ_FAILED",
      "message" to "stable device information read failed",
      "retryable" to true,
    ),
  )

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

  private fun logDisplay(index: Int, display: Display) {
    val metrics = DisplayMetrics()
    val realMetrics = DisplayMetrics()
    display.getMetrics(metrics)
    display.getRealMetrics(realMetrics)
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) display.mode else null
    val safeName = display.name.replace(Regex("[^A-Za-z0-9_.-]+"), "_")
    Log.i(
      LOG_TAG,
      "event=display-info-entry displayIndex=$index displayId=${display.displayId} name=$safeName " +
        "state=${display.state} flags=${display.flags} rotation=${display.rotation} " +
        "appWidthPx=${metrics.widthPixels} appHeightPx=${metrics.heightPixels} " +
        "densityDpi=${metrics.densityDpi} density=${metrics.density} scaledDensity=${metrics.scaledDensity} " +
        "realWidthPx=${realMetrics.widthPixels} realHeightPx=${realMetrics.heightPixels} " +
        "modeWidthPx=${mode?.physicalWidth ?: -1} modeHeightPx=${mode?.physicalHeight ?: -1}",
    )
  }

  private companion object {
    const val LOG_TAG = "TerminalDevice"
  }
}
