package com.catering.v2s.terminal.assembly.base.android

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewTreeObserver
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
  private const val MAIN_QUEUE_TIMEOUT_MS = 2_000L
  private val mainHandler = Handler(Looper.getMainLooper())
  private val lock = Any()
  private val gatesByActivity = IdentityHashMap<Activity, Gate>()
  private val gatesByToken = mutableMapOf<String, Gate>()
  private var registeredApplication: Application? = null
  private var nextToken = 0L

  private data class Gate(
    val token: String,
    val activity: Activity,
    val contentView: View,
    val listener: ViewTreeObserver.OnPreDrawListener,
    var released: Boolean = false,
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
      gates.forEach(::removeListener)
    }
  }

  /** Called from each App's MainActivity before React's super.onCreate. */
  @JvmStatic
  fun registerOnActivity(activity: Activity) {
    onMain { installOnMain(activity) }
  }

  fun beginHide(activity: Activity, reason: String): Map<String, Any?> = onMain {
    val gate = installOnMain(activity)
      ?: throw IllegalStateException("native loading content view is unavailable")
    synchronized(lock) {
      mapOf(
        "activityInstanceId" to gate.token,
        "alreadyHidden" to gate.released,
        "reason" to reason,
      )
    }
  }

  fun releaseHide(activityInstanceId: String): Map<String, Any?> = onMain {
    val gate = synchronized(lock) { gatesByToken[activityInstanceId] }
      ?: throw IllegalStateException("native loading Activity instance is unavailable")
    synchronized(lock) { gate.released = true }
    mapOf(
      "activityInstanceId" to activityInstanceId,
      "hidden" to true,
    )
  }

  private fun installOnMain(activity: Activity): Gate? {
    check(Looper.myLooper() === Looper.getMainLooper())
    synchronized(lock) {
      gatesByActivity[activity]?.let { return it }
    }
    val contentView = activity.findViewById<View>(android.R.id.content) ?: return null
    lateinit var gate: Gate
    val listener = ViewTreeObserver.OnPreDrawListener {
      val released = synchronized(lock) { gate.released }
      if (!released) return@OnPreDrawListener false
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
    return gate
  }

  private fun removeOnMain(activity: Activity) {
    check(Looper.myLooper() === Looper.getMainLooper())
    val gate = synchronized(lock) {
      gatesByActivity.remove(activity)?.also { gatesByToken.remove(it.token) }
    } ?: return
    removeListener(gate)
  }

  private fun removeListener(gate: Gate) {
    if (gate.contentView.viewTreeObserver.isAlive) {
      gate.contentView.viewTreeObserver.removeOnPreDrawListener(gate.listener)
    }
  }

  private fun <T> onMain(block: () -> T): T {
    if (Looper.myLooper() === Looper.getMainLooper()) return block()
    val task = FutureTask(Callable { block() })
    mainHandler.post(task)
    return task.get(MAIN_QUEUE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
  }
}
