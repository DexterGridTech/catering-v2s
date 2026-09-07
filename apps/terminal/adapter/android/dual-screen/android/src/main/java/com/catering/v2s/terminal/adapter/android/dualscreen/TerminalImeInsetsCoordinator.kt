package com.catering.v2s.terminal.adapter.android.dualscreen

import android.util.Log
import android.view.View
import android.view.Window
import androidx.core.view.OnApplyWindowInsetsListener
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

internal data class TerminalImeInsetsSnapshot(
  val displayIndex: Int,
  val displayId: Int,
  val windowIdentity: String,
  val visible: Boolean,
  val bottomPx: Int,
  val bottomLogical: Double,
)

/**
 * Owns IME inset observation for exactly one Android window. It never changes
 * runtime state or window layout; it only publishes the immutable snapshot
 * consumed by the corresponding JS surface frame.
 */
internal class TerminalImeInsetsCoordinator(
  private val window: Window,
  private val displayIndex: Int,
  private val displayId: Int,
  private val windowIdentity: String,
  private val logicalDensity: Float,
  private val publish: (TerminalImeInsetsSnapshot) -> Unit,
) {
  private val rootView: View = window.decorView
  private var attached = false

  private val listener = OnApplyWindowInsetsListener { _, insets ->
    val imeType = WindowInsetsCompat.Type.ime()
    val imeInsets = insets.getInsets(imeType)
    val visible = insets.isVisible(imeType)
    val snapshot = TerminalImeInsetsSnapshot(
      displayIndex = displayIndex,
      displayId = displayId,
      windowIdentity = windowIdentity,
      visible = visible,
      bottomPx = if (visible) imeInsets.bottom else 0,
      bottomLogical = if (visible && logicalDensity > 0f) {
        imeInsets.bottom.toDouble() / logicalDensity.toDouble()
      } else {
        0.0
      },
    )
    Log.i(
      LOG_TAG,
      "event=ime-insets window=${snapshot.windowIdentity} displayIndex=${snapshot.displayIndex} " +
        "displayId=${snapshot.displayId} visible=${snapshot.visible} " +
        "bottomPx=${snapshot.bottomPx} bottomLogical=${snapshot.bottomLogical}",
    )
    publish(snapshot)
    insets
  }

  fun attach() {
    if (attached) return
    attached = true
    ViewCompat.setOnApplyWindowInsetsListener(rootView, listener)
    ViewCompat.requestApplyInsets(rootView)
    Log.i(
      LOG_TAG,
      "event=ime-insets-listener-attached window=$windowIdentity displayIndex=$displayIndex displayId=$displayId",
    )
  }

  fun detach() {
    if (!attached) return
    attached = false
    ViewCompat.setOnApplyWindowInsetsListener(rootView, null)
    Log.i(
      LOG_TAG,
      "event=ime-insets-listener-detached window=$windowIdentity displayIndex=$displayIndex displayId=$displayId",
    )
  }

  private companion object {
    const val LOG_TAG = "TerminalDualScreen"
  }
}

internal object TerminalImeInsetsEventBus {
  private val lock = Any()
  private val snapshots = mutableMapOf<Int, TerminalImeInsetsSnapshot>()
  private var publisher: ((TerminalImeInsetsSnapshot) -> Unit)? = null

  fun registerPublisher(nextPublisher: (TerminalImeInsetsSnapshot) -> Unit) {
    synchronized(lock) { publisher = nextPublisher }
  }

  fun clearPublisher() {
    synchronized(lock) { publisher = null }
  }

  fun publish(snapshot: TerminalImeInsetsSnapshot) {
    val currentPublisher = synchronized(lock) {
      snapshots[snapshot.displayIndex] = snapshot
      publisher
    }
    currentPublisher?.invoke(snapshot)
  }

  fun snapshot(displayIndex: Int): TerminalImeInsetsSnapshot? = synchronized(lock) {
    snapshots[displayIndex]
  }
}
