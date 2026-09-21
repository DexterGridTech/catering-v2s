package com.catering.v2s.terminal.adapter.android.device

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.display.DisplayManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import android.view.Display
import android.util.DisplayMetrics
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import kotlin.math.roundToInt

class TerminalDeviceModule : Module() {
  private val powerReceiverLock = Any()
  private val powerReceivers = mutableMapOf<String, BroadcastReceiver>()
  @Volatile private var destroyed = false

  override fun definition() = ModuleDefinition {
    Name("TerminalDevice")
    Events(POWER_STATUS_CHANGED)

    OnCreate {
      destroyed = false
    }

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
        val displays = displayManager.displays
          .toList()
          .sortedWith(compareBy { if (it.displayId == Display.DEFAULT_DISPLAY) 0 else 1 })
        val displayCount = displays.size
        displays.forEachIndexed { index, display -> logDisplay(index, display) }
        Log.i(LOG_TAG, "event=display-info-read status=succeeded displayCount=$displayCount")
        mapOf(
          "status" to "succeeded",
          "value" to mapOf(
            "displayCount" to displayCount,
            "surfaces" to displays.map { display -> displaySurfaceInfo(display) },
          ),
          "completedAt" to System.currentTimeMillis(),
        )
      } catch (_error: Throwable) {
        Log.e(LOG_TAG, "event=display-info-read status=failed")
        failedResult()
      }
    }

    AsyncFunction("getPowerStatus") { _timeoutMs: Double ->
      val context = applicationContext()
        ?: return@AsyncFunction unavailablePowerResult("ADAPTER_NOT_INJECTED", "application context is unavailable", "getPowerStatus")
      val status = readPowerStatus(context)
        ?: return@AsyncFunction unavailablePowerResult("PLATFORM_UNSUPPORTED", "battery status is unavailable", "getPowerStatus")
      Log.i(LOG_TAG, "event=power-status-read status=succeeded")
      succeededPowerResult(status)
    }

    AsyncFunction("subscribePowerStatus") { _timeoutMs: Double ->
      val context = applicationContext()
        ?: return@AsyncFunction unavailablePowerResult("ADAPTER_NOT_INJECTED", "application context is unavailable", "subscribePowerStatus")
      readPowerStatus(context)
        ?: return@AsyncFunction unavailablePowerResult("PLATFORM_UNSUPPORTED", "battery status is unavailable", "subscribePowerStatus")
      val subscriptionId = UUID.randomUUID().toString()
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(receiverContext: Context, _intent: Intent) {
          if (destroyed) return
          val status = readPowerStatus(receiverContext) ?: run {
            Log.w(LOG_TAG, "event=power-status-event status=unavailable reason=BATTERY_STATUS_UNAVAILABLE")
            return
          }
          sendPowerStatusEvent(subscriptionId, status)
        }
      }

      try {
        registerPowerReceiver(context, receiver)
        synchronized(powerReceiverLock) {
          powerReceivers[subscriptionId] = receiver
        }
        Log.i(LOG_TAG, "event=power-status-subscription status=succeeded")
        mapOf(
          "status" to "succeeded",
          "value" to mapOf("subscriptionId" to subscriptionId),
          "completedAt" to System.currentTimeMillis(),
        )
      } catch (_error: Throwable) {
        Log.e(LOG_TAG, "event=power-status-subscription status=failed")
        failedPowerResult("POWER_STATUS_SUBSCRIPTION_FAILED", "power status subscription failed")
      }
    }

    AsyncFunction("unsubscribePowerStatus") { subscriptionId: String, _timeoutMs: Double ->
      val context = applicationContext()
        ?: return@AsyncFunction unavailablePowerResult("ADAPTER_NOT_INJECTED", "application context is unavailable", "unsubscribePowerStatus")
      val receiver = synchronized(powerReceiverLock) {
        powerReceivers.remove(subscriptionId)
      }
        ?: return@AsyncFunction failedPowerResult(
          "POWER_STATUS_SUBSCRIPTION_NOT_FOUND",
          "power status subscription was not found",
          retryable = false,
          capability = "unsubscribePowerStatus",
        )

      try {
        context.unregisterReceiver(receiver)
        Log.i(LOG_TAG, "event=power-status-unsubscription status=succeeded")
        mapOf(
          "status" to "succeeded",
          "value" to mapOf("completed" to true),
          "completedAt" to System.currentTimeMillis(),
        )
      } catch (_error: Throwable) {
        Log.e(LOG_TAG, "event=power-status-unsubscription status=failed")
        failedPowerResult(
          "POWER_STATUS_UNSUBSCRIPTION_FAILED",
          "power status unsubscription failed",
          capability = "unsubscribePowerStatus",
        )
      }
    }

    OnDestroy {
      destroyed = true
      val context = applicationContext()
      val receivers = synchronized(powerReceiverLock) {
        val values = powerReceivers.values.toList()
        powerReceivers.clear()
        values
      }
      if (context !== null) {
        receivers.forEach { receiver ->
          try {
            context.unregisterReceiver(receiver)
          } catch (_error: Throwable) {
            Log.w(LOG_TAG, "event=power-status-unsubscription status=ignored reason=MODULE_DESTROYED")
          }
        }
      }
    }
  }

  private fun applicationContext(): Context? = appContext.reactContext?.applicationContext

  private fun registerPowerReceiver(context: Context, receiver: BroadcastReceiver) {
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_BATTERY_CHANGED)
      addAction(Intent.ACTION_POWER_CONNECTED)
      addAction(Intent.ACTION_POWER_DISCONNECTED)
    }
    @Suppress("DEPRECATION")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter)
    }
  }

  private fun sendPowerStatusEvent(subscriptionId: String, status: Map<String, Any?>) {
    if (destroyed) return
    val source = status["source"]
    val charging = status["charging"]
    Log.i(
      LOG_TAG,
      "event=power-status-event status=emitted source=$source charging=$charging",
    )
    sendEvent(
      POWER_STATUS_CHANGED,
      mapOf(
        "subscriptionId" to subscriptionId,
        "status" to status,
        "observedAt" to System.currentTimeMillis(),
      ),
    )
  }

  private fun readPowerStatus(context: Context): Map<String, Any?>? {
    val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return null
    val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
    val plugged = batteryIntent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
    val source = when {
      plugged == BatteryManager.BATTERY_PLUGGED_AC
        || plugged == BatteryManager.BATTERY_PLUGGED_USB
        || plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS -> "external"
      status == BatteryManager.BATTERY_STATUS_UNKNOWN && plugged == 0 -> "unknown"
      plugged == 0 -> "battery"
      else -> "unknown"
    }
    val charging = when (status) {
      BatteryManager.BATTERY_STATUS_CHARGING, BatteryManager.BATTERY_STATUS_FULL -> "charging"
      BatteryManager.BATTERY_STATUS_DISCHARGING, BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not-charging"
      else -> "unknown"
    }
    val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    val levelRatio = if (level >= 0 && scale > 0 && level <= scale) level.toDouble() / scale.toDouble() else null
    return mapOf(
      "source" to source,
      "charging" to charging,
      "levelRatio" to levelRatio,
    )
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

  private fun unavailablePowerResult(reason: String, message: String, capability: String): Map<String, Any?> {
    Log.w(LOG_TAG, "event=power-status status=unavailable reason=$reason")
    return mapOf(
      "status" to "unavailable",
      "port" to "device",
      "capability" to capability,
      "reason" to reason,
      "message" to message,
    )
  }

  private fun succeededPowerResult(status: Map<String, Any?>): Map<String, Any?> = mapOf(
    "status" to "succeeded",
    "value" to status,
    "completedAt" to System.currentTimeMillis(),
  )

  private fun failedPowerResult(
    code: String,
    message: String,
    retryable: Boolean = true,
    capability: String = "subscribePowerStatus",
  ): Map<String, Any?> = mapOf(
    "status" to "failed",
    "port" to "device",
    "capability" to capability,
    "error" to mapOf(
      "code" to code,
      "message" to message,
      "retryable" to retryable,
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

  private fun displaySurfaceInfo(display: Display): Map<String, Any?> {
    val metrics = DisplayMetrics()
    val realMetrics = DisplayMetrics()
    display.getMetrics(metrics)
    display.getRealMetrics(realMetrics)
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) display.mode else null
    // React Native/Web layout and the IA use logical layout units, not Android
    // physical pixels. `getMetrics()`/`getRealMetrics()` expose pixel counts;
    // convert the authoritative full-display metrics by the display density
    // before publishing logicalSize. Keep physicalSize independently sourced
    // from the display mode/real metrics so one surface's values are never
    // derived from the other.
    val logicalSize = logicalSizeFrom(realMetrics)
    val physicalWidth = mode?.physicalWidth?.takeIf { it > 0 } ?: realMetrics.widthPixels
    val physicalHeight = mode?.physicalHeight?.takeIf { it > 0 } ?: realMetrics.heightPixels
    val physicalSize = sizeOrNull(physicalWidth, physicalHeight)
    val role = if (display.displayId == Display.DEFAULT_DISPLAY) "primary" else "secondary"
    val readiness = when (display.state) {
      Display.STATE_ON -> "ready"
      Display.STATE_OFF -> "unavailable"
      else -> "loading"
    }
    return mapOf(
      "displayId" to display.displayId,
      "role" to role,
      "logicalSize" to logicalSize,
      "physicalSize" to physicalSize,
      "readiness" to readiness,
    )
  }

  private fun logicalSizeFrom(metrics: DisplayMetrics): Map<String, Int>? {
    val density = metrics.density
    if (!density.isFinite() || density <= 0f) return null
    return sizeOrNull(
      (metrics.widthPixels / density).roundToInt(),
      (metrics.heightPixels / density).roundToInt(),
    )
  }

  private fun sizeOrNull(width: Int, height: Int): Map<String, Int>? =
    if (width > 0 && height > 0) mapOf("width" to width, "height" to height) else null

  private companion object {
    const val LOG_TAG = "TerminalDevice"
    const val POWER_STATUS_CHANGED = "onPowerStatusChanged"
  }
}
