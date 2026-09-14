package com.catering.v2s.terminal.adapter.android.persistkv

import android.provider.Settings
import android.util.Log
import com.tencent.mmkv.MMKV
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalPersistKvModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TerminalPersistKv")

    AsyncFunction("read") { persistenceKey: String?, modeToken: String?, key: String? ->
      withStore(persistenceKey, modeToken, "read", { mode -> StorageValidation.entryKey(mode, key) }) { config, store ->
        if (!store.containsKey(key!!)) success(config, "read", mapOf("state" to "missing"))
        else {
          val value = store.decodeString(key)
          if (value == null) failure(config, "PERSIST_KV_STRING_DECODE_FAILED", "persist-kv string decode failed", "read", false)
          else success(config, "read", mapOf("state" to "found", "value" to value))
        }
      }
    }

    AsyncFunction("write") { persistenceKey: String?, modeToken: String?, key: String?, value: String? ->
      withStore(persistenceKey, modeToken, "write", { mode -> StorageValidation.entry(mode, key, value) }) { config, store ->
        if (store.encode(key!!, value!!)) {
          store.sync()
          success(config, "write", noOutput())
        } else {
          failure(config, "PERSIST_KV_WRITE_FAILED", "persist-kv string write failed", "write", true)
        }
      }
    }

    AsyncFunction("remove") { persistenceKey: String?, modeToken: String?, key: String? ->
      withStore(persistenceKey, modeToken, "remove", { mode -> StorageValidation.entryKey(mode, key) }) { config, store ->
        store.removeValueForKey(key!!)
        store.sync()
        success(config, "remove", noOutput())
      }
    }

    AsyncFunction("readMany") { persistenceKey: String?, modeToken: String?, keys: List<String>? ->
      withStore(persistenceKey, modeToken, "readMany", { mode -> StorageValidation.keys(mode, keys) }) { config, store ->
        val entries = mutableListOf<Map<String, Any?>>()
        for (key in keys!!) {
          if (!store.containsKey(key)) {
            entries += mapOf("key" to key, "result" to mapOf("state" to "missing"))
          } else {
            val value = store.decodeString(key)
            if (value == null) {
              return@withStore failure(config, "PERSIST_KV_STRING_DECODE_FAILED", "persist-kv string decode failed", "readMany", false)
            }
            entries += mapOf("key" to key, "result" to mapOf("state" to "found", "value" to value))
          }
        }
        success(config, "readMany", entries)
      }
    }

    AsyncFunction("writeMany") { persistenceKey: String?, modeToken: String?, keys: List<String>?, values: List<String>? ->
      withStore(persistenceKey, modeToken, "writeMany", { mode -> StorageValidation.batch(mode, keys, values) }) { config, store ->
        for (index in keys!!.indices) {
          if (!store.encode(keys[index], values!![index])) {
            return@withStore failure(config, "PERSIST_KV_WRITE_FAILED", "persist-kv string write failed", "writeMany", true)
          }
        }
        store.sync()
        success(config, "writeMany", noOutput())
      }
    }

    AsyncFunction("removeMany") { persistenceKey: String?, modeToken: String?, keys: List<String>? ->
      withStore(persistenceKey, modeToken, "removeMany", { mode -> StorageValidation.keys(mode, keys) }) { config, store ->
        if (keys!!.isNotEmpty()) store.removeValuesForKeys(keys.toTypedArray())
        store.sync()
        success(config, "removeMany", noOutput())
      }
    }

    AsyncFunction("listKeys") { persistenceKey: String?, modeToken: String? ->
      withStore(persistenceKey, modeToken, "listKeys") { config, store ->
        val keys = store.allKeys()?.filter { it != StorageValidation.PROTECTED_INITIALIZED_KEY } ?: emptyList()
        success(config, "listKeys", keys)
      }
    }

    AsyncFunction("clear") { persistenceKey: String?, modeToken: String? ->
      withStore(persistenceKey, modeToken, "clear") { config, store ->
        store.clearAll()
        if (config.mode == StorageMode.PROTECTED) {
          if (!store.encode(StorageValidation.PROTECTED_INITIALIZED_KEY, PROTECTED_INITIALIZED_VALUE)) {
            return@withStore failure(config, "PERSIST_KV_PROTECTED_MARKER_WRITE_FAILED", "protected namespace marker write failed", "clear", true)
          }
        }
        store.sync()
        success(config, "clear", noOutput())
      }
    }
  }

  private data class ModeConfig(
    val mode: StorageMode,
    val namespace: String,
    val cryptKey: String?,
  )

  private sealed class OpenedStore {
    data class Ready(val config: ModeConfig, val store: MMKV) : OpenedStore()
    data class Finished(val result: Map<String, Any?>) : OpenedStore()
  }

  private val initializationLock = Any()
  private var initialized = false

  private fun withStore(
    persistenceKey: String?,
    modeToken: String?,
    capability: String,
    validate: ((StorageMode) -> StorageValidationError?)? = null,
    block: (ModeConfig, MMKV) -> Map<String, Any?>,
  ): Map<String, Any?> {
    val mode = StorageModeResolver.resolve(modeToken)
    if (mode == null) return invalidMode(modeToken, capability)
    StorageValidation.persistenceKey(persistenceKey)?.let {
      return failureForMode(mode, it.code, it.message, capability, false)
    }
    validate?.invoke(mode)?.let {
      return failureForMode(mode, it.code, it.message, capability, false)
    }

    val opened = openStore(persistenceKey!!, mode, capability)
    return when (opened) {
      is OpenedStore.Finished -> opened.result
      is OpenedStore.Ready -> try {
        block(opened.config, opened.store)
      } catch (_error: Throwable) {
        failure(opened.config, "PERSIST_KV_OPERATION_FAILED", "persist-kv operation failed", capability, true)
      }
    }
  }

  private fun openStore(
    persistenceKey: String,
    mode: StorageMode,
    capability: String,
  ): OpenedStore {
    val context = appContext.reactContext?.applicationContext
      ?: return OpenedStore.Finished(unavailable(mode, "ADAPTER_NOT_INJECTED", "application context is unavailable", capability))

    return try {
      synchronized(initializationLock) {
        if (!initialized) {
          val rootDir = MMKV.initialize(context)
          if (rootDir.isEmpty()) {
            return@synchronized OpenedStore.Finished(
              failureForMode(mode, "PERSIST_KV_INITIALIZATION_FAILED", "persist-kv initialization failed", capability, true),
            )
          }
          initialized = true
        }

        val namespace = namespaceId(persistenceKey, mode)
        val cryptKey = if (mode == StorageMode.PROTECTED) cryptKeyOf(context) else null
        if (mode == StorageMode.PROTECTED && cryptKey == null) {
          return@synchronized OpenedStore.Finished(
            unavailable(mode, "PLATFORM_UNSUPPORTED", "stable device identity is unavailable", capability),
          )
        }

        val existing = mode == StorageMode.PROTECTED && MMKV.checkExist(namespace)
        val store = if (cryptKey == null) {
          MMKV.mmkvWithID(namespace, MMKV.SINGLE_PROCESS_MODE)
        } else {
          MMKV.mmkvWithID(namespace, MMKV.SINGLE_PROCESS_MODE, cryptKey)
        }

        if (mode == StorageMode.PROTECTED) {
          val marker = store.decodeString(StorageValidation.PROTECTED_INITIALIZED_KEY)
          if (existing && marker != PROTECTED_INITIALIZED_VALUE) {
            return@synchronized OpenedStore.Finished(
              failureForMode(mode, "PERSIST_KV_PROTECTED_KEY_MISMATCH", "protected storage identity does not match", capability, false),
            )
          }
          if (!existing) {
            if (!store.encode(StorageValidation.PROTECTED_INITIALIZED_KEY, PROTECTED_INITIALIZED_VALUE)) {
              return@synchronized OpenedStore.Finished(
                failureForMode(mode, "PERSIST_KV_PROTECTED_MARKER_WRITE_FAILED", "protected namespace marker write failed", capability, true),
              )
            }
            store.sync()
          }
        }

        OpenedStore.Ready(ModeConfig(mode, namespace, cryptKey), store)
      }
    } catch (_error: Throwable) {
      failureForMode(mode, "PERSIST_KV_OPERATION_FAILED", "persist-kv operation failed", capability, true).also {
        logResult(mode, capability, it)
      }.let { OpenedStore.Finished(it) }
    }
  }

  private fun namespaceId(persistenceKey: String, mode: StorageMode): String {
    val prefix = if (mode == StorageMode.PLAIN) PLAIN_NAMESPACE_PREFIX else PROTECTED_NAMESPACE_PREFIX
    return prefix + percentEncodeUtf8(persistenceKey)
  }

  private fun cryptKeyOf(context: android.content.Context): String? {
    val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)?.trim().orEmpty()
    if (deviceId.isEmpty()) return null
    return PROTECTED_CRYPT_KEY_PREFIX + deviceId
  }

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

  private fun success(config: ModeConfig, capability: String, value: Any?): Map<String, Any?> = mapOf(
    "status" to "succeeded",
    "port" to config.mode.portName,
    "mode" to config.mode.wireName,
    "capability" to capability,
    "value" to value,
    "completedAt" to System.currentTimeMillis(),
  ).also { logResult(config.mode, capability, it) }

  private fun noOutput(): Map<String, Any?> = mapOf("completed" to true)

  private fun unavailable(mode: StorageMode, reason: String, message: String, capability: String): Map<String, Any?> = mapOf(
    "status" to "unavailable",
    "port" to mode.portName,
    "mode" to mode.wireName,
    "capability" to capability,
    "reason" to reason,
    "message" to message,
  ).also { logResult(mode, capability, it) }

  private fun failure(
    config: ModeConfig,
    code: String,
    message: String,
    capability: String,
    retryable: Boolean,
  ): Map<String, Any?> = failureForMode(config.mode, code, message, capability, retryable)

  private fun failureForMode(
    mode: StorageMode,
    code: String,
    message: String,
    capability: String,
    retryable: Boolean,
  ): Map<String, Any?> = mapOf(
    "status" to "failed",
    "port" to mode.portName,
    "mode" to mode.wireName,
    "capability" to capability,
    "error" to mapOf(
      "code" to code,
      "message" to message,
      "retryable" to retryable,
    ),
  ).also { logResult(mode, capability, it) }

  private fun invalidMode(modeToken: String?, capability: String): Map<String, Any?> = mapOf(
    "status" to "failed",
    "port" to "persistKv",
    "mode" to (modeToken ?: "invalid"),
    "capability" to capability,
    "error" to mapOf(
      "code" to "PERSIST_KV_INVALID_MODE",
      "message" to "persist-kv storage mode is invalid",
      "retryable" to false,
    ),
  ).also { Log.w(LOG_TAG, "event=persist-kv operation=$capability mode=invalid status=failed code=PERSIST_KV_INVALID_MODE") }

  private fun logResult(mode: StorageMode, capability: String, result: Map<String, Any?>) {
    val status = result["status"] as? String ?: "unknown"
    val error = result["error"] as? Map<*, *>
    val code = error?.get("code") as? String
    val suffix = if (code == null) "" else " code=$code"
    Log.i(LOG_TAG, "event=persist-kv operation=$capability mode=${mode.wireName} status=$status$suffix")
  }

  private companion object {
    const val LOG_TAG = "TerminalPersistKv"
    const val PLAIN_NAMESPACE_PREFIX = "catering-v2s.terminal.state.v1."
    const val PROTECTED_NAMESPACE_PREFIX = "catering-v2s.terminal.state.protected.v1."
    const val PROTECTED_CRYPT_KEY_PREFIX = "catering-v2s.persist-secure.v1:"
    const val PROTECTED_INITIALIZED_VALUE = "initialized"
  }
}
