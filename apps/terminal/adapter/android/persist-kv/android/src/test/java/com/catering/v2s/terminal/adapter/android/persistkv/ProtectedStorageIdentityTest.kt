package com.catering.v2s.terminal.adapter.android.persistkv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProtectedStorageIdentityTest {
  @Test
  fun `crypt key uses the exact 16 byte MMKV input and is deterministic`() {
    val identity = "0123456789abcdef"
    val key = ProtectedStorageIdentity.cryptKey(identity)

    assertEquals("9f9f5111f7b27a78", key)
    assertEquals(16, key?.toByteArray(Charsets.UTF_8)?.size)
    assertEquals(key, ProtectedStorageIdentity.cryptKey(identity))
  }

  @Test
  fun `each identity byte contributes to the effective crypt key`() {
    val identity = "0123456789abcdef"
    val originalKey = ProtectedStorageIdentity.cryptKey(identity)

    for (index in identity.indices) {
      val changed = identity.toCharArray().also { chars ->
        chars[index] = if (chars[index] == 'f') 'e' else 'f'
      }.let { String(it) }
      assertNotEquals("identity byte $index must affect all effective key derivation", originalKey, ProtectedStorageIdentity.cryptKey(changed))
    }
  }

  @Test
  fun `unavailable identity does not produce a protected key`() {
    assertNull(ProtectedStorageIdentity.cryptKey(null))
    assertNull(ProtectedStorageIdentity.cryptKey(""))
  }

  @Test
  fun `protected namespace moves forward without rewriting the prior namespace`() {
    assertEquals(2, ProtectedStorageIdentity.NAMESPACE_VERSION)
    assertEquals("catering-v2s.terminal.state.protected.v2.", ProtectedStorageIdentity.NAMESPACE_PREFIX)
  }
}
