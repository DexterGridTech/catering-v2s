package com.catering.v2s.terminal.adapter.android.update

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.ReadableMap
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Callback
import org.json.JSONObject
import java.io.File
import java.net.InetSocketAddress
import java.net.Proxy
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.zip.ZipFile
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/** Streams and validates one signed-by-digest update source into app-private run-owned files. */
internal object TerminalUpdateArtifactPreparer {
  private const val TAG = "TerminalUpdate"
  private const val MAX_ARCHIVE_BYTES = 256L * 1024 * 1024
  private const val MAX_EXPANDED_BYTES = 512L * 1024 * 1024
  private const val MAX_MANIFEST_BYTES = 256L * 1024
  private const val MAX_FILES = 8192
  private const val RESERVED_BYTES = 64L * 1024 * 1024

  data class Prepared(val id: String, val directory: File)

  suspend fun prepare(
    context: Context,
    downloadUrl: String,
    expectedSha256: String,
    artifactJson: String,
    kind: String,
    timeoutMs: Long,
    proxy: ReadableMap?,
  ): Prepared {
    require(kind == "full" || kind == "hot") { "TERMINAL_UPDATE_KIND_INVALID" }
    require(expectedSha256.matches(Regex("[a-fA-F0-9]{64}"))) { "TERMINAL_UPDATE_SOURCE_DIGEST_INVALID" }
    require(timeoutMs in 1..120_000) { "TERMINAL_UPDATE_TIMEOUT_INVALID" }
    val url = java.net.URI(downloadUrl)
    require(url.scheme == "https" || url.scheme == "http") { "TERMINAL_UPDATE_SOURCE_URL_INVALID" }
    require(url.userInfo == null && url.fragment == null && url.host != null) { "TERMINAL_UPDATE_SOURCE_URL_INVALID" }
    val artifact = JSONObject(artifactJson)
    require(artifact.getString("platform") == "android") { "TERMINAL_UPDATE_ARTIFACT_PLATFORM_INVALID" }
    val directory = File(context.filesDir, "terminal-update/prepared/${UUID.randomUUID()}")
    require(directory.mkdirs()) { "TERMINAL_UPDATE_PREPARED_DIRECTORY_CREATE_FAILED" }
    try {
      File(directory, "artifact.json").writeText(artifact.toString(), Charsets.UTF_8)
      val archive = File(directory, "candidate.zip")
      download(context, downloadUrl, expectedSha256.lowercase(), timeoutMs, proxy, archive)
      if (kind == "hot") extractHot(archive, directory, artifact)
      else validateFull(context, extractFull(archive, directory, artifact), artifact)
      Log.i(TAG, "event=artifact-prepared kind=$kind bytes=${archive.length()} files=${artifact.optJSONArray("files")?.length() ?: 0}")
      return Prepared(directory.name, directory)
    } catch (error: Throwable) {
      directory.deleteRecursively()
      val stableCode = error.message?.let { Regex("TERMINAL_UPDATE_[A-Z0-9_]+|^[A-Z0-9_]{1,64}$").find(it)?.value }
        ?: "NATIVE_IO_FAILURE"
      Log.e(TAG, "event=artifact-prepare status=failed code=$stableCode errorType=${error.javaClass.simpleName}")
      throw error
    }
  }

  fun release(context: Context, preparedId: String): Boolean {
    require(preparedId.matches(Regex("[A-Fa-f0-9-]{36}"))) { "TERMINAL_UPDATE_PREPARED_ID_INVALID" }
    val root = File(context.filesDir, "terminal-update/prepared").canonicalFile
    val target = File(root, preparedId).canonicalFile
    require(target.parentFile == root) { "TERMINAL_UPDATE_PREPARED_PATH_INVALID" }
    return !target.exists() || target.deleteRecursively()
  }

  fun preparedFile(context: Context, preparedId: String, fileName: String): File {
    require(preparedId.matches(Regex("[A-Fa-f0-9-]{36}"))) { "TERMINAL_UPDATE_PREPARED_ID_INVALID" }
    require(fileName == "artifact.json" || fileName == "candidate.apk" || fileName == "candidate.zip") {
      "TERMINAL_UPDATE_PREPARED_FILE_INVALID"
    }
    val directory = preparedDirectory(context, preparedId)
    val file = File(directory, fileName).canonicalFile
    require(file.parentFile == directory && file.isFile) { "TERMINAL_UPDATE_PREPARED_FILE_MISSING" }
    return file
  }

  fun preparedDirectory(context: Context, preparedId: String): File {
    require(preparedId.matches(Regex("[A-Fa-f0-9-]{36}"))) { "TERMINAL_UPDATE_PREPARED_ID_INVALID" }
    val root = File(context.filesDir, "terminal-update/prepared").canonicalFile
    val directory = File(root, preparedId).canonicalFile
    require(directory.parentFile == root) { "TERMINAL_UPDATE_PREPARED_PATH_INVALID" }
    require(directory.isDirectory) { "TERMINAL_UPDATE_PREPARED_DIRECTORY_MISSING" }
    return directory
  }

  private suspend fun download(context: Context, url: String, expectedSha: String, timeoutMs: Long, proxy: ReadableMap?, target: File) {
    val builder = OkHttpClient.Builder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .followRedirects(false)
      .followSslRedirects(false)
    if (proxy != null) {
      require(proxy.getString("protocol") == "http") { "TERMINAL_UPDATE_PROXY_UNSUPPORTED" }
      val host = proxy.getString("host")?.takeIf(String::isNotBlank) ?: error("TERMINAL_UPDATE_PROXY_INVALID")
      val port = proxy.getInt("port")
      require(port in 1..65535) { "TERMINAL_UPDATE_PROXY_INVALID" }
      builder.proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress(host, port)))
      val username = proxy.getString("username")
      val password = proxy.getString("password")
      if (!username.isNullOrEmpty() && password != null) {
        builder.proxyAuthenticator(Authenticator { _, response ->
          if (response.request.header("Proxy-Authorization") != null) null
          else response.request.newBuilder().header("Proxy-Authorization", Credentials.basic(username, password)).build()
        })
      }
    }
    val call = builder.build().newCall(Request.Builder().url(url).get().build())
    suspendCancellableCoroutine<Unit> { continuation ->
      continuation.invokeOnCancellation { call.cancel() }
      call.enqueue(object : Callback {
        override fun onFailure(call: Call, error: java.io.IOException) {
          if (continuation.isActive) continuation.resumeWithException(error)
        }

        override fun onResponse(call: Call, response: Response) {
          try {
            response.use {
      require(response.code == 200) { "TERMINAL_UPDATE_DOWNLOAD_HTTP_${response.code}" }
      val body = response.body ?: error("TERMINAL_UPDATE_DOWNLOAD_BODY_MISSING")
      val declared = body.contentLength()
      require(declared < 0 || declared <= MAX_ARCHIVE_BYTES) { "TERMINAL_UPDATE_ARCHIVE_TOO_LARGE" }
      val expansionReserve = if (target.name.endsWith(".zip")) MAX_EXPANDED_BYTES else 0L
      val required = (if (declared < 0) MAX_ARCHIVE_BYTES else declared) + expansionReserve + RESERVED_BYTES
      require(android.os.StatFs(context.filesDir.absolutePath).availableBytes >= required) {
        "TERMINAL_UPDATE_STORAGE_RESERVE_UNAVAILABLE"
      }
      val digest = MessageDigest.getInstance("SHA-256")
      var count = 0L
      body.byteStream().use { input -> target.outputStream().buffered(64 * 1024).use { output ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          count += read
          require(count <= MAX_ARCHIVE_BYTES) { "TERMINAL_UPDATE_ARCHIVE_TOO_LARGE" }
          digest.update(buffer, 0, read)
          output.write(buffer, 0, read)
        }
      } }
      require(count > 0 && digest.digest().hex() == expectedSha) { "TERMINAL_UPDATE_ARCHIVE_DIGEST_MISMATCH" }
            }
            if (continuation.isActive) continuation.resume(Unit)
          } catch (error: Throwable) {
            if (continuation.isActive) continuation.resumeWithException(error)
          }
        }
      })
    }
  }

  private fun extractHot(archive: File, directory: File, expected: JSONObject) {
    val files = expected.getJSONArray("files")
    require(files.length() in 1..MAX_FILES) { "TERMINAL_UPDATE_FILE_COUNT_INVALID" }
    val expectedByPath = LinkedHashMap<String, Pair<Long, String>>()
    for (index in 0 until files.length()) {
      val item = files.getJSONObject(index)
      val path = safeRelative(item.getString("path"))
      require(expectedByPath.put(path, item.getLong("sizeBytes") to item.getString("sha256")) == null) {
        "TERMINAL_UPDATE_ARTIFACT_DUPLICATE_PATH"
      }
    }
    val expectedFiles = expectedByPath.keys + "terminal-update-publication.json"
    val expectedDirectories = expectedByPath.keys.flatMap { filePath ->
      val parts = filePath.split('/')
      (1 until parts.size).map { parts.take(it).joinToString("/") + "/" }
    }.toSet()
    var expanded = 0L
    ZipFile(archive).use { zip ->
      val entries = zip.entries().asSequence().toList()
      require(entries.map { it.name }.toSet().size == entries.size) {
        "TERMINAL_UPDATE_ZIP_ENTRY_SET_INVALID"
      }
      require(entries.all { entry ->
        if (entry.isDirectory) {
          val directoryName = entry.name.removeSuffix("/")
          safeRelative(directoryName) == directoryName && "${directoryName}/" in expectedDirectories
        } else {
          safeRelative(entry.name) == entry.name && entry.name in expectedFiles
        }
      } && entries.filterNot { it.isDirectory }.map { it.name }.toSet() == expectedFiles) {
        "TERMINAL_UPDATE_ZIP_ENTRY_SET_INVALID"
      }
      val manifestEntry = zip.getEntry("terminal-update-publication.json") ?: error("TERMINAL_UPDATE_ZIP_MANIFEST_MISSING")
      val manifestBytes = zip.getInputStream(manifestEntry).use { readBounded(it, MAX_MANIFEST_BYTES) }
      val manifest = JSONObject(String(manifestBytes, Charsets.UTF_8))
      require(manifest.getInt("schemaVersion") == expected.getInt("schemaVersion") &&
        manifest.getString("platform") == expected.getString("platform") &&
        manifest.getString("applicationId") == expected.getString("applicationId") &&
        manifest.getString("nativeVersion") == expected.getString("nativeVersion") &&
        manifest.getLong("nativeBuildNumber") == expected.getLong("nativeBuildNumber") &&
        manifest.getString("bundleVersion") == expected.getString("bundleVersion") &&
        manifest.getString("runtimeVersion") == expected.getString("runtimeVersion") &&
        manifest.getString("entry") == expected.getString("entry") &&
        manifest.getString("publicationId") == expected.getString("publicationId") &&
        manifest.getJSONArray("files").length() == files.length()) {
        "TERMINAL_UPDATE_ZIP_MANIFEST_MISMATCH"
      }
      val manifestFiles = manifest.getJSONArray("files")
      require((0 until files.length()).all { index ->
        val actual = manifestFiles.getJSONObject(index)
        val wanted = files.getJSONObject(index)
        actual.getString("path") == wanted.getString("path") &&
          actual.getLong("sizeBytes") == wanted.getLong("sizeBytes") &&
          actual.getString("sha256").equals(wanted.getString("sha256"), ignoreCase = true)
      }) { "TERMINAL_UPDATE_ZIP_MANIFEST_MISMATCH" }
      val expectedMinimumFull = expected.optJSONObject("minimumFull")
      val actualMinimumFull = manifest.optJSONObject("minimumFull")
      require((expectedMinimumFull == null && actualMinimumFull == null) ||
        (expectedMinimumFull != null && actualMinimumFull != null &&
          expectedMinimumFull.getString("applicationId") == actualMinimumFull.getString("applicationId") &&
          expectedMinimumFull.getInt("nativeBuildNumber") == actualMinimumFull.getInt("nativeBuildNumber") &&
          expectedMinimumFull.getString("runtimeVersion") == actualMinimumFull.getString("runtimeVersion") &&
          expectedMinimumFull.getString("publicationId") == actualMinimumFull.getString("publicationId") &&
          expectedMinimumFull.getString("apkSha256").equals(actualMinimumFull.getString("apkSha256"), ignoreCase = true))) {
        "TERMINAL_UPDATE_ZIP_MANIFEST_MISMATCH"
      }
      for (entry in entries) {
        if (entry.isDirectory) continue
        if (entry.name == "terminal-update-publication.json") continue
        val (size, sha) = expectedByPath[entry.name] ?: error("TERMINAL_UPDATE_ZIP_ENTRY_UNEXPECTED")
        require(entry.size == size) { "TERMINAL_UPDATE_RESOURCE_SIZE_MISMATCH" }
        val output = File(directory, safeRelative(entry.name)).canonicalFile
        require(output.path.startsWith(directory.canonicalPath + File.separator)) { "TERMINAL_UPDATE_ZIP_PATH_ESCAPE" }
        output.parentFile?.mkdirs()
        val digest = MessageDigest.getInstance("SHA-256")
        var written = 0L
        zip.getInputStream(entry).use { input -> output.outputStream().buffered(64 * 1024).use { stream ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            written += read
            expanded += read.toLong()
            require(written <= size && expanded <= MAX_EXPANDED_BYTES) { "TERMINAL_UPDATE_EXPANDED_SIZE_LIMIT" }
            digest.update(buffer, 0, read)
            stream.write(buffer, 0, read)
          }
        } }
        require(written == size && digest.digest().hex() == sha) { "TERMINAL_UPDATE_RESOURCE_DIGEST_MISMATCH" }
      }
      require(expanded <= MAX_EXPANDED_BYTES) { "TERMINAL_UPDATE_EXPANDED_SIZE_LIMIT" }
    }
    archive.delete()
  }

  internal fun extractFull(archive: File, directory: File, artifact: JSONObject): File {
    val identity = artifact.optJSONObject("apk") ?: error("TERMINAL_UPDATE_APK_IDENTITY_INVALID")
    val entryName = safeRelative(identity.getString("path"))
    require('/' !in entryName) { "TERMINAL_UPDATE_FULL_ZIP_ENTRY_INVALID" }
    val output = File(directory, "candidate.apk")
    ZipFile(archive).use { zip ->
      val entries = zip.entries().asSequence().toList()
      require(entries.size == 1 && !entries.single().isDirectory && entries.single().name == entryName) {
        "TERMINAL_UPDATE_FULL_ZIP_ENTRY_INVALID"
      }
      val entry = entries.single()
      require(entry.size in 1..MAX_ARCHIVE_BYTES) { "TERMINAL_UPDATE_APK_SIZE_INVALID" }
      val digest = MessageDigest.getInstance("SHA-256")
      var written = 0L
      zip.getInputStream(entry).use { input ->
        output.outputStream().buffered(64 * 1024).use { stream ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            written += read
            require(written <= entry.size && written <= MAX_ARCHIVE_BYTES) {
              "TERMINAL_UPDATE_APK_SIZE_INVALID"
            }
            digest.update(buffer, 0, read)
            stream.write(buffer, 0, read)
          }
        }
      }
      require(written == entry.size && digest.digest().hex() == identity.getString("sha256")) {
        "TERMINAL_UPDATE_APK_DIGEST_MISMATCH"
      }
    }
    archive.delete()
    return output
  }

  private fun validateFull(context: Context, apk: File, artifact: JSONObject) {
    val apkInfo = context.packageManager.getPackageArchiveInfo(apk.path, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES)
      ?: error("TERMINAL_UPDATE_APK_IDENTITY_INVALID")
    require(apkInfo.packageName == artifact.getString("applicationId")) { "TERMINAL_UPDATE_APK_PACKAGE_MISMATCH" }
    val actualBuild = if (android.os.Build.VERSION.SDK_INT >= 28) apkInfo.longVersionCode else apkInfo.versionCode.toLong()
    require(actualBuild == artifact.getLong("nativeBuildNumber")) { "TERMINAL_UPDATE_APK_VERSION_MISMATCH" }
    require(apkInfo.versionName == artifact.getString("nativeVersion")) { "TERMINAL_UPDATE_APK_VERSION_MISMATCH" }
    val apkIdentity = artifact.optJSONObject("apk") ?: error("TERMINAL_UPDATE_APK_IDENTITY_INVALID")
    val signingInfo = apkInfo.signingInfo ?: error("TERMINAL_UPDATE_APK_SIGNER_MISSING")
    val signerDigest = signingInfo.apkContentsSigners.singleOrNull()?.toByteArray()?.let {
      MessageDigest.getInstance("SHA-256").digest(it).hex()
    } ?: error("TERMINAL_UPDATE_APK_SIGNER_INVALID")
    require(signerDigest.equals(apkIdentity.getString("certificateSha256"), ignoreCase = true)) {
      "TERMINAL_UPDATE_APK_SIGNER_MISMATCH"
    }
    val digest = apk.sha256(MAX_ARCHIVE_BYTES)
    require(digest == apkIdentity.getString("sha256")) { "TERMINAL_UPDATE_APK_DIGEST_MISMATCH" }
    apk.setReadOnly()
  }

  private fun safeRelative(value: String): String {
    require(value.isNotBlank() && !value.startsWith('/') && !value.startsWith('\\') && '\\' !in value) {
      "TERMINAL_UPDATE_PATH_INVALID"
    }
    val parts = value.split('/')
    require(parts.none { it.isBlank() || it == "." || it == ".." } && !value.contains(':')) { "TERMINAL_UPDATE_PATH_INVALID" }
    return value
  }

  private fun readBounded(input: java.io.InputStream, limit: Long): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    var total = 0L
    while (true) {
      val count = input.read(buffer)
      if (count < 0) break
      total += count
      require(total <= limit) { "TERMINAL_UPDATE_MANIFEST_TOO_LARGE" }
      output.write(buffer, 0, count)
    }
    return output.toByteArray()
  }

  private fun File.sha256(limit: Long): String {
    val digest = MessageDigest.getInstance("SHA-256")
    var count = 0L
    inputStream().buffered(64 * 1024).use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        count += read
        require(count <= limit) { "TERMINAL_UPDATE_ARCHIVE_TOO_LARGE" }
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().hex()
  }

  private fun ByteArray.hex(): String = joinToString("") { "%02x".format(it) }
  private fun MessageDigest.hex(): String = digest().hex()
}
