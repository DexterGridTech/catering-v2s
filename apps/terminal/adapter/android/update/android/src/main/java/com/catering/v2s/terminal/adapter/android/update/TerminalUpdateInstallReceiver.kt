package com.catering.v2s.terminal.adapter.android.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Persists PackageInstaller outcomes so JS process death cannot lose the action identity. */
class TerminalUpdateInstallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    TerminalUpdateRuntime.onInstallerStatus(context.applicationContext, intent)
  }
}
