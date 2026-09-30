package com.catering.v2s.terminal.application.base.android

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import android.widget.ImageView
import expo.modules.kotlin.exception.CodedException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.IdentityHashMap
import java.util.concurrent.atomic.AtomicLong

internal const val TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT = "TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT"

internal suspend fun <T> runNativeLoadingOnMainThread(
  operation: String,
  timeoutMs: Long,
  dispatcher: CoroutineDispatcher = Dispatchers.Main.immediate,
  onTimeout: (operation: String, failureCode: String, timeoutMs: Long, elapsedMs: Long) -> Unit,
  block: () -> T,
): T {
  val startedAt = SystemClock.elapsedRealtime()
  try {
    return withTimeout(timeoutMs) { withContext(dispatcher) { block() } }
  } catch (_error: TimeoutCancellationException) {
    onTimeout(
      operation,
      TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT,
      timeoutMs,
      SystemClock.elapsedRealtime() - startedAt,
    )
    throw CodedException(
      TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT,
      "native loading operation exceeded its main-thread deadline",
      null,
    )
  }
}

/**
 * Keeps the Activity-identity and public-token views of the same gates in sync.
 * Callers serialize access with the owning registry lock.
 */
internal class NativeLoadingGateIndex<Owner : Any, Gate : Any>(
  private val tokenOf: (Gate) -> String,
) {
  private val byOwner = IdentityHashMap<Owner, Gate>()
  private val byToken = mutableMapOf<String, Gate>()

  fun forOwner(owner: Owner): Gate? = byOwner[owner]

  fun forToken(token: String): Gate? = byToken[token]

  fun put(owner: Owner, gate: Gate) {
    byOwner[owner] = gate
    byToken[tokenOf(gate)] = gate
  }

  fun remove(owner: Owner): Gate? {
    val gate = byOwner.remove(owner) ?: return null
    val token = tokenOf(gate)
    if (byToken[token] === gate) byToken.remove(token)
    return gate
  }
}

internal class NativeLoadingFadeAfterFrame {
  private var scheduled = false

  @Synchronized
  fun schedule(registerFrameCommit: (Runnable) -> Unit, fade: Runnable): Boolean {
    if (scheduled) return false
    scheduled = true
    registerFrameCommit(fade)
    return true
  }
}

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
  private val gateIndex = NativeLoadingGateIndex<Activity, Gate> { it.token }
  private var registeredApplication: Application? = null
  private var nextToken = 0L
  private var loadingOverlayConfig: LoadingOverlayConfig? = null
  private val debugMainThreadDelayBeforeNextDispatchMs = AtomicLong(0L)

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
    val fadeAfterFrame: NativeLoadingFadeAfterFrame = NativeLoadingFadeAfterFrame(),
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
    mainHandler.post {
      if (registeredApplication === application) return@post
      registeredApplication?.unregisterActivityLifecycleCallbacks(lifecycleCallbacks)
      application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
      registeredApplication = application
      Log.i(LOG_TAG, "event=native.application-callbacks-registered owner=application-process")
    }
  }

  @JvmStatic
  fun armDebugMainThreadDelayBeforeNextDispatch(delayMs: Long) {
    if (!BuildConfig.DEBUG || delayMs !in 2_100L..4_000L) return
    debugMainThreadDelayBeforeNextDispatchMs.set(delayMs)
    Log.i(LOG_TAG, "event=native.debug-main-thread-delay-armed delayMs=$delayMs")
  }

  /** Called from each App's MainActivity before React's super.onCreate. */
  @JvmStatic
  fun registerOnActivity(activity: Activity, backgroundColorResId: Int, logoResId: Int) {
    checkMainThread()
    loadingOverlayConfig = LoadingOverlayConfig(backgroundColorResId, logoResId)
    installOnMain(activity)
  }

  /**
   * React replaces the content hierarchy during super.onCreate. Attach the
   * app-owned copy of the native splash after that replacement, while the
   * pre-draw gate still blocks the first business frame.
   */
  @JvmStatic
  fun attachLoadingOverlay(activity: Activity) {
    checkMainThread()
    val gate = synchronized(lock) { gateIndex.forOwner(activity) } ?: run {
      Log.i(LOG_TAG, "event=native.loading-overlay-skipped reason=gate-unavailable")
      return
    }
    attachLoadingOverlayOnMain(gate)
  }

  suspend fun beginHide(activity: Activity, reason: String): Map<String, Any?> = dispatchToMainThread("beginHide") {
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

  suspend fun releaseHide(activityInstanceId: String): Map<String, Any?> = dispatchToMainThread("releaseHide") {
    val gate = synchronized(lock) { gateIndex.forToken(activityInstanceId) }
      ?: throw IllegalStateException("native loading Activity instance is unavailable")
    synchronized(lock) { gate.released = true }
    Log.i(LOG_TAG, "event=native.release-hide activity=$activityInstanceId")
    mapOf(
      "activityInstanceId" to activityInstanceId,
      "hidden" to true,
    )
  }

  private fun installOnMain(activity: Activity): Gate? {
    check(Looper.myLooper() === Looper.getMainLooper())
    synchronized(lock) {
      gateIndex.forOwner(activity)?.let {
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
      if (logReleased) {
        Log.i(LOG_TAG, "event=native.loading-overlay-fade-deferred reason=first-released-frame-commit activity=${gate.token}")
        gate.fadeAfterFrame.schedule(
          registerFrameCommit = { fade ->
            val observer = gate.contentView.viewTreeObserver
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && observer.isAlive) {
              observer.registerFrameCommitCallback {
                mainHandler.post {
                  Log.i(LOG_TAG, "event=native.loading-overlay-frame-committed activity=${gate.token}")
                  fade.run()
                }
              }
            } else {
              // Older Android versions do not expose frame-commit callbacks.
              // Keep the native cover for one additional display-frame turn.
              gate.contentView.postOnAnimation(fade)
            }
          },
          fade = Runnable { fadeOutLoadingOverlayOnMain(gate) },
        )
      }
      if (gate.contentView.viewTreeObserver.isAlive) {
        gate.contentView.viewTreeObserver.removeOnPreDrawListener(gate.listener)
      }
      true
    }
    synchronized(lock) {
      gateIndex.forOwner(activity)?.let { return it }
      nextToken += 1
      gate = Gate(
        token = "native-splash-activity-$nextToken",
        activity = activity,
        contentView = contentView,
        listener = listener,
      )
      gateIndex.put(activity, gate)
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
      gateIndex.remove(activity)
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

  private fun checkMainThread() {
    check(Looper.myLooper() === Looper.getMainLooper()) { "native loading lifecycle must run on the main thread" }
  }

  private suspend fun <T> dispatchToMainThread(operation: String, block: () -> T): T {
    if (BuildConfig.DEBUG) {
      val debugDelayMs = debugMainThreadDelayBeforeNextDispatchMs.getAndSet(0L)
      if (debugDelayMs > 0L) {
        mainHandler.post {
          Log.w(LOG_TAG, "event=native.debug-main-thread-delay-start operation=$operation delayMs=$debugDelayMs")
          SystemClock.sleep(debugDelayMs)
          Log.w(LOG_TAG, "event=native.debug-main-thread-delay-finished operation=$operation delayMs=$debugDelayMs")
        }
      }
    }
    return runNativeLoadingOnMainThread(
      operation = operation,
      timeoutMs = MAIN_QUEUE_TIMEOUT_MS,
      onTimeout = { timedOperation, failureCode, timeoutMs, elapsedMs ->
        Log.e(
          LOG_TAG,
          "event=native.main-thread-operation status=timeout operation=$timedOperation " +
            "failureCode=$failureCode timeoutMs=$timeoutMs elapsedMs=$elapsedMs",
        )
      },
      block = block,
    )
  }
}
