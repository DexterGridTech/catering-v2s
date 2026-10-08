package com.catering.v2s.terminal.adapter.android.update

import android.app.Activity
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import java.lang.ref.WeakReference

/** Native-only terminal update failure surface for a boot with no safe bundle target. */
object TerminalUpdateStartupFailureView {
  const val CONTENT_DESCRIPTION = "terminal-update-startup-failure"
  private const val LOG_TAG = "TerminalUpdate"
  private const val VIEW_TAG = CONTENT_DESCRIPTION
  private const val MESSAGE = "更新未能启动，请联系管理员。"
  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var currentActivity: WeakReference<Activity>? = null

  /** Called by each App's MainActivity before React starts resolving a bundle. */
  @JvmStatic
  fun registerActivity(activity: Activity) {
    currentActivity = WeakReference(activity)
  }

  internal fun show() {
    val activity = currentActivity?.get() ?: run {
      Log.e(LOG_TAG, "event=startup-failure-view-unavailable reason=activity-unavailable")
      return
    }
    val display = Runnable { attach(activity) }
    if (Looper.myLooper() === Looper.getMainLooper()) display.run() else mainHandler.post(display)
  }

  private fun attach(activity: Activity) {
    if (activity.isFinishing || activity.isDestroyed) {
      Log.e(LOG_TAG, "event=startup-failure-view-unavailable reason=activity-not-visible")
      return
    }
    val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: run {
      Log.e(LOG_TAG, "event=startup-failure-view-unavailable reason=content-unavailable")
      return
    }
    content.findViewWithTag<View>(VIEW_TAG)?.let {
      it.bringToFront()
      return
    }
    val density = activity.resources.displayMetrics.density
    val padding = (24 * density).toInt()
    val overlay = FrameLayout(activity).apply {
      tag = VIEW_TAG
      setBackgroundColor(Color.rgb(18, 18, 18))
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      isClickable = false
      isFocusable = false
    }
    val message = TextView(activity).apply {
      text = MESSAGE
      contentDescription = CONTENT_DESCRIPTION
      setTextColor(Color.WHITE)
      textSize = 22f
      gravity = Gravity.CENTER
      setPadding(padding, padding, padding, padding)
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
      isClickable = false
      isFocusable = false
    }
    overlay.addView(
      message,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    content.addView(
      overlay,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    overlay.bringToFront()
    Log.e(LOG_TAG, "event=startup-failure-view-shown reason=no-safe-bundle-target")
  }
}
