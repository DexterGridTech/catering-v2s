package com.catering.v2s.terminal.adapter.android.persistkv

import java.security.MessageDigest

internal object ProtectedStorageIdentity {
  const val NAMESPACE_VERSION = 2
  const val NAMESPACE_PREFIX = "catering-v2s.terminal.state.protected.v$NAMESPACE_VERSION."
  private const val EFFECTIVE_KEY_BYTES = 16
  private const val DIGEST_BYTES = EFFECTIVE_KEY_BYTES / 2
  private const val HEX = "0123456789abcdef"

  fun cryptKey(deviceIdentity: String?): String? {
    if (deviceIdentity.isNullOrEmpty()) return null
    val digest = MessageDigest.getInstance("SHA-256").digest(deviceIdentity.toByteArray(Charsets.UTF_8))
    return buildString(EFFECTIVE_KEY_BYTES) {
      for (index in 0 until DIGEST_BYTES) {
        val value = digest[index].toInt() and 0xff
        append(HEX[value ushr 4])
        append(HEX[value and 0x0f])
      }
    }
  }
}
