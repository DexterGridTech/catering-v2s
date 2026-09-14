package com.catering.v2s.terminal.adapter.android.persistkv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StorageModeResolverTest {
  @Test
  fun `accepts exactly the two frozen native mode tokens`() {
    assertEquals(StorageMode.PLAIN, StorageModeResolver.resolve("plain"))
    assertEquals(StorageMode.PROTECTED, StorageModeResolver.resolve("protected"))
  }

  @Test
  fun `missing empty and unknown tokens are rejected without a plain fallback`() {
    listOf(null, "", "PLAIN", "future", "plain ").forEach { token ->
      assertNull("mode token $token must be rejected", StorageModeResolver.resolve(token))
    }
  }
}
