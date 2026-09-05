package com.catering.v2s.terminal.adapter.android.persistkv

import com.tencent.mmkv.MMKV
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalPersistKvModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalPersistKv")

    AsyncFunction("read") { persistenceKey: String, key: String, _timeoutMs: Double ->
      withStore(persistenceKey, "read") { store ->
        if (!store.containsKey(key)) {
          success(mapOf("state" to "missing"))
        } else {
          val value = store.decodeString(key)
          if (value == null) failure("PERSIST_KV_STRING_DECODE_FAILED", "persist-kv string decode failed", "read", key)
          else success(mapOf("state" to "found", "value" to value))
        }
      }
    }

    AsyncFunction("write") { persistenceKey: String, key: String, value: String, _timeoutMs: Double ->
      withStore(persistenceKey, "write") { store ->
        if (store.encode(key, value)) success(noOutput())
          else failure("PERSIST_KV_WRITE_FAILED", "persist-kv string write failed", "write", key)
      }
    }

    AsyncFunction("remove") { persistenceKey: String, key: String, _timeoutMs: Double ->
      withStore(persistenceKey, "remove") { store ->
        store.removeValueForKey(key)
        success(noOutput())
      }
    }

    AsyncFunction("readMany") { persistenceKey: String, keys: List<String>, _timeoutMs: Double ->
      withStore(persistenceKey, "readMany") { store ->
        val entries = mutableListOf<Map<String, Any?>>()
        for (key in keys) {
          if (!store.containsKey(key)) {
            entries += mapOf("key" to key, "result" to mapOf("state" to "missing"))
          } else {
            val value = store.decodeString(key)
            if (value == null) {
              return@withStore failure("PERSIST_KV_STRING_DECODE_FAILED", "persist-kv string decode failed", "readMany", key)
            }
            entries += mapOf("key" to key, "result" to mapOf("state" to "found", "value" to value))
          }
        }
        success(entries)
      }
    }

    AsyncFunction("writeMany") { persistenceKey: String, keys: List<String>, values: List<String>, _timeoutMs: Double ->
      withStore(persistenceKey, "writeMany") { store ->
        if (keys.size != values.size) {
          return@withStore failure("PERSIST_KV_BATCH_SHAPE_INVALID", "persist-kv batch key/value lengths differ", "writeMany")
        }
        for (index in keys.indices) {
          val key = keys[index]
          try {
            if (!store.encode(key, values[index])) {
              return@withStore failure("PERSIST_KV_WRITE_FAILED", "persist-kv string write failed", "writeMany", key)
            }
          } catch (_error: Throwable) {
            return@withStore failure("PERSIST_KV_WRITE_FAILED", "persist-kv string write failed", "writeMany", key)
          }
        }
        success(noOutput())
      }
    }

    AsyncFunction("removeMany") { persistenceKey: String, keys: List<String>, _timeoutMs: Double ->
      withStore(persistenceKey, "removeMany") { store ->
        if (keys.isNotEmpty()) store.removeValuesForKeys(keys.toTypedArray())
        success(noOutput())
      }
    }

    AsyncFunction("listKeys") { persistenceKey: String, _timeoutMs: Double ->
      withStore(persistenceKey, "listKeys") { store ->
        success(store.allKeys()?.toList() ?: emptyList<String>())
      }
    }

    AsyncFunction("clear") { persistenceKey: String, _timeoutMs: Double ->
      withStore(persistenceKey, "clear") { store ->
        store.clearAll()
        success(noOutput())
      }
    }
  }

  private val initializationLock = Any()
  private var initialized = false

  private fun withStore(
    persistenceKey: String,
    operation: String,
    block: (MMKV) -> Map<String, Any?>,
  ): Map<String, Any?> {
    if (persistenceKey.isEmpty()) return failure("PERSIST_KV_INVALID_KEY", "persist-kv persistence key is empty", operation)
    return try {
      val context = appContext.reactContext?.applicationContext
        ?: return unavailable("ADAPTER_NOT_INJECTED", "application context is unavailable", operation)
      val store = synchronized(initializationLock) {
        if (!initialized) {
          MMKV.initialize(context)
          initialized = true
        }
        MMKV.mmkvWithID(namespaceId(persistenceKey), MMKV.SINGLE_PROCESS_MODE)
      }
      block(store)
    } catch (_error: Throwable) {
      failure("PERSIST_KV_OPERATION_FAILED", "persist-kv operation failed", operation)
    }
  }

  private fun namespaceId(persistenceKey: String): String =
    "catering-v2s.terminal.state.v1." + percentEncodeUtf8(persistenceKey)

  private fun percentEncodeUtf8(value: String): String {
    val hex = "0123456789ABCDEF"
    return buildString {
      for (byte in value.toByteArray(Charsets.UTF_8)) {
        val unsigned = byte.toInt() and 0xFF
        val character = unsigned.toChar()
        if (unsigned in 0x41..0x5A || unsigned in 0x61..0x7A || unsigned in 0x30..0x39 || character == '-' || character == '.' || character == '_' || character == '~') {
          append(character)
        } else {
          append('%')
          append(hex[unsigned ushr 4])
          append(hex[unsigned and 0x0F])
        }
      }
    }
  }

  private fun success(value: Any?): Map<String, Any?> = mapOf(
    "status" to "succeeded",
    "value" to value,
    "completedAt" to System.currentTimeMillis(),
  )

  private fun noOutput(): Map<String, Any?> = mapOf("completed" to true)

  private fun unavailable(reason: String, message: String, capability: String): Map<String, Any?> = mapOf(
    "status" to "unavailable",
    "port" to "persistKv",
    "capability" to capability,
    "reason" to reason,
    "message" to message,
  )

  private fun failure(code: String, message: String, capability: String, key: String? = null): Map<String, Any?> {
    val error = buildMap<String, Any?> {
      put("code", code)
      put("message", message)
      put("retryable", true)
      if (key != null) put("key", key)
    }
    return mapOf(
      "status" to "failed",
      "port" to "persistKv",
      "capability" to capability,
      "error" to error,
    )
  }
}
