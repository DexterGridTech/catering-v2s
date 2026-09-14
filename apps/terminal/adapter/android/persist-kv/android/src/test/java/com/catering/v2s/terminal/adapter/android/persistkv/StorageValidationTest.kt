package com.catering.v2s.terminal.adapter.android.persistkv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StorageValidationTest {
  @Test
  fun `persistence keys enforce the frozen shape and length boundary`() {
    assertCode("PERSIST_KV_INVALID_PERSISTENCE_KEY", StorageValidation.persistenceKey(null))
    assertCode("PERSIST_KV_INVALID_PERSISTENCE_KEY", StorageValidation.persistenceKey(""))
    assertCode(
      "PERSIST_KV_INVALID_PERSISTENCE_KEY",
      StorageValidation.persistenceKey("x".repeat(StorageValidation.MAX_PERSISTENCE_KEY_LENGTH + 1)),
    )
    assertCode("PERSIST_KV_INVALID_PERSISTENCE_KEY", StorageValidation.persistenceKey("ok\u0000"))
    assertNull(StorageValidation.persistenceKey("x".repeat(StorageValidation.MAX_PERSISTENCE_KEY_LENGTH)))
  }

  @Test
  fun `entry keys enforce the frozen shape and protected marker reservation`() {
    assertCode("PERSIST_KV_INVALID_ENTRY_KEY", StorageValidation.entryKey(StorageMode.PLAIN, null))
    assertCode("PERSIST_KV_INVALID_ENTRY_KEY", StorageValidation.entryKey(StorageMode.PLAIN, ""))
    assertCode(
      "PERSIST_KV_INVALID_ENTRY_KEY",
      StorageValidation.entryKey(StorageMode.PLAIN, "x".repeat(StorageValidation.MAX_ENTRY_KEY_LENGTH + 1)),
    )
    assertCode("PERSIST_KV_INVALID_ENTRY_KEY", StorageValidation.entryKey(StorageMode.PLAIN, "ok\u0000"))
    assertNull(StorageValidation.entryKey(StorageMode.PLAIN, StorageValidation.PROTECTED_INITIALIZED_KEY))
    assertCode(
      "PERSIST_KV_RESERVED_KEY",
      StorageValidation.entryKey(StorageMode.PROTECTED, StorageValidation.PROTECTED_INITIALIZED_KEY),
    )
    assertNull(StorageValidation.entryKey(StorageMode.PLAIN, "x".repeat(StorageValidation.MAX_ENTRY_KEY_LENGTH)))
  }

  @Test
  fun `single values use UTF-8 bytes and enforce the one MiB boundary`() {
    val valueAtLimit = "a".repeat(StorageValidation.MAX_VALUE_BYTES)
    assertCode("PERSIST_KV_INVALID_VALUE", StorageValidation.entry(StorageMode.PLAIN, "key", null))
    assertNull(StorageValidation.entry(StorageMode.PLAIN, "key", valueAtLimit))
    assertCode(
      "PERSIST_KV_VALUE_TOO_LARGE",
      StorageValidation.entry(StorageMode.PLAIN, "key", valueAtLimit + "a"),
    )
  }

  @Test
  fun `key batches enforce the 512 item boundary and validate every key`() {
    assertCode("PERSIST_KV_INVALID_BATCH", StorageValidation.keys(StorageMode.PLAIN, null))
    assertCode(
      "PERSIST_KV_BATCH_TOO_LARGE",
      StorageValidation.keys(StorageMode.PLAIN, List(StorageValidation.MAX_BATCH_SIZE + 1) { "key-$it" }),
    )
    assertCode(
      "PERSIST_KV_INVALID_ENTRY_KEY",
      StorageValidation.keys(StorageMode.PLAIN, listOf("valid", "bad\u0000key")),
    )
    assertNull(StorageValidation.keys(StorageMode.PLAIN, List(StorageValidation.MAX_BATCH_SIZE) { "key-$it" }))
  }

  @Test
  fun `write batches enforce shape size and each value boundary`() {
    assertCode("PERSIST_KV_INVALID_BATCH", StorageValidation.batch(StorageMode.PLAIN, null, null))
    assertCode(
      "PERSIST_KV_BATCH_SHAPE_INVALID",
      StorageValidation.batch(StorageMode.PLAIN, listOf("key"), emptyList()),
    )
    assertCode(
      "PERSIST_KV_BATCH_TOO_LARGE",
      StorageValidation.batch(
        StorageMode.PLAIN,
        List(StorageValidation.MAX_BATCH_SIZE + 1) { "key-$it" },
        List(StorageValidation.MAX_BATCH_SIZE + 1) { "value-$it" },
      ),
    )
    assertCode(
      "PERSIST_KV_VALUE_TOO_LARGE",
      StorageValidation.batch(StorageMode.PLAIN, listOf("key"), listOf("a".repeat(StorageValidation.MAX_VALUE_BYTES + 1))),
    )
    assertNull(
      StorageValidation.batch(
        StorageMode.PLAIN,
        List(StorageValidation.MAX_BATCH_SIZE) { "key-$it" },
        List(StorageValidation.MAX_BATCH_SIZE) { "value-$it" },
      ),
    )
  }

  private fun assertCode(expected: String, actual: StorageValidationError?) {
    assertEquals(expected, actual?.code)
  }
}
