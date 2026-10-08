package com.catering.v2s.terminal.adapter.android.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalUpdateInstallerPolicyTest {
  @Test
  fun `busy installer remains unknown until all sessions end and installed identity is readable`() {
    assertNull(busyInstallerExit(null, null))

    val installed = busyInstallerExit(true, false)
    assertEquals("succeeded", installed?.state)
    assertNull(installed?.reason)
    assertEquals("none", installed?.installerState)

    val endedWithoutInstall = busyInstallerExit(false, true)
    assertEquals("user-cancelled", endedWithoutInstall?.state)
    assertEquals("ENDED_NOT_INSTALLED", endedWithoutInstall?.reason)
    assertEquals("ended", endedWithoutInstall?.installerState)
    assertNull(busyInstallerExit(false, false))
    assertNull(busyInstallerExit(false, null))
  }

  @Test
  fun `late installer callback only matches the exact current full action`() {
    assertTrue(currentInstallerCallback())
    assertFalse(currentInstallerCallback(callbackSessionId = 8))
    assertFalse(currentInstallerCallback(callbackApkSha256 = "b".repeat(64)))
    assertFalse(currentInstallerCallback(callbackPublicationId = "publication-old"))
    assertFalse(currentInstallerCallback(callbackBuildNumber = 8))
    assertFalse(currentInstallerCallback(callbackApplicationId = "com.other.app"))
    assertFalse(currentInstallerCallback(callbackSessionId = -1))
    assertFalse(currentInstallerCallback(currentKind = "hot"))
    assertFalse(currentInstallerCallback(callbackTaskId = "task-old"))
    assertFalse(currentInstallerCallback(callbackActionId = "action-old"))
  }

  @Test
  fun `confirmation resumes only for the matching committed sealed session`() {
    assertTrue(isResumableInstallerSession("com.example.app", "com.example.app", committed = true, sealed = true))
    assertFalse(isResumableInstallerSession("com.other.app", "com.example.app", committed = true, sealed = true))
    assertFalse(isResumableInstallerSession("com.example.app", "com.example.app", committed = false, sealed = true))
    assertFalse(isResumableInstallerSession("com.example.app", "com.example.app", committed = true, sealed = false))
    assertFalse(isResumableInstallerSession(null, "com.example.app", committed = true, sealed = true))
  }

  @Test
  fun `confirmation intent must resolve and carry the committed session identity`() {
    assertTrue(isMatchingInstallerConfirmation(7, 7, hasResolvedActivity = true))
    assertFalse(isMatchingInstallerConfirmation(7, 8, hasResolvedActivity = true))
    assertFalse(isMatchingInstallerConfirmation(7, -1, hasResolvedActivity = true))
    assertFalse(isMatchingInstallerConfirmation(7, 7, hasResolvedActivity = false))
    assertFalse(isMatchingInstallerConfirmation(-1, -1, hasResolvedActivity = true))
  }

  private fun currentInstallerCallback(
    currentKind: String = "full",
    callbackTaskId: String = "task-1",
    callbackActionId: String = "action-1",
    callbackSessionId: Int = 7,
    callbackApplicationId: String? = "com.example.app",
    callbackBuildNumber: Long = 42,
    callbackPublicationId: String? = "publication-1",
    callbackApkSha256: String? = "a".repeat(64),
  ): Boolean = isCurrentFullInstallerCallback(
    currentTaskId = "task-1",
    currentActionId = "action-1",
    currentKind = currentKind,
    currentSessionId = 7,
    currentApplicationId = "com.example.app",
    currentNativeBuildNumber = 42,
    currentPublicationId = "publication-1",
    currentApkSha256 = "a".repeat(64),
    callbackTaskId = callbackTaskId,
    callbackActionId = callbackActionId,
    callbackSessionId = callbackSessionId,
    callbackApplicationId = callbackApplicationId,
    callbackNativeBuildNumber = callbackBuildNumber,
    callbackPublicationId = callbackPublicationId,
    callbackApkSha256 = callbackApkSha256,
  )
}
