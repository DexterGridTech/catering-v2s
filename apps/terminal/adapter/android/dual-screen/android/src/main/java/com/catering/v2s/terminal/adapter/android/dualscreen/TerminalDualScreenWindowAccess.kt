package com.catering.v2s.terminal.adapter.android.dualscreen

import android.view.Window

/** A current, generation-bound handle borrowed from the dual-screen owner. */
data class TerminalDualScreenWindowLease internal constructor(
  val window: Window,
  val surfaceKey: String,
  val windowIdentity: String,
  val generation: Long,
  val displayId: Int?,
  val widthPx: Int,
  val heightPx: Int,
)

/** Lifecycle facts needed by adapters that operate on the registered windows. */
data class TerminalDualScreenWindowEvent internal constructor(
  val available: Boolean,
  val surfaceKey: String,
  val windowIdentity: String,
  val generation: Long,
  val displayId: Int?,
  val widthPx: Int?,
  val heightPx: Int?,
  val reason: String?,
)

/** A local human touch began on a currently owned surface. No coordinates or payload are retained. */
data class TerminalLocalInputEvent internal constructor(
  val surfaceKey: String,
  val windowIdentity: String,
  val generation: Long,
)

/** Narrow access to the existing registry; this object never owns a Window. */
object TerminalDualScreenWindowAccess {
  fun borrowCurrent(surfaceKey: String, expectedGeneration: Long? = null): TerminalDualScreenWindowLease? =
    TerminalSurfaceHostRegistry.borrowWindow(surfaceKey, expectedGeneration)

  fun observe(listener: (TerminalDualScreenWindowEvent) -> Unit): AutoCloseable =
    TerminalSurfaceHostRegistry.observeWindows { event ->
      listener(event.toPublicWindowEvent())
    }

  fun observeLocalInput(
    surfaceKey: String,
    windowIdentity: String,
    generation: Long,
    listener: (TerminalLocalInputEvent) -> Unit,
  ): AutoCloseable? = TerminalSurfaceHostRegistry.observeLocalInput(surfaceKey, windowIdentity, generation, listener)

  fun dispatchRemoteTouch(
    surfaceKey: String,
    windowIdentity: String,
    generation: Long,
    event: android.view.MotionEvent,
  ): Boolean = TerminalSurfaceHostRegistry.dispatchRemoteTouch(surfaceKey, windowIdentity, generation, event)
}

private fun TerminalSurfaceHostEvent.toPublicWindowEvent(): TerminalDualScreenWindowEvent = when (this) {
  is TerminalSurfaceHostEvent.Ready -> TerminalDualScreenWindowEvent(
    available = true,
    surfaceKey = snapshot.surfaceKey,
    windowIdentity = snapshot.windowIdentity,
    generation = snapshot.generation,
    displayId = snapshot.displayId,
    widthPx = snapshot.currentWidthPx,
    heightPx = snapshot.currentHeightPx,
    reason = null,
  )
  is TerminalSurfaceHostEvent.RecoverableRemoval -> TerminalDualScreenWindowEvent(
    available = false,
    surfaceKey = surfaceKey,
    windowIdentity = windowIdentity,
    generation = generation,
    displayId = displayId,
    widthPx = null,
    heightPx = null,
    reason = reason,
  )
  is TerminalSurfaceHostEvent.Unavailable -> TerminalDualScreenWindowEvent(
    available = false,
    surfaceKey = surfaceKey,
    windowIdentity = windowIdentity,
    generation = generation,
    displayId = displayId,
    widthPx = null,
    heightPx = null,
    reason = reason,
  )
}
