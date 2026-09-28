package com.catering.v2s.terminal.application.base.android

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine

class TerminalNativeLoadingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalNativeLoading")

    AsyncFunction("beginHide") Coroutine { reason: String ->
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("current Activity is unavailable")
      TerminalNativeLoadingRegistry.beginHide(activity, reason)
    }

    AsyncFunction("releaseHide") Coroutine { activityInstanceId: String ->
      TerminalNativeLoadingRegistry.releaseHide(activityInstanceId)
    }

    OnCreate {
      appContext.currentActivity?.application?.let(TerminalNativeLoadingRegistry::registerApplication)
      if (BuildConfig.DEBUG) {
        val delayMs = appContext.currentActivity?.intent?.getLongExtra(DEBUG_LOADING_DELAY_EXTRA, 0L) ?: 0L
        if (delayMs > 0L) TerminalNativeLoadingRegistry.armDebugMainThreadDelayBeforeNextDispatch(delayMs)
      }
    }
  }

  private companion object {
    const val DEBUG_LOADING_DELAY_EXTRA = "terminalDebugMainThreadDelayMs"
  }
}
