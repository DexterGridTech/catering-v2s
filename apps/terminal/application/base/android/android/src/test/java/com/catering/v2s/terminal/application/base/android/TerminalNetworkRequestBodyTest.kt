package com.catering.v2s.terminal.application.base.android

import okhttp3.Request
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

class TerminalNetworkRequestBodyTest {
  @Test
  fun `bodyless post builds a zero byte request body`() {
    val body = createTerminalHttpRequestBody("POST", null)
    val request = Request.Builder()
      .url("https://example.test/update-artifacts/artifact-1/download-grant")
      .method("POST", body)
      .build()

    assertNotNull(request.body)
    assertEquals(0L, request.body!!.contentLength())
    assertNull(request.body!!.contentType())
  }

  @Test
  fun `bodyless get remains bodyless`() {
    val body = createTerminalHttpRequestBody("GET", null)
    val request = Request.Builder()
      .url("https://example.test/stores/store-1/basic")
      .method("GET", body)
      .build()

    assertNull(request.body)
  }

  @Test
  fun `json request body preserves json content type`() {
    val json = "{\"deviceId\":\"device-1\"}"
    val body = createTerminalHttpRequestBody("POST", json)
    val request = Request.Builder()
      .url("https://example.test/activation")
      .method("POST", body)
      .build()

    assertEquals("application/json; charset=utf-8", request.body!!.contentType().toString())
    assertEquals(json.toByteArray(Charsets.UTF_8).size.toLong(), request.body!!.contentLength())
  }
}
