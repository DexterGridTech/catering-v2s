package com.catering.v2s.terminal.adapter.android.update

import android.content.Context

/** Application-process entry called before Expo lazily creates its ReactHost. */
object TerminalUpdateProcess {
  @JvmStatic
  fun begin(context: Context) {
    TerminalUpdateRuntime.beginBoot(context.applicationContext)
  }

  @JvmStatic
  suspend fun reload(reason: String, timeoutMs: Long): String =
    TerminalUpdateRuntime.reload(reason, timeoutMs)
}
