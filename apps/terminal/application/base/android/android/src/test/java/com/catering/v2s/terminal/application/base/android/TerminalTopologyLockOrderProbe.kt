package com.catering.v2s.terminal.application.base.android

import java.io.DataInputStream
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Test-source-only child JVM used to prove the Registry/server lock order. */
object TerminalTopologyLockOrderProbe {
  @JvmStatic
  fun main(args: Array<String>) {
    val port = ServerSocket(0).use { it.localPort }
    val closePublisherEntered = CountDownLatch(1)
    val releaseClosePublisher = CountDownLatch(1)
    val closePublisherReturned = CountDownLatch(1)
    val closePeerReturned = CountDownLatch(1)
    TerminalTopologyHostRegistry.registerPublisher { event, payload ->
      if (event == "onTopologyConnection"
        && payload["event"] == "error"
        && payload["reason"] == "TOPOLOGY_ROLE_OCCUPIED") {
        error("lock-order probe must use the accepted peer close path")
      }
      if (event == "onTopologyConnection" && payload["event"] == "close") {
        closePublisherEntered.countDown()
        check(releaseClosePublisher.await(5, TimeUnit.SECONDS))
        TerminalTopologyHostRegistry.status()
        closePublisherReturned.countDown()
      }
    }
    val started = TerminalTopologyHostRegistry.start(
      port = port,
      basePath = "/terminal-topology",
      heartbeatIntervalMs = 100L,
      heartbeatTimeoutMs = 500L,
      nodeId = "a9-lock-probe",
      moduleName = "application.base.android",
      displayName = "A9 lock probe",
      instanceMode = "MASTER",
      displayRole = "CHIEF",
    )
    check(started["status"] == "succeeded")
    val peer = openWebSocket(port)
    val peerClose = Thread({ peer.shutdownOutput() }, "a9-peer-close").apply { isDaemon = true }
    peerClose.start()
    check(closePublisherEntered.await(2, TimeUnit.SECONDS)) { "production close publisher was not reached" }

    val closer = Thread({
      TerminalTopologyHostRegistry.closePeer()
      closePeerReturned.countDown()
    }, "a9-registry-close-peer").apply { isDaemon = true }
    closer.start()
    val closerCompletedBeforeRelease = closePeerReturned.await(250, TimeUnit.MILLISECONDS)
    releaseClosePublisher.countDown()
    val closerCompleted = closePeerReturned.await(250, TimeUnit.MILLISECONDS)
    val callbackCompleted = closePublisherReturned.await(250, TimeUnit.MILLISECONDS)
    if (!closerCompletedBeforeRelease && !closerCompleted && !callbackCompleted) {
      println("A9_LOCK_ORDER_DEADLOCK_CONFIRMED")
      System.exit(12)
    }

    check(closerCompleted) { "registry close path did not complete" }
    check(callbackCompleted) { "publisher status read did not complete" }
    peer.close()
    TerminalTopologyHostRegistry.stop()
    TerminalTopologyHostRegistry.clearPublisher()
    println("A9_LOCK_ORDER_COMPLETED")
  }

  private fun openWebSocket(port: Int): Socket {
    val socket = Socket("127.0.0.1", port)
    socket.soTimeout = 2_000
    socket.getOutputStream().apply {
      write(handshake(port))
      flush()
    }
    readHttpHeaders(DataInputStream(socket.getInputStream()))
    return socket
  }

  private fun handshake(port: Int): ByteArray = ("GET /terminal-topology/ws HTTP/1.1\r\n"
    + "Host: 127.0.0.1:$port\r\n"
    + "Upgrade: websocket\r\n"
    + "Connection: Upgrade\r\n"
    + "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
    + "Sec-WebSocket-Version: 13\r\n\r\n").toByteArray(StandardCharsets.US_ASCII)

  private fun readHttpHeaders(input: DataInputStream): String {
    val bytes = ArrayList<Byte>()
    while (bytes.size < 16 * 1024) {
      bytes.add(input.readByte())
      val size = bytes.size
      if (size >= 4 && bytes[size - 4] == '\r'.code.toByte() && bytes[size - 3] == '\n'.code.toByte()
        && bytes[size - 2] == '\r'.code.toByte() && bytes[size - 1] == '\n'.code.toByte()) {
        return bytes.toByteArray().toString(StandardCharsets.US_ASCII)
      }
    }
    error("websocket handshake headers exceeded limit")
  }

}
