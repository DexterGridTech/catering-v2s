package com.catering.v2s.terminal.adapter.android.update

import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

class TerminalUpdateFullPackageTest {
  @Test
  fun `extracts the declared FULL APK and verifies its inner digest`() {
    val root = createTempDir(prefix = "ter-full-package-")
    try {
      val apkBytes = "signed-apk-bytes".toByteArray()
      val archive = File(root, "full.zip")
      ZipOutputStream(archive.outputStream()).use { zip ->
        zip.putNextEntry(ZipEntry("sample-terminal.apk"))
        zip.write(apkBytes)
        zip.closeEntry()
      }
      val expected = JSONObject().put(
        "apk",
        JSONObject().put("path", "sample-terminal.apk").put("sha256", sha256(apkBytes)),
      )

      val extracted = TerminalUpdateArtifactPreparer.extractFull(archive, root, expected)

      assertEquals("candidate.apk", extracted.name)
      assertArrayEquals(apkBytes, extracted.readBytes())
      assertEquals(false, archive.exists())
    } finally {
      root.deleteRecursively()
    }
  }

  @Test
  fun `rejects a FULL APK whose digest does not match the artifact`() {
    val root = createTempDir(prefix = "ter-full-package-red-")
    try {
      val archive = File(root, "full.zip")
      ZipOutputStream(archive.outputStream()).use { zip ->
        zip.putNextEntry(ZipEntry("sample-terminal.apk"))
        zip.write("different-apk-bytes".toByteArray())
        zip.closeEntry()
      }
      val expected = JSONObject().put(
        "apk",
        JSONObject().put("path", "sample-terminal.apk").put("sha256", "0".repeat(64)),
      )

      try {
        TerminalUpdateArtifactPreparer.extractFull(archive, root, expected)
        fail("TERMINAL_UPDATE_FULL_APK_DIGEST_RED_MISSING")
      } catch (error: IllegalArgumentException) {
        assertEquals("TERMINAL_UPDATE_APK_DIGEST_MISMATCH", error.message)
      }
    } finally {
      root.deleteRecursively()
    }
  }

  private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes)
    .joinToString("") { "%02x".format(it) }
}
