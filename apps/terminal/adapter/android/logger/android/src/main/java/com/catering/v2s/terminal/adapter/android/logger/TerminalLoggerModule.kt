package com.catering.v2s.terminal.adapter.android.logger

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalLoggerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalLogger")
  }
}
