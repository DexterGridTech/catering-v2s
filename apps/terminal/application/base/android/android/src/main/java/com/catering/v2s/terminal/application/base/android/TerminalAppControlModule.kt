package com.catering.v2s.terminal.application.base.android

import com.facebook.react.ReactApplication
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalAppControlModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalAppControl")

    AsyncFunction("resetRuntime") { requestId: String, _timeoutMs: Double ->
      val application = appContext.reactContext?.applicationContext as? ReactApplication
        ?: return@AsyncFunction failure(requestId, "APP_CONTROL_UNAVAILABLE", "react application is unavailable")
      val reactHost = application.reactHost
        ?: return@AsyncFunction failure(requestId, "APP_CONTROL_UNAVAILABLE", "react host is unavailable")
      try {
        reactHost.reload("TER topology reset")
        mapOf(
          "status" to "accepted",
          "requestId" to requestId,
          "acceptedAt" to System.currentTimeMillis(),
          "terminalObservation" to "SUCCESSOR_RUNTIME_STARTED",
        )
      } catch (_error: Throwable) {
        failure(requestId, "APP_CONTROL_RESET_FAILED", "runtime reset was not accepted")
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
