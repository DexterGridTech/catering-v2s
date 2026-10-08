package com.catering.v2s.terminal.adapter.android.update

import android.content.Context
import com.facebook.react.ReactHost
import com.facebook.react.bridge.ReactContext
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactNativeHostHandler

/** Registers the public ReactHost entry hook used by the single Expo host. */
class TerminalUpdatePackage : Package {
  override fun createReactNativeHostHandlers(context: Context): List<ReactNativeHostHandler> =
    listOf(TerminalUpdateHostHandler)
}

internal object TerminalUpdateHostHandler : ReactNativeHostHandler {
  override fun getJSBundleFile(useDeveloperSupport: Boolean): String? =
    TerminalUpdateRuntime.jsBundleFile(useDeveloperSupport)

  override fun onDidCreateReactHost(context: Context, reactNativeHost: ReactHost) {
    TerminalUpdateRuntime.registerReactHost(context.applicationContext, reactNativeHost)
  }

  override fun onDidCreateReactInstance(useDeveloperSupport: Boolean, reactContext: ReactContext) {
    TerminalUpdateRuntime.bindReactContext(reactContext)
  }
}
