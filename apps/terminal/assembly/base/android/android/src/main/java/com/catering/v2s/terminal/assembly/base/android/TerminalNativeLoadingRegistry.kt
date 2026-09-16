package com.catering.v2s.terminal.assembly.base.android

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import android.widget.ImageView
import java.util.IdentityHashMap
import java.util.concurrent.Callable
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Holds the native pre-draw gate for each concrete Activity instance. The
 * Expo splash manager keeps a process-wide flag, so its flag alone cannot
 * protect a newly recreated Activity after an earlier hide. This registry is
 * deliberately independent of the JS runtime lifetime.
 */
object TerminalNativeLoadingRegistry {
  private const val LOG_TAG = "TER-Splash"
  private const val MAIN_QUEUE_TIMEOUT_MS = 2_000L
  private val mainHandler = Handler(Looper.getMainLooper())
  private val lock = Any()
  private val gatesByActivity = IdentityHashMap<Activity, Gate>()
  private val gatesByToken = mutableMapOf<String, Gate>()
  private var registeredApplication: Application? = null
  private var nextToken = 0L
  private var loadingOverlayConfig: LoadingOverlayConfig? = null

  private data class LoadingOverlayConfig(
    val backgroundColorResId: Int,
    val logoResId: Int,
  )

  private data class Gate(
    val token: String,
    val activity: Activity,
    val contentView: View,
    val listener: ViewTreeObserver.OnPreDrawListener,
    var released: Boolean = false,
    var blockedLogged: Boolean = false,
    var coveredLogged: Boolean = false,
    var releasedLogged: Boolean = false,
    var loadingOverlay: View? = null,
  )

  private val lifecycleCallbacks = object : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
      installOnMain(activity)
    }

    override fun onActivityDestroyed(activity: Activity) {
      removeOnMain(activity)
    }

    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityResumed(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
  }

  @JvmStatic
  fun registerApplication(application: Application) {
    onMain {
      if (registeredApplication === application) return@onMain
      registeredApplication?.unregisterActivityLifecycleCallbacks(lifecycleCallbacks)
      application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
      registeredApplication = application
      Log.i(LOG_TAG, "event=native.application-callbacks-registered")
    }
  }

  @JvmStatic
  fun unregisterApplication(application: Application?) {
    onMain {
      val registered = registeredApplication ?: return@onMain
      if (application != null && registered !== application) return@onMain
      registered.unregisterActivityLifecycleCallbacks(lifecycleCallbacks)
      registeredApplication = null
      val gates = synchronized(lock) {
        val values = gatesByActivity.values.toList()
        gatesByActivity.clear()
        gatesByToken.clear()
        values
      }
      loadingOverlayConfig = null
      gates.forEach(::removeListener)
      Log.i(LOG_TAG, "event=native.application-callbacks-unregistered")
    }
  }

  /** Called from each App's MainActivity before React's super.onCreate. */
  @JvmStatic
  fun registerOnActivity(activity: Activity, backgroundColorResId: Int, logoResId: Int) {
    onMain {
      loadingOverlayConfig = LoadingOverlayConfig(backgroundColorResId, logoResId)
      installOnMain(activity)
    }
  }

  /**
   * React replaces the content hierarchy during super.onCreate. Attach the
   * app-owned copy of the native splash after that replacement, while the
   * pre-draw gate still blocks the first business frame.
   */
  @JvmStatic
  fun attachLoadingOverlay(activity: Activity) {
    onMain {
      val gate = synchronized(lock) { gatesByActivity[activity] } ?: run {
        Log.i(LOG_TAG, "event=native.loading-overlay-skipped reason=gate-unavailable")
        return@onMain
      }
      attachLoadingOverlayOnMain(gate)
    }
  }

  fun beginHide(activity: Activity, reason: String): Map<String, Any?> = onMain {
    val gate = installOnMain(activity)
      ?: throw IllegalStateException("native loading content view is unavailable")
    val safeReason = when (reason) {
      "startup-ready", "startup-failure" -> reason
      else -> "other"
    }
    val result: Map<String, Any?>
    synchronized(lock) {
      result = mapOf(
        "activityInstanceId" to gate.token,
        "alreadyHidden" to gate.released,
        "reason" to reason,
      )
    }
    Log.i(LOG_TAG, "event=native.begin-hide reason=$safeReason activity=${gate.token} alreadyReleased=${result["alreadyHidden"]}")
    result
  }

  fun releaseHide(activityInstanceId: String): Map<String, Any?> = onMain {
    val gate = synchronized(lock) { gatesByToken[activityInstanceId] }
      ?: throw IllegalStateException("native loading Activity instance is unavailable")
    synchronized(lock) { gate.released = true }
    Log.i(LOG_TAG, "event=native.release-hide activity=$activityInstanceId")
    fadeOutLoadingOverlayOnMain(gate)
    mapOf(
      "activityInstanceId" to activityInstanceId,
      "hidden" to true,
    )
  }

  private fun installOnMain(activity: Activity): Gate? {
    check(Looper.myLooper() === Looper.getMainLooper())
    synchronized(lock) {
      gatesByActivity[activity]?.let {
        attachLoadingOverlayOnMain(it)
        return it
      }
    }
    val contentView = activity.findViewById<View>(android.R.id.content) ?: run {
      Log.i(LOG_TAG, "event=native.gate-install-skipped reason=content-unavailable")
      return null
    }
    lateinit var gate: Gate
    val listener = ViewTreeObserver.OnPreDrawListener {
      var logBlocked = false
      var logCovered = false
      var logReleased = false
      var covered = false
      val released = synchronized(lock) {
        if (gate.released) {
          logReleased = !gate.releasedLogged
          gate.releasedLogged = true
        } else {
          covered = gate.loadingOverlay != null
          if (covered) {
            logCovered = !gate.coveredLogged
            gate.coveredLogged = true
          } else {
            logBlocked = !gate.blockedLogged
            gate.blockedLogged = true
          }
        }
        gate.released
      }
      if (logBlocked) Log.i(LOG_TAG, "event=native.pre-draw-blocked activity=${gate.token}")
      if (logCovered) Log.i(LOG_TAG, "event=native.pre-draw-covered activity=${gate.token}")
      if (!released && covered) return@OnPreDrawListener true
      if (!released) return@OnPreDrawListener false
      if (logReleased) Log.i(LOG_TAG, "event=native.pre-draw-released activity=${gate.token}")
      if (gate.contentView.viewTreeObserver.isAlive) {
        gate.contentView.viewTreeObserver.removeOnPreDrawListener(gate.listener)
      }
      true
    }
    synchronized(lock) {
      gatesByActivity[activity]?.let { return it }
      nextToken += 1
      gate = Gate(
        token = "native-splash-activity-$nextToken",
        activity = activity,
        contentView = contentView,
        listener = listener,
      )
      gatesByActivity[activity] = gate
      gatesByToken[gate.token] = gate
    }
    contentView.viewTreeObserver.addOnPreDrawListener(listener)
    Log.i(LOG_TAG, "event=native.gate-installed activity=${gate.token}")
    attachLoadingOverlayOnMain(gate)
    return gate
  }

  private fun attachLoadingOverlayOnMain(gate: Gate) {
    check(Looper.myLooper() === Looper.getMainLooper())
    val config = loadingOverlayConfig ?: run {
      Log.i(LOG_TAG, "event=native.loading-overlay-skipped reason=config-unavailable activity=${gate.token}")
      return
    }
    if (synchronized(lock) { gate.released }) return
    val parent = gate.activity.findViewById<View>(android.R.id.content) as? ViewGroup ?: run {
      Log.i(LOG_TAG, "event=native.loading-overlay-skipped reason=content-unavailable activity=${gate.token}")
      return
    }
    val existing = synchronized(lock) { gate.loadingOverlay }
    if (existing != null && existing.parent === parent) {
      existing.bringToFront()
      return
    }
    if (existing != null) {
      (existing.parent as? ViewGroup)?.removeView(existing)
    }
    val overlay = FrameLayout(gate.activity).apply {
      setBackgroundColor(gate.activity.resources.getColor(config.backgroundColorResId, gate.activity.theme))
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
      isClickable = false
      isFocusable = false
      alpha = 1f
    }
    val logo = ImageView(gate.activity).apply {
      setImageResource(config.logoResId)
      scaleType = ImageView.ScaleType.CENTER_INSIDE
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
      isClickable = false
      isFocusable = false
    }
    overlay.addView(
      logo,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
        Gravity.CENTER,
      ),
    )
    parent.addView(
      overlay,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    synchronized(lock) { gate.loadingOverlay = overlay }
    overlay.bringToFront()
    Log.i(LOG_TAG, "event=native.loading-overlay-attached activity=${gate.token}")
  }

  private fun fadeOutLoadingOverlayOnMain(gate: Gate) {
    check(Looper.myLooper() === Looper.getMainLooper())
    val overlay = synchronized(lock) { gate.loadingOverlay } ?: run {
      Log.i(LOG_TAG, "event=native.loading-overlay-fade-skipped reason=not-attached activity=${gate.token}")
      return
    }
    Log.i(LOG_TAG, "event=native.loading-overlay-fade-start activity=${gate.token}")
    overlay.animate()
      .alpha(0f)
      .setDuration(300L)
      .withEndAction {
        (overlay.parent as? ViewGroup)?.removeView(overlay)
        synchronized(lock) {
          if (gate.loadingOverlay === overlay) gate.loadingOverlay = null
        }
        Log.i(LOG_TAG, "event=native.loading-overlay-removed activity=${gate.token}")
      }
      .start()
  }

  private fun removeOnMain(activity: Activity) {
    check(Looper.myLooper() === Looper.getMainLooper())
    val gate = synchronized(lock) {
      gatesByActivity.remove(activity)?.also { gatesByToken.remove(it.token) }
    } ?: return
    removeListener(gate)
    Log.i(LOG_TAG, "event=native.gate-removed activity=${gate.token}")
  }

  private fun removeListener(gate: Gate) {
    if (gate.contentView.viewTreeObserver.isAlive) {
      gate.contentView.viewTreeObserver.removeOnPreDrawListener(gate.listener)
    }
    synchronized(lock) { gate.loadingOverlay }?.let { overlay ->
      (overlay.parent as? ViewGroup)?.removeView(overlay)
      synchronized(lock) {
        if (gate.loadingOverlay === overlay) gate.loadingOverlay = null
      }
    }
  }

  private fun <T> onMain(block: () -> T): T {
    if (Looper.myLooper() === Looper.getMainLooper()) return block()
    val task = FutureTask(Callable { block() })
    mainHandler.post(task)
    return task.get(MAIN_QUEUE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
  }
}
