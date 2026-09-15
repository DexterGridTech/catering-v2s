package com.catering.v2s.terminal.adapter.android.dualscreen

import android.app.Activity
import android.app.Application
import android.app.Presentation
import android.content.Context
import android.content.res.Configuration
import android.content.pm.ActivityInfo
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.DisplayMetrics
import android.view.Display
import android.view.View
import android.view.Window
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.interfaces.TaskInterface
import com.facebook.react.interfaces.fabric.ReactSurface
import com.facebook.react.uimanager.DisplayMetricsHolder
import expo.modules.core.interfaces.ReactActivityHandler
import java.util.concurrent.atomic.AtomicBoolean

private const val LOG_TAG = "TerminalDualScreen"

/**
 * Calibrated from the two approved local Android VMs:
 * mobile smallestScreenWidthDp=360 and laptop smallestScreenWidthDp=800.
 * The threshold is deliberately owned by this classifier only.
 */
internal const val CALIBRATED_LAPTOP_THRESHOLD_DP = 581

internal data class SurfaceFormDecision(
  val surfaceForm: String,
  val smallestScreenWidthDp: Int?,
  val thresholdDp: Int,
  val diagnostic: String?,
)

internal fun classifySurfaceForm(
  smallestScreenWidthDp: Int?,
  laptopThresholdDp: Int = CALIBRATED_LAPTOP_THRESHOLD_DP,
): SurfaceFormDecision {
  if (smallestScreenWidthDp == null || smallestScreenWidthDp <= 0) {
    return SurfaceFormDecision(
      surfaceForm = "laptop",
      smallestScreenWidthDp = smallestScreenWidthDp,
      thresholdDp = laptopThresholdDp,
      diagnostic = "smallest-screen-width-unavailable",
    )
  }
  return SurfaceFormDecision(
    surfaceForm = if (smallestScreenWidthDp >= laptopThresholdDp) "laptop" else "mobile",
    smallestScreenWidthDp = smallestScreenWidthDp,
    thresholdDp = laptopThresholdDp,
    diagnostic = null,
  )
}

internal fun requestedOrientationForSurfaceForm(surfaceForm: String): Int = when (surfaceForm) {
  "mobile" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
  "laptop" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
  else -> error("unsupported surface form: $surfaceForm")
}

/**
 * The splash-covered Activity is PRIMARY only on Android's default physical
 * display.  Launching that Activity on a presentation display is a topology
 * failure, not a second meaning of the PRIMARY surface.
 */
internal fun isPrimaryActivitySurface(surfaceIndex: Int, displayId: Int?): Boolean =
  surfaceIndex == 0 && displayId == Display.DEFAULT_DISPLAY

internal data class SurfaceLaunchOptions(
  val displayIndex: Int,
  val displayCount: Int,
  val surfaceForm: String,
)

internal fun createSurfaceLaunchOptions(
  displayIndex: Int,
  displayCount: Int,
  surfaceForm: String,
): SurfaceLaunchOptions = SurfaceLaunchOptions(displayIndex, displayCount, surfaceForm)

private fun SurfaceLaunchOptions.toBundle(): Bundle = Bundle().apply {
  putInt("displayIndex", displayIndex)
  putInt("displayCount", displayCount)
  putString("surfaceForm", surfaceForm)
}

internal sealed class DisplaySnapshotReadResult {
  data class Ready(
    val displayCount: Int,
    val secondaryDisplayIndex: Int?,
  ) : DisplaySnapshotReadResult()

  data class Unavailable(val reason: String) : DisplaySnapshotReadResult()
}

internal fun readDisplaySnapshotSelection(
  readDisplayIds: () -> List<Int>?,
): DisplaySnapshotReadResult {
  val displayIds = try {
    readDisplayIds()
  } catch (_error: Throwable) {
    return DisplaySnapshotReadResult.Unavailable("display-snapshot-failed")
  }
  if (displayIds == null) return DisplaySnapshotReadResult.Unavailable("display-manager-unavailable")
  val secondaryDisplayIndex = displayIds
    .indexOfFirst { it != Display.DEFAULT_DISPLAY }
    .takeIf { it >= 0 }
  return DisplaySnapshotReadResult.Ready(
    displayCount = displayIds.size,
    secondaryDisplayIndex = secondaryDisplayIndex,
  )
}

private fun logDisplayMetrics(event: String, display: Display, displayIndex: Int) {
  val appMetrics = DisplayMetrics()
  val realMetrics = DisplayMetrics()
  display.getMetrics(appMetrics)
  display.getRealMetrics(realMetrics)
  val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) display.mode else null
  val safeName = display.name.replace(Regex("[^A-Za-z0-9_.-]+"), "_")
  Log.i(
    LOG_TAG,
    "event=$event displayIndex=$displayIndex displayId=${display.displayId} name=$safeName " +
      "state=${display.state} flags=${display.flags} rotation=${display.rotation} " +
      "refreshRate=${display.refreshRate} appWidthPx=${appMetrics.widthPixels} " +
      "appHeightPx=${appMetrics.heightPixels} appDensityDpi=${appMetrics.densityDpi} " +
      "appDensity=${appMetrics.density} appScaledDensity=${appMetrics.scaledDensity} " +
      "appXdpi=${appMetrics.xdpi} appYdpi=${appMetrics.ydpi} " +
      "realWidthPx=${realMetrics.widthPixels} realHeightPx=${realMetrics.heightPixels} " +
      "modeWidthPx=${mode?.physicalWidth ?: -1} modeHeightPx=${mode?.physicalHeight ?: -1}",
  )
}

private fun logConfiguration(event: String, configuration: Configuration, metrics: DisplayMetrics, displayIndex: Int) {
  Log.i(
    LOG_TAG,
    "event=$event displayIndex=$displayIndex densityDpi=${configuration.densityDpi} " +
      "density=${metrics.density} scaledDensity=${metrics.scaledDensity} fontScale=${configuration.fontScale} " +
      "screenWidthDp=${configuration.screenWidthDp} screenHeightDp=${configuration.screenHeightDp} " +
      "smallestWidthDp=${configuration.smallestScreenWidthDp} orientation=${configuration.orientation} " +
      "resourceWidthPx=${metrics.widthPixels} resourceHeightPx=${metrics.heightPixels}",
  )
}

private fun logViewBounds(event: String, view: View, displayIndex: Int) {
  val location = IntArray(2)
  view.getLocationOnScreen(location)
  val metrics = view.resources.displayMetrics
  val density = metrics.density
  val logicalWidth = if (density > 0f) view.width / density else 0f
  val logicalHeight = if (density > 0f) view.height / density else 0f
  Log.i(
    LOG_TAG,
    "event=$event displayIndex=$displayIndex displayId=${view.display?.displayId ?: -1} " +
      "leftPx=${location[0]} topPx=${location[1]} widthPx=${view.width} heightPx=${view.height} " +
      "measuredWidthPx=${view.measuredWidth} measuredHeightPx=${view.measuredHeight} " +
      "densityDpi=${metrics.densityDpi} density=$density logicalWidth=$logicalWidth logicalHeight=$logicalHeight",
  )
}

internal data class TerminalSurfaceHostSnapshot(
  val surfaceKey: String,
  val generation: Long,
  val displayId: Int?,
  val isHostPrimaryDisplay: Boolean,
  val windowIdentity: String,
  val orientation: String,
  val stableWidthLogical: Double,
  val stableHeightLogical: Double,
  val currentWidthLogical: Double,
  val currentHeightLogical: Double,
  val stableWidthPx: Int,
  val stableHeightPx: Int,
  val currentWidthPx: Int,
  val currentHeightPx: Int,
  val hardwareDensityDpi: Int,
  val hardwareDensity: Float,
  val hardwareScaledDensity: Float,
  val surfaceDensityDpi: Int,
  val surfaceDensity: Float,
)

internal fun areSurfaceDensitiesUsable(
  hardwareDensityDpi: Int,
  hardwareDensity: Float,
  surfaceDensityDpi: Int,
  surfaceDensity: Float,
): Boolean =
  hardwareDensityDpi > 0 && surfaceDensityDpi > 0 && hardwareDensity > 0f && surfaceDensity > 0f &&
    hardwareDensity.isFinite() && surfaceDensity.isFinite()

internal sealed class TerminalSurfaceHostEvent {
  data class Ready(val snapshot: TerminalSurfaceHostSnapshot) : TerminalSurfaceHostEvent()

  data class RecoverableRemoval(
    val surfaceKey: String,
    val generation: Long,
    val displayId: Int?,
    val windowIdentity: String,
    val reason: String,
  ) : TerminalSurfaceHostEvent()

  data class Unavailable(
    val surfaceKey: String,
    val generation: Long,
    val displayId: Int?,
    val windowIdentity: String,
    val reason: String,
  ) : TerminalSurfaceHostEvent()
}

internal fun shouldReuseStableHostContext(
  previousSnapshot: TerminalSurfaceHostSnapshot?,
  sameOwner: Boolean,
  orientation: String,
  widthPx: Int,
  heightPx: Int,
  hardwareDensityDpi: Int,
  hardwareDensity: Float,
  surfaceDensityDpi: Int,
  surfaceDensity: Float,
): Boolean {
  if (!sameOwner || previousSnapshot == null) return false
  if (previousSnapshot.orientation != orientation) return false
  if (previousSnapshot.hardwareDensityDpi != hardwareDensityDpi || previousSnapshot.hardwareDensity != hardwareDensity) return false
  if (previousSnapshot.surfaceDensityDpi != surfaceDensityDpi || previousSnapshot.surfaceDensity != surfaceDensity) return false
  return previousSnapshot.stableWidthPx == widthPx && previousSnapshot.stableHeightPx == heightPx
}

internal data class SurfaceHostRemovalResult(
  val shouldClear: Boolean,
  val snapshotToKeep: TerminalSurfaceHostSnapshot?,
  val recoverable: TerminalSurfaceHostEvent.RecoverableRemoval?,
)

internal fun resolveSurfaceHostRemoval(
  currentSnapshot: TerminalSurfaceHostSnapshot?,
  ownerMatches: Boolean,
  nextGeneration: Long,
  reason: String,
): SurfaceHostRemovalResult {
  if (currentSnapshot == null || !ownerMatches) {
    return SurfaceHostRemovalResult(
      shouldClear = false,
      snapshotToKeep = currentSnapshot,
      recoverable = null,
    )
  }
  return SurfaceHostRemovalResult(
    shouldClear = false,
    snapshotToKeep = currentSnapshot,
    recoverable = TerminalSurfaceHostEvent.RecoverableRemoval(
      surfaceKey = currentSnapshot.surfaceKey,
      generation = nextGeneration,
      displayId = currentSnapshot.displayId,
      windowIdentity = currentSnapshot.windowIdentity,
      reason = reason,
    ),
  )
}

/**
 * Owns the per-window geometry facts used by the JS render host. The registry
 * deliberately stores one entry per surface instead of a process-global
 * "current display": PRIMARY and SECONDARY are alive at the same time.
 */
internal object TerminalSurfaceHostRegistry {
  private const val PRIMARY_INDEX = 0
  private const val SECONDARY_INDEX = 1
  private const val PRIMARY_KEY = "PRIMARY"
  private const val SECONDARY_KEY = "SECONDARY"

  private val lock = Any()
  private val entries = mutableMapOf<Int, Entry>()
  private val unavailableEntries = mutableMapOf<Int, TerminalSurfaceHostEvent.Unavailable>()
  private val generationCounters = mutableMapOf<Int, Long>()
  private var publisher: ((TerminalSurfaceHostEvent) -> Unit)? = null

  fun registerPublisher(nextPublisher: (TerminalSurfaceHostEvent) -> Unit) {
    synchronized(lock) { publisher = nextPublisher }
  }

  fun clearPublisher() {
    synchronized(lock) { publisher = null }
  }

  fun snapshot(surfaceKey: String): TerminalSurfaceHostSnapshot? {
    val surfaceIndex = surfaceIndexForKey(surfaceKey) ?: return null
    return synchronized(lock) { entries[surfaceIndex]?.snapshot }
  }

  fun event(surfaceKey: String): TerminalSurfaceHostEvent? {
    val surfaceIndex = surfaceIndexForKey(surfaceKey) ?: return null
    return synchronized(lock) {
      unavailableEntries[surfaceIndex]
        ?: entries[surfaceIndex]?.snapshot?.let(TerminalSurfaceHostEvent::Ready)
    }
  }

  fun markUnavailable(
    surfaceIndex: Int,
    displayId: Int?,
    windowIdentity: String,
    reason: String,
  ) {
    val surfaceKey = surfaceKeyForIndex(surfaceIndex) ?: return
    val event = synchronized(lock) {
      val current = unavailableEntries[surfaceIndex]
      if (current?.reason == reason && current.displayId == displayId && current.windowIdentity == windowIdentity) {
        null
      } else {
        val next = TerminalSurfaceHostEvent.Unavailable(
          surfaceKey = surfaceKey,
          generation = nextGenerationLocked(surfaceIndex),
          displayId = displayId,
          windowIdentity = windowIdentity,
          reason = reason,
        )
        entries.remove(surfaceIndex)
        unavailableEntries[surfaceIndex] = next
        next
      }
    }
    publish(event)
  }

  fun captureWindow(
    surfaceIndex: Int,
    window: Window,
    windowIdentity: String,
    surfaceView: View? = null,
  ) {
    val surfaceKey = surfaceKeyForIndex(surfaceIndex) ?: return
    val ownerView = window.decorView
    val surfaceMetrics = (surfaceView ?: ownerView).resources.displayMetrics
    val hardwareMetrics = DisplayMetrics()
    ownerView.display?.getMetrics(hardwareMetrics)
    val widthPx = ownerView.width
    val heightPx = ownerView.height
    val hardwareDensity = hardwareMetrics.density
    val surfaceDensity = surfaceMetrics.density
    val displayId = ownerView.display?.displayId

    if (
      widthPx <= 0 || heightPx <= 0 || hardwareDensity <= 0f || surfaceDensity <= 0f ||
        displayId == null
    ) {
      Log.i(
        LOG_TAG,
        "event=surface-host-snapshot-unavailable surfaceKey=$surfaceKey " +
          "windowIdentity=$windowIdentity displayId=${displayId ?: -1} " +
          "widthPx=$widthPx heightPx=$heightPx hardwareDensity=$hardwareDensity " +
            "surfaceDensity=$surfaceDensity reason=invalid-owner-layout",
      )
      remove(surfaceIndex, window, "invalid-owner-layout")
      return
    }
    if (!areSurfaceDensitiesUsable(
        hardwareDensityDpi = hardwareMetrics.densityDpi,
        hardwareDensity = hardwareDensity,
        surfaceDensityDpi = surfaceMetrics.densityDpi,
        surfaceDensity = surfaceDensity,
      )) {
      Log.i(
        LOG_TAG,
        "event=surface-host-snapshot-unavailable surfaceKey=$surfaceKey " +
          "windowIdentity=$windowIdentity displayId=$displayId " +
          "hardwareDensityDpi=${hardwareMetrics.densityDpi} hardwareDensity=$hardwareDensity " +
          "surfaceDensityDpi=${surfaceMetrics.densityDpi} surfaceDensity=$surfaceDensity " +
          "reason=invalid-density",
      )
      remove(surfaceIndex, window, "invalid-density")
      return
    }

    val orientation = if (widthPx >= heightPx) "landscape" else "portrait"
    val event = synchronized(lock) {
      val previous = entries[surfaceIndex]
      val previousSnapshot = previous?.snapshot
      val sameOwner = previous != null && previous.ownerWindow === window &&
        previousSnapshot?.displayId == displayId &&
        previousSnapshot.windowIdentity == windowIdentity

      val currentWidthLogical = widthPx.toDouble() / surfaceDensity.toDouble()
      val currentHeightLogical = heightPx.toDouble() / surfaceDensity.toDouble()
      val sameStableContext = shouldReuseStableHostContext(
        previousSnapshot = previousSnapshot,
        sameOwner = sameOwner,
        orientation = orientation,
        widthPx = widthPx,
        heightPx = heightPx,
        hardwareDensityDpi = hardwareMetrics.densityDpi,
        hardwareDensity = hardwareDensity,
        surfaceDensityDpi = surfaceMetrics.densityDpi,
        surfaceDensity = surfaceDensity,
      )
      val stableWidthLogical = if (sameStableContext) previousSnapshot!!.stableWidthLogical else currentWidthLogical
      val stableHeightLogical = if (sameStableContext) previousSnapshot!!.stableHeightLogical else currentHeightLogical
      val stableWidthPx = if (sameStableContext) previousSnapshot!!.stableWidthPx else widthPx
      val stableHeightPx = if (sameStableContext) previousSnapshot!!.stableHeightPx else heightPx
      val stableChanged = previousSnapshot == null || !sameStableContext
      val generation = if (stableChanged) nextGenerationLocked(surfaceIndex) else previousSnapshot!!.generation
      val next = TerminalSurfaceHostSnapshot(
        surfaceKey = surfaceKey,
        generation = generation,
        displayId = displayId,
        isHostPrimaryDisplay = isPrimaryActivitySurface(surfaceIndex, displayId),
        windowIdentity = windowIdentity,
        orientation = orientation,
        stableWidthLogical = stableWidthLogical,
        stableHeightLogical = stableHeightLogical,
        currentWidthLogical = currentWidthLogical,
        currentHeightLogical = currentHeightLogical,
        stableWidthPx = stableWidthPx,
        stableHeightPx = stableHeightPx,
        currentWidthPx = widthPx,
        currentHeightPx = heightPx,
        hardwareDensityDpi = hardwareMetrics.densityDpi,
        hardwareDensity = hardwareDensity,
        hardwareScaledDensity = hardwareMetrics.scaledDensity,
        surfaceDensityDpi = surfaceMetrics.densityDpi,
        surfaceDensity = surfaceDensity,
      )
      if (previousSnapshot == next) {
        null
      } else {
        unavailableEntries.remove(surfaceIndex)
        entries[surfaceIndex] = Entry(window, next)
        TerminalSurfaceHostEvent.Ready(next)
      }
    }
    publish(event)
  }

  fun remove(surfaceIndex: Int, window: Window?, reason: String) {
    val surfaceKey = surfaceKeyForIndex(surfaceIndex) ?: return
    val event = synchronized(lock) {
      val current = entries[surfaceIndex] ?: return@synchronized null
      val ownerMatches = window == null || current.ownerWindow === window
      if (!ownerMatches) return@synchronized null
      val removal = resolveSurfaceHostRemoval(
        currentSnapshot = current.snapshot,
        ownerMatches = true,
        nextGeneration = nextGenerationLocked(surfaceIndex),
        reason = reason,
      )
      removal.recoverable
    }
    publish(event)
  }

  private fun publish(event: TerminalSurfaceHostEvent?) {
    if (event == null) return
    when (event) {
      is TerminalSurfaceHostEvent.Ready -> {
        val snapshot = event.snapshot
        Log.i(
          LOG_TAG,
          "event=surface-host-snapshot-ready surfaceKey=${snapshot.surfaceKey} " +
            "generation=${snapshot.generation} displayId=${snapshot.displayId ?: -1} " +
            "windowIdentity=${snapshot.windowIdentity} orientation=${snapshot.orientation} " +
            "stableWidthPx=${snapshot.stableWidthPx} stableHeightPx=${snapshot.stableHeightPx} " +
            "currentWidthPx=${snapshot.currentWidthPx} currentHeightPx=${snapshot.currentHeightPx} " +
            "stableWidthLogical=${snapshot.stableWidthLogical} " +
            "stableHeightLogical=${snapshot.stableHeightLogical} " +
            "currentWidthLogical=${snapshot.currentWidthLogical} " +
            "currentHeightLogical=${snapshot.currentHeightLogical} " +
            "hardwareDensityDpi=${snapshot.hardwareDensityDpi} hardwareDensity=${snapshot.hardwareDensity} " +
            "hardwareScaledDensity=${snapshot.hardwareScaledDensity} " +
            "surfaceDensityDpi=${snapshot.surfaceDensityDpi} surfaceDensity=${snapshot.surfaceDensity} " +
            "source=android-display-context measurementContext=owner-decorView-layout",
        )
      }
      is TerminalSurfaceHostEvent.RecoverableRemoval -> Log.i(
        LOG_TAG,
        "event=surface-host-snapshot-recovering surfaceKey=${event.surfaceKey} " +
          "generation=${event.generation} displayId=${event.displayId ?: -1} " +
          "windowIdentity=${event.windowIdentity} reason=${event.reason}",
      )
      is TerminalSurfaceHostEvent.Unavailable -> Log.i(
        LOG_TAG,
        "event=surface-host-snapshot-unavailable surfaceKey=${event.surfaceKey} " +
          "generation=${event.generation} displayId=${event.displayId ?: -1} " +
          "windowIdentity=${event.windowIdentity} reason=${event.reason}",
      )
    }
    val currentPublisher = synchronized(lock) { publisher }
    currentPublisher?.invoke(event)
  }

  private fun nextGenerationLocked(surfaceIndex: Int): Long {
    val next = (generationCounters[surfaceIndex] ?: 0L) + 1L
    generationCounters[surfaceIndex] = next
    return next
  }

  private fun surfaceIndexForKey(surfaceKey: String): Int? = when (surfaceKey) {
    PRIMARY_KEY -> PRIMARY_INDEX
    SECONDARY_KEY -> SECONDARY_INDEX
    else -> null
  }

  private fun surfaceKeyForIndex(surfaceIndex: Int): String? = when (surfaceIndex) {
    PRIMARY_INDEX -> PRIMARY_KEY
    SECONDARY_INDEX -> SECONDARY_KEY
    else -> null
  }

  private data class Entry(
    val ownerWindow: Window,
    val snapshot: TerminalSurfaceHostSnapshot,
  )
}

/**
 * Adds the primary surface's initial props and owns the secondary Presentation
 * without creating another React host, instance, process, or store.
 */
internal class TerminalDualScreenActivityHandler :
  ReactActivityHandler,
  Application.ActivityLifecycleCallbacks {

  private val mainHandler = Handler(Looper.getMainLooper())
  private val stateLock = Any()
  private var launchRequested = false
  private var primaryActivity: ReactActivity? = null
  private var registeredApplication: Application? = null
  private var secondaryState: SecondaryState? = null

  override fun onDidCreateReactActivityDelegate(
    activity: ReactActivity,
    delegate: ReactActivityDelegate,
  ): ReactActivityDelegate? {
    val surfaceFormDecision = readSurfaceFormDecision(activity)
    activity.setRequestedOrientation(requestedOrientationForSurfaceForm(surfaceFormDecision.surfaceForm))
    log(
      "surface-form-decision",
      "surfaceForm=${surfaceFormDecision.surfaceForm}",
      "smallestScreenWidthDp=${surfaceFormDecision.smallestScreenWidthDp ?: "unavailable"}",
      "thresholdDp=${surfaceFormDecision.thresholdDp}",
      "source=configuration.smallestScreenWidthDp",
      "diagnostic=${surfaceFormDecision.diagnostic ?: "none"}",
    )
    val snapshot = readDisplaySnapshot(activity) ?: return null
    val host = delegate.reactHost ?: run {
      log("primary-host-unavailable")
      TerminalSurfaceHostRegistry.markUnavailable(
        surfaceIndex = 0,
        displayId = activity.window.decorView.display?.displayId,
        windowIdentity = "primary",
        reason = "primary-host-unavailable",
      )
      return null
    }
    val mainComponentName = delegate.mainComponentName ?: run {
      log("primary-component-unavailable")
      TerminalSurfaceHostRegistry.markUnavailable(
        surfaceIndex = 0,
        displayId = activity.window.decorView.display?.displayId,
        windowIdentity = "primary",
        reason = "primary-component-unavailable",
      )
      return null
    }

    primaryActivity = activity
    ensureLifecycleCallbacks(activity.application)
    activity.window.decorView.display?.let { display ->
      logDisplayMetrics("primary-activity-display", display, 0)
    }
    logConfiguration(
      "primary-activity-configuration",
      activity.resources.configuration,
      activity.resources.displayMetrics,
      0,
    )
    activity.window.decorView.addOnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
      logViewBounds("primary-window-layout", view, 0)
      TerminalSurfaceHostRegistry.captureWindow(0, activity.window, "primary")
    }
    activity.window.decorView.post {
      logViewBounds("primary-window-post-layout", activity.window.decorView, 0)
      TerminalSurfaceHostRegistry.captureWindow(0, activity.window, "primary")
    }
    applyImmersiveWindow(activity.window)
    if (snapshot.secondaryDisplay != null) {
      ensureSecondarySurface(activity, host, mainComponentName, snapshot, surfaceFormDecision.surfaceForm)
    }

    return PrimaryLaunchOptionsDelegate(
      activity = activity,
      mainComponentName = mainComponentName,
      host = host,
      displayCount = snapshot.displayCount,
      surfaceForm = surfaceFormDecision.surfaceForm,
    )
  }

  private fun readSurfaceFormDecision(activity: ReactActivity): SurfaceFormDecision = try {
    classifySurfaceForm(activity.resources.configuration.smallestScreenWidthDp)
  } catch (_error: Throwable) {
    classifySurfaceForm(null).copy(diagnostic = "smallest-screen-width-read-failed")
  }

  private fun readDisplaySnapshot(activity: ReactActivity): DisplaySnapshot? {
    val displayManager = activity.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
      ?: run {
        log("display-manager-unavailable")
        TerminalSurfaceHostRegistry.markUnavailable(
          surfaceIndex = 0,
          displayId = activity.window.decorView.display?.displayId,
          windowIdentity = "primary",
          reason = "display-manager-unavailable",
        )
        return null
      }
    return try {
      val displays = displayManager.displays.toList()
      displays.forEachIndexed { index, display ->
        logDisplayMetrics("display-snapshot-entry", display, index)
      }
      when (val selection = readDisplaySnapshotSelection { displays.map { it.displayId } }) {
        is DisplaySnapshotReadResult.Unavailable -> {
          log(selection.reason)
          TerminalSurfaceHostRegistry.markUnavailable(
            surfaceIndex = 0,
            displayId = activity.window.decorView.display?.displayId,
            windowIdentity = "primary",
            reason = selection.reason,
          )
          null
        }
        is DisplaySnapshotReadResult.Ready -> {
          val snapshot = DisplaySnapshot(
            displayCount = selection.displayCount,
            secondaryDisplay = selection.secondaryDisplayIndex?.let(displays::get),
          )
          log(
            "display-snapshot-read",
            "displayCount=${snapshot.displayCount}",
            "secondaryDisplayId=${snapshot.secondaryDisplay?.displayId ?: "none"}",
          )
          snapshot
        }
      }
    } catch (_error: Throwable) {
      log("display-snapshot-failed")
      TerminalSurfaceHostRegistry.markUnavailable(
        surfaceIndex = 0,
        displayId = activity.window.decorView.display?.displayId,
        windowIdentity = "primary",
        reason = "display-snapshot-failed",
      )
      null
    }
  }

  private fun ensureSecondarySurface(
    activity: ReactActivity,
    host: ReactHost,
    mainComponentName: String,
    snapshot: DisplaySnapshot,
    surfaceForm: String,
  ) {
    val targetDisplay = snapshot.secondaryDisplay ?: return
    logDisplayMetrics("secondary-target-display", targetDisplay, 1)
    val targetMetrics = DisplayMetrics().also(targetDisplay::getMetrics)
    val renderMetrics = sharedReactRenderMetrics(activity)
    log(
      "secondary-target-metrics",
      "displayId=${targetDisplay.displayId}",
      "widthPx=${targetMetrics.widthPixels}",
      "heightPx=${targetMetrics.heightPixels}",
      "densityDpi=${targetMetrics.densityDpi}",
      "density=${targetMetrics.density}",
      "scaledDensity=${targetMetrics.scaledDensity}",
      "hardwareDensityDpi=${targetMetrics.densityDpi}",
      "hardwareDensity=${targetMetrics.density}",
      "renderDensityDpi=${renderMetrics.densityDpi}",
      "renderDensity=${renderMetrics.density}",
      "renderDensitySource=react-native.DisplayMetricsHolder.screen",
    )
    synchronized(stateLock) {
      if (launchRequested || secondaryState != null) {
        log("secondary-launch-idempotent-return")
        return
      }
      launchRequested = true
    }

    ensureLifecycleCallbacks(activity.application)

    var presentation: TerminalPresentation? = null
    var surface: ReactSurface? = null
    try {
      presentation = TerminalPresentation(
        context = activity,
        display = targetDisplay,
        onRemoved = { requestCleanupForCurrentSecondary("display-removed") },
      )
      logConfiguration(
        "presentation-context-before-surface",
        presentation.context.resources.configuration,
        presentation.context.resources.displayMetrics,
        1,
      )
      surface = host.createSurface(
        createSurfaceContext(
          presentation.context,
          renderMetrics.densityDpi,
        ),
        mainComponentName,
        createSurfaceLaunchOptions(
          displayIndex = 1,
          displayCount = snapshot.displayCount,
          surfaceForm = surfaceForm,
        ).toBundle(),
      )
      val view = surface.view ?: throw IllegalStateException("secondary ReactSurface view unavailable")
      view.addOnLayoutChangeListener { changedView, _, _, _, _, _, _, _, _ ->
        logViewBounds("secondary-react-surface-layout", changedView, 1)
      }
      logConfiguration(
        "secondary-react-surface-context",
        view.resources.configuration,
        view.resources.displayMetrics,
        1,
      )
      log(
        "secondary-react-surface-created",
        "displayId=${targetDisplay.displayId}",
        "surfaceDensityDpi=${view.resources.displayMetrics.densityDpi}",
        "surfaceDensity=${view.resources.displayMetrics.density}",
        "surfaceWidthPx=${view.width}",
        "surfaceHeightPx=${view.height}",
      )
      view.post { logViewBounds("secondary-react-surface-post-layout", view, 1) }
      val state = SecondaryState(
        presentation = presentation,
        surface = surface,
      )
      synchronized(stateLock) {
        secondaryState = state
      }
      presentation.attachSurfaceView(view)
      presentation.setContentView(view)
      presentation.show()
      presentation.window?.let { window ->
        window.decorView.post {
          logViewBounds("secondary-presentation-window-post-layout", window.decorView, 1)
          TerminalSurfaceHostRegistry.captureWindow(1, window, "secondary", surfaceView = view)
        }
      }
      observeStart(state, surface.start())
      log(
        "secondary-start-requested",
        "displayId=${targetDisplay.displayId}",
        "displayCount=${snapshot.displayCount}",
      )
    } catch (_error: Throwable) {
      val currentState = synchronized(stateLock) { secondaryState }
      if (currentState != null) {
        requestCleanup(currentState, "secondary-create-failed")
      } else {
        releaseUnstarted(surface, presentation)
      }
      log("secondary-create-failed")
    }
  }

  private fun observeStart(state: SecondaryState, task: TaskInterface<Void>) {
    observeTask(task) { failed ->
      if (failed) {
        log("secondary-start-failed")
        requestCleanup(state, "secondary-start-failed")
      } else {
        log("secondary-start-completed")
      }
    }
  }

  private fun requestCleanupForCurrentSecondary(reason: String) {
    val state = synchronized(stateLock) { secondaryState } ?: return
    requestCleanup(state, reason)
  }

  private fun requestCleanup(state: SecondaryState, reason: String) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { requestCleanup(state, reason) }
      return
    }
    if (!state.cleanupStarted.compareAndSet(false, true)) return

    log("secondary-cleanup-requested")
    val stopTask = try {
      state.surface.stop()
    } catch (_error: Throwable) {
      log("secondary-stop-failed")
      null
    }
    if (stopTask == null) {
      finishCleanup(state)
      return
    }
    observeTask(stopTask) { failed ->
      if (failed) log("secondary-stop-failed") else log("secondary-stop-completed")
      finishCleanup(state)
    }
  }

  private fun finishCleanup(state: SecondaryState) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { finishCleanup(state) }
      return
    }
    runCatching {
      state.surface.detach()
      log("secondary-detached")
    }.onFailure { log("secondary-detach-failed") }
    runCatching {
      state.surface.clear()
      log("secondary-cleared")
    }.onFailure { log("secondary-clear-failed") }
    state.presentation.window?.let { TerminalSurfaceHostRegistry.remove(1, it, "secondary-cleanup") }
    runCatching { state.presentation.dismiss() }.onFailure { log("secondary-dismiss-failed") }
    synchronized(stateLock) {
      if (secondaryState === state) secondaryState = null
      launchRequested = false
    }
    unregisterLifecycleCallbacksIfIdle()
    log("secondary-cleanup-completed")
  }

  private fun releaseUnstarted(surface: ReactSurface?, presentation: TerminalPresentation?) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { releaseUnstarted(surface, presentation) }
      return
    }
    if (surface != null) {
      runCatching { surface.detach() }.onFailure { log("secondary-detach-failed") }
      runCatching { surface.clear() }.onFailure { log("secondary-clear-failed") }
    }
    presentation?.window?.let { TerminalSurfaceHostRegistry.remove(1, it, "secondary-release-before-start") }
    runCatching { presentation?.dismiss() }.onFailure { log("secondary-dismiss-failed") }
    synchronized(stateLock) { launchRequested = false }
    unregisterLifecycleCallbacksIfIdle()
  }

  private fun observeTask(task: TaskInterface<Void>, callback: (Boolean) -> Unit) {
    Thread {
      var failed = false
      try {
        task.waitForCompletion()
        failed = task.isFaulted() || task.isCancelled()
      } catch (_error: Throwable) {
        failed = true
      }
      mainHandler.post { callback(failed) }
    }.apply {
      name = "terminal-dual-screen-task"
      isDaemon = true
      start()
    }
  }

  private fun sharedReactRenderMetrics(context: Context): DisplayMetrics {
    DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(context.applicationContext)
    return DisplayMetrics().also { it.setTo(DisplayMetricsHolder.getScreenDisplayMetrics()) }
  }

  private fun createSurfaceContext(base: Context, renderDensityDpi: Int): Context {
    logConfiguration(
      "secondary-surface-context-input",
      base.resources.configuration,
      base.resources.displayMetrics,
      1,
    )
    val configuration = Configuration(base.resources.configuration)
    configuration.densityDpi = renderDensityDpi
    log(
      "secondary-surface-context-normalized",
      "hardwareTargetDensityDpi=${base.resources.displayMetrics.densityDpi}",
      "renderDensityDpi=${configuration.densityDpi}",
      "renderDensitySource=react-native.DisplayMetricsHolder.screen",
    )
    val context = base.createConfigurationContext(configuration)
    logConfiguration(
      "secondary-surface-context-output",
      context.resources.configuration,
      context.resources.displayMetrics,
      1,
    )
    return context
  }

  private fun unregisterLifecycleCallbacksIfIdle() {
    val application = synchronized(stateLock) {
      if (primaryActivity != null || secondaryState != null || launchRequested) null else registeredApplication
    } ?: return
    application.unregisterActivityLifecycleCallbacks(this)
    registeredApplication = null
  }

  override fun onActivityDestroyed(activity: Activity) {
    if (activity === primaryActivity) {
      TerminalSurfaceHostRegistry.remove(0, activity.window, "primary-destroyed")
      primaryActivity = null
      requestCleanupForCurrentSecondary("primary-destroyed")
      unregisterLifecycleCallbacksIfIdle()
    }
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
  override fun onActivityStarted(activity: Activity) = Unit
  override fun onActivityResumed(activity: Activity) {
    applyImmersiveWindow(activity.window)
  }
  override fun onActivityPaused(activity: Activity) = Unit
  override fun onActivityStopped(activity: Activity) = Unit
  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

  private fun log(event: String, vararg fields: String) {
    val suffix = if (fields.isEmpty()) "" else " ${fields.joinToString(" ")}"
    Log.i(LOG_TAG, "event=$event$suffix")
  }

  private fun ensureLifecycleCallbacks(application: Application) {
    synchronized(stateLock) {
      if (registeredApplication === application) return
      registeredApplication?.unregisterActivityLifecycleCallbacks(this)
      application.registerActivityLifecycleCallbacks(this)
      registeredApplication = application
    }
  }

  private data class DisplaySnapshot(
    val displayCount: Int,
    val secondaryDisplay: Display?,
  )

  private data class SecondaryState(
    val presentation: TerminalPresentation,
    val surface: ReactSurface,
    val cleanupStarted: AtomicBoolean = AtomicBoolean(false),
  )
}

private class PrimaryLaunchOptionsDelegate(
  activity: ReactActivity,
  mainComponentName: String,
  private val host: ReactHost,
  private val displayCount: Int,
  private val surfaceForm: String,
) : DefaultReactActivityDelegate(activity, mainComponentName, fabricEnabled) {
  override fun getReactHost(): ReactHost = host

  override fun getLaunchOptions(): Bundle = createSurfaceLaunchOptions(
    displayIndex = 0,
    displayCount = displayCount,
    surfaceForm = surfaceForm,
  ).toBundle()
}

private class TerminalPresentation(
  context: Context,
  private val display: Display,
  private val onRemoved: () -> Unit,
) : Presentation(
  context,
  display,
  androidx.appcompat.R.style.Theme_AppCompat_DayNight_NoActionBar,
) {
  private var surfaceView: View? = null

  fun attachSurfaceView(view: View) {
    surfaceView = view
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    logDisplayMetrics("presentation-display", display, 1)
    window?.let { presentationWindow ->
      applyImmersiveWindow(presentationWindow)
      presentationWindow.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
      logConfiguration(
        "presentation-window-configuration",
        presentationWindow.context.resources.configuration,
        presentationWindow.context.resources.displayMetrics,
        1,
      )
      presentationWindow.decorView.addOnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
        logViewBounds("secondary-presentation-window-layout", view, 1)
        TerminalSurfaceHostRegistry.captureWindow(1, presentationWindow, "secondary", surfaceView = surfaceView)
      }
      presentationWindow.decorView.post {
        logViewBounds("secondary-presentation-window-post-create", presentationWindow.decorView, 1)
        TerminalSurfaceHostRegistry.captureWindow(1, presentationWindow, "secondary", surfaceView = surfaceView)
      }
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    Log.i(LOG_TAG, "event=secondary-presentation-focus displayIndex=1 displayId=${display.displayId} hasFocus=$hasFocus")
    if (hasFocus) window?.let(::applyImmersiveWindow)
  }

  override fun onDisplayRemoved() {
    onRemoved()
    super.onDisplayRemoved()
  }

}

private fun applyImmersiveWindow(window: Window) {
  window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
  window.decorView.systemUiVisibility = (
    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      or View.SYSTEM_UI_FLAG_FULLSCREEN
      or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
      or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    )
  if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
    window.setDecorFitsSystemWindows(false)
    window.insetsController?.let { controller ->
      controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
      controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
  }
}
