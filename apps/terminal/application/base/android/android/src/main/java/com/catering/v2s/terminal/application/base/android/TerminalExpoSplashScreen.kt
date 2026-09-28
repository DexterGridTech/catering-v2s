package com.catering.v2s.terminal.application.base.android

import android.app.Activity
import android.util.Log
import expo.modules.splashscreen.SplashScreenManager

/** One shared call site for the Expo splash manager's undocumented auto-hide flag. */
object TerminalExpoSplashScreen {
  private const val LOG_TAG = "TER-Splash"

  @JvmStatic
  fun prepareActivity(activity: Activity, appName: String) {
    SplashScreenManager.preventAutoHideCalled = true
    Log.i(LOG_TAG, "event=expo.prevent-auto-hide-set app=$appName value=true")
    SplashScreenManager.registerOnActivity(activity)
    Log.i(LOG_TAG, "event=expo.activity-registered app=$appName")
  }
}
