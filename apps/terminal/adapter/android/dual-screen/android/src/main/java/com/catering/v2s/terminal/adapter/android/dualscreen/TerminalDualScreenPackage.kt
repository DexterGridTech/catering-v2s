package com.catering.v2s.terminal.adapter.android.dualscreen

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityHandler

/**
 * Expo 57 discovers this package from its `*Package.kt` source convention.
 * The module config registers the JS-facing module separately.
 */
class TerminalDualScreenPackage : Package {
  private val activityHandler = TerminalDualScreenActivityHandler()

  override fun createReactActivityHandlers(activityContext: Context): List<ReactActivityHandler> =
    listOf(activityHandler)
}
