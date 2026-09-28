package com.catering.v2s.terminal.adapter.android.persistkv

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PersistKvProcessInitializationTest {
  private fun productionPathUsesProcessInitializer(source: String): Boolean {
    val withStore = source.substringAfter("private fun withStore(").substringBefore("private fun openStore(")
    val openStore = source.substringAfter("private fun openStore(").substringBefore("private fun namespaceId(")
    return source.contains("withStore(persistenceKey, modeToken") &&
      withStore.contains("val opened = openStore(") &&
      openStore.contains("initializeMmkv { MMKV.initialize(context) }") &&
      Regex("MMKV\\.initialize\\(").findAll(source).count() == 1
  }

  @Test
  fun `module generations share one successful process initialization`() {
    var initializeCalls = 0
    val initialize = {
      initializeCalls += 1
      "/test/mmkv"
    }

    val firstModuleGeneration = TerminalPersistKvModule()
    val reloadedModuleGeneration = TerminalPersistKvModule()

    assertTrue(firstModuleGeneration.initializeMmkv(initialize))
    assertTrue(reloadedModuleGeneration.initializeMmkv(initialize))
    assertTrue(firstModuleGeneration.initializeMmkv(initialize))
    assertEquals(1, initializeCalls)
  }

  @Test
  fun `production storage path reaches the process initializer before opening MMKV`() {
    val source = File(
      System.getProperty("user.dir"),
      "src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt",
    ).readText()
    assertTrue("the production operation path must reach the process initializer", productionPathUsesProcessInitializer(source))

    val bypassMutation = source.replace(
      "initializeMmkv { MMKV.initialize(context) }",
      "MMKV.initialize(context)",
    )
    assertFalse("bypassing the process initializer must make the wiring oracle red", productionPathUsesProcessInitializer(bypassMutation))
  }

  @Test
  fun `failed initialization remains retryable without claiming completion`() {
    val processState = PersistKvProcessState()
    var initializeCalls = 0

    assertFalse(processState.initialize { initializeCalls += 1; "" })
    assertTrue(processState.initialize { initializeCalls += 1; "/test/mmkv" })
    assertTrue(processState.initialize { initializeCalls += 1; "/unexpected/reinitialize" })

    assertEquals(2, initializeCalls)
  }
}
