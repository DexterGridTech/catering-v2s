package com.catering.v2s.terminal.adapter.android.persistkv

internal enum class StorageMode(val wireName: String, val portName: String) {
  PLAIN("plain", "persistKv"),
  PROTECTED("protected", "persistSecure"),
}

internal object StorageModeResolver {
  fun resolve(modeToken: String?): StorageMode? = when (modeToken) {
    StorageMode.PLAIN.wireName -> StorageMode.PLAIN
    StorageMode.PROTECTED.wireName -> StorageMode.PROTECTED
    else -> null
  }
}
