package com.catering.v2s.terminal.adapter.android.transport

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReadableMap
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.CancellationException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Authenticator
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

// Bound decoded HTTP rule pages by project-basic's 1 MiB page boundary; WebSocket has its own limit.
internal const val MAX_TERMINAL_HTTP_RESPONSE_BYTES = 1_048_576

internal class TerminalHttpResponseTooLargeException : IOException("TERMINAL_HTTP_RESPONSE_TOO_LARGE")

internal fun readBoundedTerminalHttpBody(input: InputStream): String {
  val output = ByteArrayOutputStream()
  val buffer = ByteArray(8192)
  var total = 0
  while (true) {
    val read = input.read(buffer)
    if (read < 0) break
    if (read > MAX_TERMINAL_HTTP_RESPONSE_BYTES - total) throw TerminalHttpResponseTooLargeException()
    output.write(buffer, 0, read)
    total += read
  }
  return output.toString(Charsets.UTF_8.name())
}

internal fun createTerminalHttpRequestBody(method: String, bodyText: String?): RequestBody? {
  if (bodyText != null) return bodyText.toRequestBody("application/json; charset=utf-8".toMediaType())
  return if (method.equals("POST", ignoreCase = true)) ByteArray(0).toRequestBody() else null
}

internal fun terminalHttpFailureCode(error: Exception): String = when (error) {
  is UnknownHostException -> "ANDROID_HTTP_DNS_FAILED"
  is ConnectException -> "ANDROID_HTTP_CONNECT_FAILED"
  is SocketTimeoutException -> "ANDROID_HTTP_TIMEOUT"
  is SSLException -> "ANDROID_HTTP_TLS_FAILED"
  is SocketException -> "ANDROID_HTTP_SOCKET_FAILED"
  is TerminalHttpResponseTooLargeException -> "ANDROID_HTTP_RESPONSE_TOO_LARGE"
  is IOException -> "ANDROID_HTTP_IO_FAILED"
  is IllegalArgumentException -> "ANDROID_HTTP_REQUEST_INVALID"
  is SecurityException -> "ANDROID_HTTP_SECURITY_DENIED"
  else -> "ANDROID_HTTP_NATIVE_REQUEST_FAILED"
}

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
      var failureCode: String? = null
      val response = try {
        val client = client(timeoutMs.toLong(), proxy)
        val requestBody = createTerminalHttpRequestBody(method, bodyText)
        val builder = Request.Builder().url(url)
        headers.keySetIterator().let { iterator ->
          while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val value = headers.getString(key)
            if (value != null) builder.header(key, value)
          }
        }
        builder.method(method, requestBody)
        client.newCall(builder.build()).execute()
      } catch (error: CancellationException) {
        throw error
      } catch (error: Exception) {
        failureCode = terminalHttpFailureCode(error)
        null
      }
      if (response == null) {
        mapOf("kind" to "failure", "code" to (failureCode ?: "ANDROID_HTTP_NATIVE_REQUEST_FAILED"))
      } else {
        try {
          response.use {
            val body = readBoundedBody(response)
            mapOf(
              "kind" to "response",
              "status" to response.code,
              "bodyText" to body,
              "contentType" to (response.header("Content-Type") ?: ""),
              "requestId" to response.header("X-Request-Id"),
              "correlationId" to response.header("X-Correlation-Id"),
            )
          }
        } catch (error: IOException) {
          mapOf(
            "kind" to "failure",
            "code" to terminalHttpFailureCode(error),
          )
        }
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
    return readBoundedTerminalHttpBody(body.byteStream())
  }

  private fun closeSocket(socketId: String, reason: String) {
    val socket = sockets.remove(socketId) ?: return
    socketClients.remove(socketId)
    socket.close(1000, reason.take(100))
  }

  private companion object {
    const val SOCKET_EVENT = "onSocketEvent"
  }
}
