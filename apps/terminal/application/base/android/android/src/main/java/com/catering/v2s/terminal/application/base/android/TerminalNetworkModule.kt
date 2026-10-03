package com.catering.v2s.terminal.application.base.android

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReadableMap
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetSocketAddress
import java.net.Proxy
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Authenticator
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/** Android's owner-injected HTTP/WebSocket adapter. Business protocol stays in terminal-data-client. */
class TerminalNetworkModule : Module() {
  private val sockets = ConcurrentHashMap<String, WebSocket>()
  private val socketClients = ConcurrentHashMap<String, OkHttpClient>()
  private val handler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("TerminalNetwork")
    Events(SOCKET_EVENT)

    AsyncFunction("request") Coroutine { url: String,
      method: String,
      headers: ReadableMap,
      bodyText: String?,
      timeoutMs: Double,
      proxy: ReadableMap? ->
      val client = client(timeoutMs.toLong(), proxy)
      val requestBody = bodyText?.toRequestBody(JSON_MEDIA_TYPE)
      val builder = Request.Builder().url(url)
      headers.keySetIterator().let { iterator ->
        while (iterator.hasNextKey()) {
          val key = iterator.nextKey()
          val value = headers.getString(key)
          if (value != null) builder.header(key, value)
        }
      }
      builder.method(method, requestBody)
      client.newCall(builder.build()).execute().use { response ->
        val body = readBoundedBody(response)
        mapOf(
          "status" to response.code,
          "bodyText" to body,
          "contentType" to (response.header("Content-Type") ?: ""),
          "requestId" to response.header("X-Request-Id"),
          "correlationId" to response.header("X-Correlation-Id"),
        )
      }
    }

    AsyncFunction("openSocket") Coroutine { socketId: String,
      url: String,
      headers: ReadableMap,
      timeoutMs: Double,
      proxy: ReadableMap? ->
      val client = client(timeoutMs.toLong(), proxy)
      val requestBuilder = Request.Builder().url(url)
      headers.keySetIterator().let { iterator ->
        while (iterator.hasNextKey()) {
          val key = iterator.nextKey()
          val value = headers.getString(key)
          if (value != null) requestBuilder.header(key, value)
        }
      }
      suspendCancellableCoroutine { continuation ->
        lateinit var socket: WebSocket
        val timeout = Runnable {
          if (continuation.isActive) {
            socket.cancel()
            continuation.resumeWithException(IllegalStateException("TERMINAL_WEBSOCKET_CONNECT_TIMEOUT"))
          }
        }
        handler.postDelayed(timeout, timeoutMs.toLong())
        socket = client.newWebSocket(requestBuilder.build(), object : WebSocketListener() {
          override fun onOpen(webSocket: WebSocket, response: Response) {
            sockets[socketId] = webSocket
            socketClients[socketId] = client
            handler.removeCallbacks(timeout)
            if (continuation.isActive) continuation.resume(Unit)
            else closeSocket(socketId, "stale connection")
          }

          override fun onMessage(webSocket: WebSocket, text: String) {
            sendEvent(SOCKET_EVENT, mapOf("socketId" to socketId, "type" to "message", "raw" to text))
          }

          override fun onMessage(webSocket: WebSocket, bytes: okio.ByteString) {
            sendEvent(SOCKET_EVENT, mapOf("socketId" to socketId, "type" to "error", "reason" to "NON_TEXT_FRAME"))
          }

          override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            sockets.remove(socketId, webSocket)
            socketClients.remove(socketId)
            sendEvent(SOCKET_EVENT, mapOf("socketId" to socketId, "type" to "close", "code" to code, "reason" to reason))
          }

          override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            sockets.remove(socketId, webSocket)
            socketClients.remove(socketId)
            handler.removeCallbacks(timeout)
            sendEvent(SOCKET_EVENT, mapOf("socketId" to socketId, "type" to "error", "reason" to "WEBSOCKET_FAILURE"))
            if (continuation.isActive) continuation.resumeWithException(IllegalStateException("TERMINAL_WEBSOCKET_CONNECT_FAILED"))
          }
        })
        continuation.invokeOnCancellation {
          handler.removeCallbacks(timeout)
          socket.cancel()
        }
      }
      true
    }

    AsyncFunction("sendSocket") { socketId: String, raw: String ->
      val socket = sockets[socketId] ?: throw IllegalStateException("TERMINAL_WEBSOCKET_NOT_OPEN")
      if (!socket.send(raw)) throw IllegalStateException("TERMINAL_WEBSOCKET_SEND_REJECTED")
      true
    }

    AsyncFunction("closeSocket") { socketId: String, reason: String ->
      closeSocket(socketId, reason)
      true
    }

    OnDestroy {
      sockets.values.forEach { it.cancel() }
      sockets.clear()
      socketClients.clear()
    }
  }

  private fun client(timeoutMs: Long, proxy: ReadableMap?): OkHttpClient {
    require(timeoutMs > 0) { "TERMINAL_NETWORK_TIMEOUT_INVALID" }
    val builder = OkHttpClient.Builder()
      .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .writeTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
    if (proxy != null) {
      val protocol = proxy.getString("protocol")
      require(protocol == "http") { "TERMINAL_NETWORK_PROXY_PROTOCOL_UNSUPPORTED" }
      val host = proxy.getString("host")?.takeIf { it.isNotBlank() } ?: error("TERMINAL_NETWORK_PROXY_INVALID")
      val port = proxy.getInt("port")
      require(port in 1..65535) { "TERMINAL_NETWORK_PROXY_INVALID" }
      val username = proxy.getString("username")
      val password = proxy.getString("password")
      builder.proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress(host, port)))
      if (!username.isNullOrEmpty() && password != null) {
        builder.proxyAuthenticator(Authenticator { _, response ->
          if (response.request.header("Proxy-Authorization") != null) return@Authenticator null
          response.request.newBuilder()
            .header("Proxy-Authorization", Credentials.basic(username, password))
            .build()
        })
      }
    }
    return builder.build()
  }

  private fun readBoundedBody(response: Response): String {
    val body = response.body ?: return ""
    val input = body.byteStream()
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    var total = 0
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      total += read
      if (total > MAX_RESPONSE_BYTES) throw IllegalStateException("TERMINAL_HTTP_RESPONSE_TOO_LARGE")
      output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
  }

  private fun closeSocket(socketId: String, reason: String) {
    val socket = sockets.remove(socketId) ?: return
    socketClients.remove(socketId)
    socket.close(1000, reason.take(100))
  }

  private companion object {
    const val SOCKET_EVENT = "onSocketEvent"
    const val MAX_RESPONSE_BYTES = 65_536
    val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
  }
}
