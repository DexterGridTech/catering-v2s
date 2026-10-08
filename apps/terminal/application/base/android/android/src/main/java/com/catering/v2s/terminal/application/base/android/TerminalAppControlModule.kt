package com.catering.v2s.terminal.application.base.android

import com.facebook.react.ReactApplication
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import com.catering.v2s.terminal.adapter.android.update.TerminalUpdateProcess

class TerminalAppControlModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalAppControl")

    AsyncFunction("resetRuntime") Coroutine { requestId: String, timeoutMs: Double ->
      val application = appContext.reactContext?.applicationContext as? ReactApplication
        ?: return@Coroutine failure(requestId, "APP_CONTROL_UNAVAILABLE", "react application is unavailable")
      when (val outcome = TerminalUpdateProcess.reload("TER topology reset", timeoutMs.toLong())) {
        "SUCCESSOR_RUNTIME_STARTED" -> mapOf(
          "status" to "accepted",
          "requestId" to requestId,
          "acceptedAt" to System.currentTimeMillis(),
          "terminalObservation" to outcome,
        )
        "RELOAD_TIMED_OUT" -> mapOf(
          "status" to "timed-out",
          "requestId" to requestId,
          "port" to "appControl",
          "capability" to "resetRuntime",
          "timeoutMs" to timeoutMs,
        )
        else -> failure(requestId, "APP_CONTROL_RESET_FAILED", "runtime reset did not start a successor runtime")
      }
    }
  }

  private fun failure(requestId: String, code: String, message: String): Map<String, Any?> = mapOf(
    "status" to "failed",
    "requestId" to requestId,
    "port" to "appControl",
    "capability" to "resetRuntime",
    "error" to mapOf("code" to code, "message" to message, "retryable" to true),
  )
}
