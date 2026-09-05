package com.catering.v2s.terminal.adapter.android.dualscreen

import android.app.Activity
import android.app.Application
import android.app.Presentation
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.interfaces.TaskInterface
import com.facebook.react.interfaces.fabric.ReactSurface
import expo.modules.core.interfaces.ReactActivityHandler
import java.util.concurrent.atomic.AtomicBoolean

private const val LOG_TAG = "TerminalDualScreen"

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
    val snapshot = readDisplaySnapshot(activity) ?: return null
    val host = delegate.reactHost ?: run {
      log("primary-host-unavailable")
      return null
    }
    val mainComponentName = delegate.mainComponentName ?: run {
      log("primary-component-unavailable")
      return null
    }

    primaryActivity = activity
    if (snapshot.secondaryDisplay != null) {
      ensureSecondarySurface(activity, host, mainComponentName, snapshot)
    }

    return PrimaryLaunchOptionsDelegate(
      activity = activity,
      mainComponentName = mainComponentName,
      host = host,
      displayCount = snapshot.displayCount,
    )
  }

  private fun readDisplaySnapshot(activity: ReactActivity): DisplaySnapshot? {
    val displayManager = activity.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
      ?: run {
        log("display-manager-unavailable")
        return null
      }
    return try {
      val displays = displayManager.displays.toList()
      val snapshot = DisplaySnapshot(
        displayCount = displays.size,
        secondaryDisplay = displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY },
      )
      log(
        "display-snapshot-read",
        "displayCount=${snapshot.displayCount}",
        "secondaryDisplayId=${snapshot.secondaryDisplay?.displayId ?: "none"}",
      )
      snapshot
    } catch (_error: Throwable) {
      log("display-snapshot-failed")
      null
    }
  }

  private fun ensureSecondarySurface(
    activity: ReactActivity,
    host: ReactHost,
    mainComponentName: String,
    snapshot: DisplaySnapshot,
  ) {
    val targetDisplay = snapshot.secondaryDisplay ?: return
    synchronized(stateLock) {
      if (launchRequested || secondaryState != null) {
        log("secondary-launch-idempotent-return")
        return
      }
      launchRequested = true
    }

    val application = activity.application
    application.registerActivityLifecycleCallbacks(this)
    registeredApplication = application

    var presentation: TerminalPresentation? = null
    var surface: ReactSurface? = null
    try {
      presentation = TerminalPresentation(
        context = activity,
        display = targetDisplay,
        onRemoved = { requestCleanupForCurrentSecondary("display-removed") },
      )
      surface = host.createSurface(
        presentation.context,
        mainComponentName,
        Bundle().apply {
          putInt("displayIndex", 1)
          putInt("displayCount", snapshot.displayCount)
        },
      )
      val view = surface.view ?: throw IllegalStateException("secondary ReactSurface view unavailable")
      val state = SecondaryState(
        presentation = presentation,
        surface = surface,
      )
      synchronized(stateLock) {
        secondaryState = state
      }
      presentation.setContentView(view)
      presentation.show()
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

  private fun unregisterLifecycleCallbacksIfIdle() {
    val application = synchronized(stateLock) {
      if (secondaryState != null || launchRequested) null else registeredApplication
    } ?: return
    application.unregisterActivityLifecycleCallbacks(this)
    registeredApplication = null
  }

  override fun onActivityDestroyed(activity: Activity) {
    if (activity === primaryActivity) {
      requestCleanupForCurrentSecondary("primary-destroyed")
    }
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
  override fun onActivityStarted(activity: Activity) = Unit
  override fun onActivityResumed(activity: Activity) = Unit
  override fun onActivityPaused(activity: Activity) = Unit
  override fun onActivityStopped(activity: Activity) = Unit
  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

  private fun log(event: String, vararg fields: String) {
    val suffix = if (fields.isEmpty()) "" else " ${fields.joinToString(" ")}"
    Log.i(LOG_TAG, "event=$event$suffix")
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
) : DefaultReactActivityDelegate(activity, mainComponentName, fabricEnabled) {
  override fun getReactHost(): ReactHost = host

  override fun getLaunchOptions(): Bundle = Bundle().apply {
    putInt("displayIndex", 0)
    putInt("displayCount", displayCount)
  }
}

private class TerminalPresentation(
  context: Context,
  display: Display,
  private val onRemoved: () -> Unit,
) : Presentation(
  context,
  display,
  androidx.appcompat.R.style.Theme_AppCompat_DayNight_NoActionBar,
) {
  override fun onDisplayRemoved() {
    onRemoved()
    super.onDisplayRemoved()
  }
}
