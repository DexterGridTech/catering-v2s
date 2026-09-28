package com.catering.v2s.terminal.adapter.android.persistkv

internal class PersistKvProcessState {
  private var initialized = false

  @Synchronized
  fun initialize(initializer: () -> String): Boolean {
    if (initialized) return true

    if (initializer().isEmpty()) return false
    initialized = true
    return true
  }
}

internal object PersistKvProcessInitialization {
  private val processState = PersistKvProcessState()

  fun initialize(initializer: () -> String): Boolean = processState.initialize(initializer)
}
