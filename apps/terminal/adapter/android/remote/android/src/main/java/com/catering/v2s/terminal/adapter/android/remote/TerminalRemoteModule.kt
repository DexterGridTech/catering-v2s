package com.catering.v2s.terminal.adapter.android.remote

import android.util.Log
import com.catering.v2s.terminal.adapter.android.dualscreen.TerminalDualScreenWindowAccess
import com.catering.v2s.terminal.adapter.android.dualscreen.TerminalDualScreenWindowEvent
import com.facebook.react.bridge.ReactContext
import com.oney.WebRTCModule.WebRTCModule
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import livekit.org.webrtc.VideoTrack

private const val LOG_TAG = "TerminalRemote"

class TerminalRemoteModule : Module() {
  private val touchDispatcher = RemoteTouchDispatcher()
  private var windowObservation: AutoCloseable? = null
  private val localInputObservations = linkedMapOf<String, AutoCloseable>()

  override fun definition() = ModuleDefinition {
    Name("TerminalRemote")
    Events("onWindowHostChanged", "onCaptureEvent")

    AsyncFunction("createWindowVideoTrack") { surfaceKey: String, windowIdentity: String, generation: Double, streamId: String ->
      val currentGeneration = generation.toLong()
      val lease = TerminalDualScreenWindowAccess.borrowCurrent(surfaceKey, currentGeneration)
        ?: throw IllegalStateException("window-not-current")
      if (lease.windowIdentity != windowIdentity) throw IllegalStateException("window-identity-changed")
      val (width, height) = captureSize(lease.widthPx, lease.heightPx)
      val controller = RemoteWindowCaptureController(
        surfaceKey = surfaceKey,
        windowIdentity = windowIdentity,
        generation = currentGeneration,
        streamId = streamId,
        width = width,
        height = height,
        fps = 15,
      ) { event ->
        Log.i(LOG_TAG, "event=${event.event} streamId=${event.streamId} surfaceKey=${event.surfaceKey} " +
          "windowIdentity=${event.windowIdentity} generation=${event.generation} " +
          "reason=${event.reason ?: "none"}")
        sendEvent("onCaptureEvent", mapOf(
          "event" to event.event,
          "streamId" to event.streamId,
          "surfaceKey" to event.surfaceKey,
          "windowIdentity" to event.windowIdentity,
          "generation" to event.generation,
          "reason" to event.reason,
        ))
      }
      val reactContext = appContext.reactContext as? ReactContext
        ?: throw IllegalStateException("react-context-unavailable")
      val rtcModule = reactContext.getNativeModule(WebRTCModule::class.java)
        ?: throw IllegalStateException("webrtc-module-unavailable")
      val track: VideoTrack = try {
        requireNotNull(rtcModule.createVideoTrack(controller))
      } catch (error: Throwable) {
        controller.dispose()
        throw error
      }
      Log.i(LOG_TAG, "event=video-track-created streamId=$streamId surfaceKey=$surfaceKey windowIdentity=$windowIdentity " +
        "generation=$currentGeneration trackId=${track.id()} width=$width height=$height")
      mapOf(
        "id" to track.id(),
        "kind" to track.kind(),
        "remote" to false,
        "enabled" to track.enabled(),
        "readyState" to "live",
        "peerConnectionId" to -1,
        "constraints" to emptyMap<String, Any>(),
        "settings" to controller.settings.toHashMap(),
      )
    }

    AsyncFunction("dispatchWindowTouch") {
        surfaceKey: String,
        windowIdentity: String,
        generation: Double,
        action: String,
        xNormalized: Double,
        yNormalized: Double,
      ->
      val result = touchDispatcher.dispatch(
        surfaceKey,
        windowIdentity,
        generation.toLong(),
        action,
        xNormalized,
        yNormalized,
      )
      Log.i(LOG_TAG, "event=touch-dispatch surfaceKey=$surfaceKey windowIdentity=$windowIdentity " +
        "generation=${generation.toLong()} action=$action result=$result")
      result
    }

    AsyncFunction("cancelWindowTouch") {
        surfaceKey: String,
        windowIdentity: String,
        generation: Double,
      ->
      touchDispatcher.cancel(surfaceKey, windowIdentity, generation.toLong())
    }

    OnCreate {
      windowObservation = TerminalDualScreenWindowAccess.observe { event ->
        handleWindowEvent(event)
      }
      listOf("PRIMARY", "SECONDARY").forEach { surfaceKey ->
        TerminalDualScreenWindowAccess.borrowCurrent(surfaceKey)?.let { lease ->
          observeLocalInput(lease.surfaceKey, lease.windowIdentity, lease.generation)
        }
      }
    }

    OnDestroy {
      windowObservation?.close()
      windowObservation = null
      localInputObservations.values.forEach(AutoCloseable::close)
      localInputObservations.clear()
    }
  }

  private fun handleWindowEvent(event: TerminalDualScreenWindowEvent) {
    if (event.available) {
      observeLocalInput(event.surfaceKey, event.windowIdentity, event.generation)
    } else {
      localInputObservations.remove(event.surfaceKey)?.close()
      touchDispatcher.cancel(event.surfaceKey, event.windowIdentity, event.generation)
    }
    sendEvent("onWindowHostChanged", mapOf(
      "available" to event.available,
      "surfaceKey" to event.surfaceKey,
      "windowIdentity" to event.windowIdentity,
      "generation" to event.generation,
      "displayId" to event.displayId,
      "widthPx" to event.widthPx,
      "heightPx" to event.heightPx,
      "reason" to event.reason,
    ))
  }

  private fun observeLocalInput(surfaceKey: String, windowIdentity: String, generation: Long) {
    localInputObservations.remove(surfaceKey)?.close()
    val observation = TerminalDualScreenWindowAccess.observeLocalInput(
      surfaceKey,
      windowIdentity,
      generation,
    ) { event ->
      if (touchDispatcher.cancelForLocalInput(event.surfaceKey, event.windowIdentity, event.generation)) {
        Log.i(LOG_TAG, "event=local-input-conflict surfaceKey=${event.surfaceKey} " +
          "windowIdentity=${event.windowIdentity} generation=${event.generation}")
        sendEvent("onCaptureEvent", mapOf(
          "event" to "local-input-conflict",
          "surfaceKey" to event.surfaceKey,
          "windowIdentity" to event.windowIdentity,
          "generation" to event.generation,
          "reason" to "local-input",
        ))
      }
    }
    if (observation == null) {
      Log.w(LOG_TAG, "event=local-input-observer-unavailable surfaceKey=$surfaceKey " +
        "windowIdentity=$windowIdentity generation=$generation")
    } else {
      localInputObservations[surfaceKey] = observation
    }
  }
}
