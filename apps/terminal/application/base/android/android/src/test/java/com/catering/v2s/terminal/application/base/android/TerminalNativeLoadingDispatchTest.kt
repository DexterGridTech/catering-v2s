package com.catering.v2s.terminal.application.base.android

import expo.modules.kotlin.exception.CodedException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.coroutines.CoroutineContext
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class TerminalNativeLoadingDispatchTest {
  @Test
  fun `queued main work times out with a typed sanitized diagnostic`() {
    val executor = Executors.newSingleThreadScheduledExecutor()
    try {
      runBlocking {
        var blockRan = false
        var diagnostic: List<Any>? = null
        val delayedDispatcher = object : CoroutineDispatcher() {
          override fun dispatch(context: CoroutineContext, block: Runnable) {
            executor.schedule(block, 50, TimeUnit.MILLISECONDS)
          }
        }

        val failure = runCatching {
          runNativeLoadingOnMainThread(
            operation = "beginHide",
            timeoutMs = 10,
            dispatcher = delayedDispatcher,
            onTimeout = { operation, code, timeout, elapsed ->
              diagnostic = listOf(operation, code, timeout, elapsed)
            },
          ) {
            blockRan = true
            "unreachable"
          }
        }.exceptionOrNull()

        assertFalse(blockRan)
        assertTrue(failure is CodedException)
        assertEquals(TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT, (failure as CodedException).code)
        assertEquals("beginHide", diagnostic?.get(0))
        assertEquals(TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT, diagnostic?.get(1))
        assertEquals(10L, diagnostic?.get(2))
        assertTrue((diagnostic?.get(3) as Long) >= 0L)
      }
    } finally {
      executor.shutdownNow()
    }
  }
}
