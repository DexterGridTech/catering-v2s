package com.anonymous.sampleterminal

import android.os.Build
import android.os.Bundle
import android.util.Log

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import com.catering.v2s.terminal.application.base.android.TerminalExpoSplashScreen
import com.catering.v2s.terminal.application.base.android.TerminalNativeLoadingRegistry

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    Log.i(LOG_TAG, "event=activity.onCreate phase=start app=sample-terminal")
    TerminalExpoSplashScreen.prepareActivity(this, "sample-terminal")
    TerminalNativeLoadingRegistry.registerOnActivity(
      this,
      R.color.colorPrimary,
      R.drawable.splashscreen_logo,
    )
    Log.i(LOG_TAG, "event=native.activity-registered app=sample-terminal")
    Log.i(LOG_TAG, "event=activity.onCreate phase=before-super app=sample-terminal")
    super.onCreate(null)
    Log.i(LOG_TAG, "event=activity.onCreate phase=after-super app=sample-terminal")
    TerminalNativeLoadingRegistry.attachLoadingOverlay(this)
    Log.i(LOG_TAG, "event=native.loading-overlay-attached-after-super app=sample-terminal")
  }

  private companion object {
    const val LOG_TAG = "TER-Splash"
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
