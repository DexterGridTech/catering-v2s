package com.catering.v2s.terminal.adapter.android.update

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import android.util.Log
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactContext

/** Narrow JS bridge to native update facts and boot confirmation. */
class TerminalUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalUpdate")

    OnActivityEntersForeground {
      appContext.currentActivity?.let { activity ->
        TerminalUpdateRuntime.reconcileBusyInstallerOnForeground(activity)
      } ?: run {
        Log.i("TerminalUpdate", "event=installer-busy-reconcile outcome=activity-unavailable")
      }
    }

    AsyncFunction("readFacts") {
      TerminalUpdateRuntime.selectedFacts(appContext.reactContext?.applicationContext
        ?: error("TERMINAL_UPDATE_APPLICATION_NOT_READY"))
    }

    AsyncFunction("prepareArtifact") Coroutine { downloadUrl: String,
      timeoutMs: Double,
      expectedSha256: String,
      artifactJson: String,
      kind: String,
      downloadGrant: String?,
      proxy: ReadableMap? ->
      Log.i("TerminalUpdate", "event=artifact-prepare-start kind=$kind timeoutMs=${timeoutMs.toLong()}")
      try {
        val context = appContext.reactContext?.applicationContext ?: error("TERMINAL_UPDATE_APPLICATION_NOT_READY")
        val prepared = TerminalUpdateArtifactPreparer.prepare(
          context, downloadUrl, expectedSha256, artifactJson, kind, timeoutMs.toLong(), downloadGrant, proxy,
        )
        Log.i("TerminalUpdate", "event=artifact-prepare-complete kind=$kind")
        mapOf("preparedId" to prepared.id)
      } catch (error: Throwable) {
        val code = error.message?.takeIf { it.matches(Regex("TERMINAL_UPDATE_[A-Z0-9_]{1,96}")) }
          ?: "NATIVE_OPERATION_FAILED"
        Log.e("TerminalUpdate", "event=artifact-prepare-failed kind=$kind code=$code errorType=${error.javaClass.simpleName}")
        throw error
      }
    }

    AsyncFunction("applyPrepared") Coroutine { taskId: String, actionId: String, preparedId: String, kind: String ->
      val context = appContext.runtime.reactContext ?: error("TERMINAL_UPDATE_REACT_CONTEXT_NOT_READY")
      Log.i("TerminalUpdate", "event=apply-prepared-start kind=$kind")
      try {
        TerminalUpdateRuntime.applyPrepared(context, taskId, actionId, preparedId, kind)
      } catch (error: Throwable) {
        val code = error.message?.takeIf { it.matches(Regex("TERMINAL_UPDATE_[A-Z0-9_]{1,96}")) }
          ?: "NATIVE_OPERATION_FAILED"
        val frame = error.stackTrace.firstOrNull()?.let {
          "${it.className.substringAfterLast('.')}.${it.methodName}:${it.lineNumber}"
        } ?: "unavailable"
        Log.e("TerminalUpdate", "event=apply-prepared status=failed kind=$kind code=$code errorType=${error.javaClass.simpleName} frame=$frame")
        throw error
      }
    }

    AsyncFunction("readAction") { taskId: String, actionId: String ->
      val context = appContext.reactContext?.applicationContext ?: error("TERMINAL_UPDATE_APPLICATION_NOT_READY")
      TerminalUpdateRuntime.readAction(context, taskId, actionId)
    }

    AsyncFunction("presentInstallerConfirmation") { taskId: String, actionId: String, publicationId: String, trigger: String ->
      val activity = appContext.currentActivity
        ?: return@AsyncFunction mapOf("status" to "unknown", "reason" to "ACTIVITY_NOT_AVAILABLE")
      TerminalUpdateRuntime.presentInstallerConfirmation(activity, taskId, actionId, publicationId, trigger)
    }

    AsyncFunction("releasePrepared") { preparedId: String ->
      val context = appContext.reactContext?.applicationContext ?: error("TERMINAL_UPDATE_APPLICATION_NOT_READY")
      mapOf("released" to TerminalUpdateArtifactPreparer.release(context, preparedId))
    }

    AsyncFunction("confirmBoot") { bootToken: String, publicationId: String ->
      val context = appContext.runtime.reactContext ?: error("TERMINAL_UPDATE_REACT_CONTEXT_NOT_READY")
      val confirmed = TerminalUpdateRuntime.markBootConfirmed(context, bootToken, publicationId)
      if (!confirmed) error("TERMINAL_UPDATE_BOOT_CONFIRMATION_REJECTED")
      mapOf("confirmed" to true)
    }
  }
}
