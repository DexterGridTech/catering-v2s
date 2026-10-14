package com.catering.v2s.terminal.adapter.android.transport

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalHttpFailureCodeTest {
  @Test
  fun `maps common network failures to safe diagnostic codes`() {
    assertEquals("ANDROID_HTTP_DNS_FAILED", terminalHttpFailureCode(UnknownHostException()))
    assertEquals("ANDROID_HTTP_CONNECT_FAILED", terminalHttpFailureCode(ConnectException()))
    assertEquals("ANDROID_HTTP_TIMEOUT", terminalHttpFailureCode(SocketTimeoutException()))
    assertEquals("ANDROID_HTTP_REQUEST_INVALID", terminalHttpFailureCode(IllegalArgumentException()))
    assertEquals("ANDROID_HTTP_NATIVE_REQUEST_FAILED", terminalHttpFailureCode(Exception()))
  }

  @Test
  fun `accepts complete project rule response above websocket message size`() {
    val response = "x".repeat(67_079)

    assertEquals(response, readBoundedTerminalHttpBody(ByteArrayInputStream(response.toByteArray())))
  }

  @Test
  fun `accepts compressed HTTP response after decoding above websocket message size`() {
    val response = "x".repeat(67_079)
    val compressed = ByteArrayOutputStream().also { output ->
      GZIPOutputStream(output).use { it.write(response.toByteArray()) }
    }.toByteArray()

    assertTrue(compressed.size < 65_536)
    assertEquals(response, readBoundedTerminalHttpBody(GZIPInputStream(ByteArrayInputStream(compressed))))
  }

  @Test
  fun `keeps response bounded and returns a specific failure above one mebibyte`() {
    val response = ByteArrayInputStream(ByteArray(MAX_TERMINAL_HTTP_RESPONSE_BYTES + 1) { 'x'.code.toByte() })
    val failure = try {
      readBoundedTerminalHttpBody(response)
      throw AssertionError("expected response size rejection")
    } catch (error: TerminalHttpResponseTooLargeException) {
      error
    }

    assertEquals("ANDROID_HTTP_RESPONSE_TOO_LARGE", terminalHttpFailureCode(failure))
  }
}
