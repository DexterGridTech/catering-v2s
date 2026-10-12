package com.catering.v2s.terminal.adapter.android.remote

import android.content.Context
import android.graphics.Bitmap
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.PixelCopy
import com.catering.v2s.terminal.adapter.android.dualscreen.TerminalDualScreenWindowAccess
import com.oney.WebRTCModule.AbstractVideoCaptureController
import java.nio.ByteBuffer
import java.util.ArrayDeque
import livekit.org.webrtc.CapturerObserver
import livekit.org.webrtc.JavaI420Buffer
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.VideoCapturer
import livekit.org.webrtc.VideoFrame

private const val LOG_TAG = "TerminalRemoteCapture"
private const val FRAME_INTERVAL_MS = 1000L / 15L
private const val MAX_FRAME_EDGE = 1280
private const val MAX_REUSABLE_PLANES = 3

internal data class CaptureEvent(
  val event: String,
  val streamId: String,
  val surfaceKey: String,
  val windowIdentity: String,
  val generation: Long,
  val reason: String? = null,
)

internal class RemoteWindowCaptureController(
  private val surfaceKey: String,
  private val windowIdentity: String,
  private val generation: Long,
  private val streamId: String,
  width: Int,
  height: Int,
  fps: Int,
  onEvent: (CaptureEvent) -> Unit,
) : AbstractVideoCaptureController(width, height, fps) {
  private val capturer = RemoteWindowVideoCapturer(surfaceKey, windowIdentity, generation, streamId, onEvent)

  override fun getDeviceId(): String = "terminal-window-$surfaceKey"

  override fun createVideoCapturer(): VideoCapturer = capturer
}

internal class RemoteWindowVideoCapturer(
  private val surfaceKey: String,
  private val windowIdentity: String,
  private val generation: Long,
  private val streamId: String,
  private val onEvent: (CaptureEvent) -> Unit,
) : VideoCapturer {
  private val lifecycleLock = Any()
  @Volatile private var observer: CapturerObserver? = null
  @Volatile private var currentRun: CaptureRun? = null

  override fun initialize(
    surfaceTextureHelper: SurfaceTextureHelper,
    context: Context,
    capturerObserver: CapturerObserver,
  ) {
    observer = capturerObserver
    Log.i(LOG_TAG, "event=capturer-initialized surfaceKey=$surfaceKey windowIdentity=$windowIdentity generation=$generation")
  }

  override fun startCapture(width: Int, height: Int, fps: Int) {
    if (width <= 0 || height <= 0 || width % 2 != 0 || height % 2 != 0 || fps <= 0) {
      observer?.onCapturerStarted(false)
      onEvent(CaptureEvent("capture-failed", streamId, surfaceKey, windowIdentity, generation, "invalid-format"))
      return
    }
    val run = synchronized(lifecycleLock) {
      if (currentRun != null) return
      val thread = HandlerThread("TERemoteCapture-$surfaceKey").apply { start() }
      val nextHandler = Handler(thread.looper)
      val framePlanes = ArrayDeque<FramePlanes>()
      repeat(MAX_REUSABLE_PLANES) { framePlanes.addLast(FramePlanes.allocate(width, height)) }
      CaptureRun(
        handlerThread = thread,
        handler = nextHandler,
        bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888),
        pixels = IntArray(width * height),
        planes = framePlanes,
        width = width,
        height = height,
        fps = fps.coerceAtMost(15),
      ).also { currentRun = it }
    }
    observer?.onCapturerStarted(true)
    onEvent(CaptureEvent("capture-started", streamId, surfaceKey, windowIdentity, generation))
    run.handler.post { copyNextFrame(run) }
  }

  override fun stopCapture() {
    val run = synchronized(lifecycleLock) {
      val active = currentRun ?: return
      currentRun = null
      active.active = false
      active.handler.removeCallbacksAndMessages(null)
      active.handlerThread.quitSafely()
      active
    }
    observer?.onCapturerStopped()
    onEvent(CaptureEvent("capture-stopped", streamId, surfaceKey, windowIdentity, generation))
    Log.i(LOG_TAG, "event=capturer-stopped surfaceKey=$surfaceKey windowIdentity=$windowIdentity " +
      "generation=$generation frames=${run.frameCount} droppedFrames=${run.droppedFrames}")
  }

  override fun changeCaptureFormat(width: Int, height: Int, fps: Int) {
    val wasRunning = currentRun != null
    if (wasRunning) stopCapture()
    if (wasRunning) startCapture(width, height, fps)
  }

  override fun dispose() {
    stopCapture()
    observer = null
  }

  override fun isScreencast(): Boolean = true

  private fun copyNextFrame(run: CaptureRun) {
    if (!isCurrent(run)) return
    val lease = TerminalDualScreenWindowAccess.borrowCurrent(surfaceKey, generation)
    if (lease == null || lease.windowIdentity != windowIdentity) {
      fail(run, "window-generation-changed")
      return
    }
    val started = synchronized(run.lock) {
      if (!run.active || run.requestInFlight) false else {
        run.requestInFlight = true
        true
      }
    }
    if (!started) {
      if (isCurrent(run)) {
        run.droppedFrames++
        run.handler.postDelayed({ copyNextFrame(run) }, FRAME_INTERVAL_MS)
      }
      return
    }

    val requestStartedAt = android.os.SystemClock.elapsedRealtime()
    try {
      PixelCopy.request(lease.window, run.bitmap, { result ->
        synchronized(run.lock) { run.requestInFlight = false }
        if (!isCurrent(run)) return@request
        if (result != PixelCopy.SUCCESS) {
          fail(run, "pixel-copy-$result")
          return@request
        }
        val current = TerminalDualScreenWindowAccess.borrowCurrent(surfaceKey, generation)
        if (current == null || current.windowIdentity != windowIdentity) {
          fail(run, "window-generation-changed")
          return@request
        }
        deliverFrame(run)
        if (isCurrent(run)) {
          val elapsed = android.os.SystemClock.elapsedRealtime() - requestStartedAt
          run.handler.postDelayed({ copyNextFrame(run) }, (1000L / run.fps - elapsed).coerceAtLeast(0L))
        }
      }, run.handler)
    } catch (error: RuntimeException) {
      synchronized(run.lock) { run.requestInFlight = false }
      Log.w(LOG_TAG, "event=pixel-copy-request-failed surfaceKey=$surfaceKey generation=$generation " +
        "reason=${error.javaClass.simpleName}")
      fail(run, "pixel-copy-request-failed")
    }
  }

  private fun deliverFrame(run: CaptureRun) {
    if (!isCurrent(run)) return
    val framePlanes = synchronized(run.lock) { if (run.planes.isEmpty()) null else run.planes.removeFirst() }
    if (framePlanes == null) {
      run.droppedFrames++
      return
    }
    run.bitmap.getPixels(run.pixels, 0, run.width, 0, 0, run.width, run.height)
    copyArgbToI420(
      run.pixels, run.width, run.height, framePlanes.y, framePlanes.u, framePlanes.v,
      framePlanes.yStride, framePlanes.uStride, framePlanes.vStride,
    )
    val buffer = JavaI420Buffer.wrap(
      run.width, run.height, framePlanes.y, framePlanes.yStride,
      framePlanes.u, framePlanes.uStride, framePlanes.v, framePlanes.vStride,
    ) {
      if (isCurrent(run)) synchronized(run.lock) {
        if (run.active && run.planes.size < MAX_REUSABLE_PLANES) run.planes.addLast(framePlanes)
      }
    }
    val frame = VideoFrame(buffer, 0, System.nanoTime())
    try {
      synchronized(lifecycleLock) {
        if (currentRun !== run) return
        observer?.onFrameCaptured(frame)
        run.frameCount++
      }
      if (run.frameCount == 1L) {
        onEvent(CaptureEvent("first-frame", streamId, surfaceKey, windowIdentity, generation))
      }
    } finally {
      frame.release()
    }
  }

  private fun fail(run: CaptureRun, reason: String) {
    if (!isCurrent(run)) return
    onEvent(CaptureEvent("capture-failed", streamId, surfaceKey, windowIdentity, generation, reason))
    stopCapture()
  }

  private fun isCurrent(run: CaptureRun): Boolean = run.active && currentRun === run

  private class CaptureRun(
    val handlerThread: HandlerThread,
    val handler: Handler,
    val bitmap: Bitmap,
    val pixels: IntArray,
    val planes: ArrayDeque<FramePlanes>,
    val width: Int,
    val height: Int,
    val fps: Int,
  ) {
    val lock = Any()
    @Volatile var active = true
    var requestInFlight = false
    var frameCount = 0L
    var droppedFrames = 0L
  }

  private data class FramePlanes(
    val y: ByteBuffer,
    val u: ByteBuffer,
    val v: ByteBuffer,
    val yStride: Int,
    val uStride: Int,
    val vStride: Int,
  ) {
    companion object {
      fun allocate(width: Int, height: Int): FramePlanes = FramePlanes(
        y = ByteBuffer.allocateDirect(width * height),
        u = ByteBuffer.allocateDirect(width * height / 4),
        v = ByteBuffer.allocateDirect(width * height / 4),
        yStride = width,
        uStride = width / 2,
        vStride = width / 2,
      )
    }
  }
}

internal fun captureSize(widthPx: Int, heightPx: Int): Pair<Int, Int> {
  require(widthPx > 0 && heightPx > 0)
  val scale = minOf(1.0, MAX_FRAME_EDGE.toDouble() / maxOf(widthPx, heightPx))
  var width = (widthPx * scale).toInt().coerceAtLeast(2)
  var height = (heightPx * scale).toInt().coerceAtLeast(2)
  if (width % 2 != 0) width--
  if (height % 2 != 0) height--
  return width to height
}
