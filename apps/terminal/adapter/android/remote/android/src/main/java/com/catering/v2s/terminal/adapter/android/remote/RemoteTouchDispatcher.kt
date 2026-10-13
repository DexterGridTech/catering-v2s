package com.catering.v2s.terminal.adapter.android.remote

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.MotionEvent
import com.catering.v2s.terminal.adapter.android.dualscreen.TerminalDualScreenWindowAccess
import java.util.concurrent.Callable
import java.util.concurrent.FutureTask

internal class RemoteTouchDispatcher {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val lock = Any()
  private val gestures = mutableMapOf<String, Gesture>()

  fun dispatch(
    surfaceKey: String,
    windowIdentity: String,
    generation: Long,
    actionName: String,
    xNormalized: Double,
    yNormalized: Double,
  ): String = onMain("touch-dispatch", surfaceKey) {
    dispatchOnMain(surfaceKey, windowIdentity, generation, actionName, xNormalized, yNormalized)
  }

  fun cancel(surfaceKey: String, windowIdentity: String, generation: Long): String = onMain("touch-cancel", surfaceKey) {
    cancelOnMain(surfaceKey, windowIdentity, generation)
  }

  fun cancelForLocalInput(surfaceKey: String, windowIdentity: String, generation: Long): Boolean = onMain("local-input-cancel", surfaceKey) {
    cancelOnMain(surfaceKey, windowIdentity, generation) == "dispatched"
  }

  private fun dispatchOnMain(
    surfaceKey: String,
    windowIdentity: String,
    generation: Long,
    actionName: String,
    xNormalized: Double,
    yNormalized: Double,
  ): String {
    if (!xNormalized.isFinite() || !yNormalized.isFinite() ||
      xNormalized !in 0.0..1.0 || yNormalized !in 0.0..1.0
    ) return "out-of-bounds"
    val lease = TerminalDualScreenWindowAccess.borrowCurrent(surfaceKey, generation)
      ?: return "stale-window"
    if (lease.windowIdentity != windowIdentity || lease.widthPx <= 0 || lease.heightPx <= 0) return "stale-window"
    val action = when (actionName) {
      "DOWN" -> MotionEvent.ACTION_DOWN
      "MOVE" -> MotionEvent.ACTION_MOVE
      "UP" -> MotionEvent.ACTION_UP
      "CANCEL" -> MotionEvent.ACTION_CANCEL
      else -> return "invalid-action"
    }
    val now = SystemClock.uptimeMillis()
    val x = (xNormalized * lease.widthPx).toFloat().coerceIn(0f, lease.widthPx.toFloat() - 1f)
    val y = (yNormalized * lease.heightPx).toFloat().coerceIn(0f, lease.heightPx.toFloat() - 1f)
    val downTime = synchronized(lock) {
      when (action) {
        MotionEvent.ACTION_DOWN -> {
          if (gestures.containsKey(surfaceKey)) return "gesture-active"
          gestures[surfaceKey] = Gesture(now, x, y)
          now
        }
        MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
          gestures[surfaceKey]?.downTime ?: return "no-active-gesture"
        else -> return "invalid-action"
      }
    }
    val event = MotionEvent.obtain(downTime, now, action, x, y, 0)
    val windowDispatchStartedAt = SystemClock.elapsedRealtime()
    val delivered = try {
      TerminalDualScreenWindowAccess.dispatchRemoteTouch(surfaceKey, windowIdentity, generation, event)
    } catch (_error: RuntimeException) {
      false
    } finally {
      event.recycle()
      Log.i(LOG_TAG, "event=touch-window-dispatch surfaceKey=$surfaceKey action=$actionName " +
        "elapsedMs=${SystemClock.elapsedRealtime() - windowDispatchStartedAt}")
    }
    synchronized(lock) {
      when (action) {
        MotionEvent.ACTION_MOVE -> gestures[surfaceKey]?.let { gestures[surfaceKey] = it.copy(x = x, y = y) }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> gestures.remove(surfaceKey)
      }
    }
    return if (delivered) "dispatched" else "not-consumed"
  }

  private fun cancelOnMain(surfaceKey: String, windowIdentity: String, generation: Long): String {
    val gesture = synchronized(lock) { gestures[surfaceKey] } ?: return "no-active-gesture"
    val lease = TerminalDualScreenWindowAccess.borrowCurrent(surfaceKey, generation)
      ?: run {
        synchronized(lock) { gestures.remove(surfaceKey) }
        return "stale-window"
      }
    if (lease.windowIdentity != windowIdentity) {
      synchronized(lock) { gestures.remove(surfaceKey) }
      return "stale-window"
    }
    val event = MotionEvent.obtain(
      gesture.downTime,
      SystemClock.uptimeMillis(),
      MotionEvent.ACTION_CANCEL,
      gesture.x,
      gesture.y,
      0,
    )
    val windowDispatchStartedAt = SystemClock.elapsedRealtime()
    val delivered = try {
      TerminalDualScreenWindowAccess.dispatchRemoteTouch(surfaceKey, windowIdentity, generation, event)
    } catch (_error: RuntimeException) {
      false
    } finally {
      event.recycle()
      Log.i(LOG_TAG, "event=touch-window-dispatch surfaceKey=$surfaceKey action=CANCEL " +
        "elapsedMs=${SystemClock.elapsedRealtime() - windowDispatchStartedAt}")
      synchronized(lock) { gestures.remove(surfaceKey) }
    }
    return if (delivered) "dispatched" else "not-consumed"
  }

  private fun <T> onMain(operation: String, surfaceKey: String, block: () -> T): T {
    val queuedAt = SystemClock.elapsedRealtime()
    val task = FutureTask(Callable {
      val startedAt = SystemClock.elapsedRealtime()
      try {
        block()
      } finally {
        Log.i(LOG_TAG, "event=main-operation operation=$operation surfaceKey=$surfaceKey " +
          "queueWaitMs=${startedAt - queuedAt} mainWorkMs=${SystemClock.elapsedRealtime() - startedAt}")
      }
    })
    if (Looper.myLooper() == Looper.getMainLooper()) {
      task.run()
      return task.get()
    }
    check(mainHandler.post(task)) { "main-thread-unavailable" }
    return task.get()
  }

  private data class Gesture(val downTime: Long, val x: Float, val y: Float)

  private companion object {
    const val LOG_TAG = "TerminalRemote"
  }
}
