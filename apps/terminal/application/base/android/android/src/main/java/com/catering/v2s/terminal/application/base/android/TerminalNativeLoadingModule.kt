package com.catering.v2s.terminal.application.base.android

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalNativeLoadingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalNativeLoading")

    Function("beginHide") { reason: String ->
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("current Activity is unavailable")
      TerminalNativeLoadingRegistry.beginHide(activity, reason)
    }

    Function("releaseHide") { activityInstanceId: String ->
      TerminalNativeLoadingRegistry.releaseHide(activityInstanceId)
    }

    OnCreate {
      appContext.currentActivity?.application?.let(TerminalNativeLoadingRegistry::registerApplication)
    }

    OnDestroy {
      TerminalNativeLoadingRegistry.unregisterApplication(appContext.currentActivity?.application)
    }
  }
}
