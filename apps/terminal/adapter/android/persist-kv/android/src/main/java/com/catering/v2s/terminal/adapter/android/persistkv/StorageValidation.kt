package com.catering.v2s.terminal.adapter.android.persistkv

internal data class StorageValidationError(
  val code: String,
  val message: String,
)

internal object StorageValidation {
  const val PROTECTED_INITIALIZED_KEY = "__catering_v2s_protected_initialized_v1__"
  const val MAX_PERSISTENCE_KEY_LENGTH = 128
  const val MAX_ENTRY_KEY_LENGTH = 256
  const val MAX_VALUE_BYTES = 1 shl 20
  const val MAX_BATCH_SIZE = 512

  fun persistenceKey(value: String?): StorageValidationError? {
    if (value == null || value.isEmpty()) return error("PERSIST_KV_INVALID_PERSISTENCE_KEY", "persist-kv persistence key is required")
    if (value.length > MAX_PERSISTENCE_KEY_LENGTH) return error("PERSIST_KV_INVALID_PERSISTENCE_KEY", "persist-kv persistence key is too long")
    if (containsControlCharacter(value)) return error("PERSIST_KV_INVALID_PERSISTENCE_KEY", "persist-kv persistence key contains a control character")
    return null
  }

  fun entryKey(mode: StorageMode, key: String?): StorageValidationError? {
    if (key == null || key.isEmpty()) return error("PERSIST_KV_INVALID_ENTRY_KEY", "persist-kv entry key is required")
    if (key.length > MAX_ENTRY_KEY_LENGTH) return error("PERSIST_KV_INVALID_ENTRY_KEY", "persist-kv entry key is too long")
    if (containsControlCharacter(key)) return error("PERSIST_KV_INVALID_ENTRY_KEY", "persist-kv entry key contains a control character")
    if (mode == StorageMode.PROTECTED && key == PROTECTED_INITIALIZED_KEY) {
      return error("PERSIST_KV_RESERVED_KEY", "persist-kv entry key is reserved")
    }
    return null
  }

  fun entry(mode: StorageMode, key: String?, value: String?): StorageValidationError? {
    entryKey(mode, key)?.let { return it }
    if (value == null) return error("PERSIST_KV_INVALID_VALUE", "persist-kv value is required")
    if (value.toByteArray(Charsets.UTF_8).size > MAX_VALUE_BYTES) {
      return error("PERSIST_KV_VALUE_TOO_LARGE", "persist-kv value exceeds the limit")
    }
    return null
  }

  fun keys(mode: StorageMode, keys: List<String>?): StorageValidationError? {
    if (keys == null) return error("PERSIST_KV_INVALID_BATCH", "persist-kv key batch is required")
    if (keys.size > MAX_BATCH_SIZE) return error("PERSIST_KV_BATCH_TOO_LARGE", "persist-kv batch exceeds the limit")
    for (key in keys) {
      entryKey(mode, key)?.let { return it }
    }
    return null
  }

  fun batch(mode: StorageMode, keys: List<String>?, values: List<String>?): StorageValidationError? {
    if (keys == null || values == null) return error("PERSIST_KV_INVALID_BATCH", "persist-kv batch is required")
    if (keys.size != values.size) return error("PERSIST_KV_BATCH_SHAPE_INVALID", "persist-kv batch key/value lengths differ")
    if (keys.size > MAX_BATCH_SIZE) return error("PERSIST_KV_BATCH_TOO_LARGE", "persist-kv batch exceeds the limit")
    for (index in keys.indices) {
      entryKey(mode, keys[index])?.let { return it }
      if (values[index].toByteArray(Charsets.UTF_8).size > MAX_VALUE_BYTES) {
        return error("PERSIST_KV_VALUE_TOO_LARGE", "persist-kv value exceeds the limit")
      }
    }
    return null
  }

  private fun containsControlCharacter(value: String): Boolean = value.any { it.isISOControl() }

  private fun error(code: String, message: String) = StorageValidationError(code, message)

}
