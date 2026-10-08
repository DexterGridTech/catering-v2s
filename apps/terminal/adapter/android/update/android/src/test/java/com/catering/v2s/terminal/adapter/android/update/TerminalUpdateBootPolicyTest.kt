package com.catering.v2s.terminal.adapter.android.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalUpdateBootPolicyTest {
  @Test
  fun `actual bundle version follows selected entry and unknown selections stay unknown`() {
    assertEquals("1.0.0", selectedBundleVersionForFacts("embedded", "1.0.1", "1.0.0"))
    assertEquals("1.0.1", selectedBundleVersionForFacts("hot", "1.0.1", "1.0.0"))
    assertEquals("1.0.1", selectedBundleVersionForFacts("file-recovery", "1.0.1", "1.0.0"))
    assertNull(selectedBundleVersionForFacts("hot", null, "1.0.0"))
    assertNull(selectedBundleVersionForFacts("failed", "1.0.1", "1.0.0"))
    assertNull(selectedBundleVersionForFacts("unknown", "1.0.1", "1.0.0"))
  }

  @Test
  fun `unconfirmed selected hot candidate is eligible for one rollback`() {
    assertTrue(isUnconfirmedHotCandidate("hot", false, "candidate", "candidate"))
    assertFalse(isUnconfirmedHotCandidate("hot", true, "candidate", "candidate"))
    assertFalse(isUnconfirmedHotCandidate("hot", false, "candidate", "previous"))
    assertFalse(isUnconfirmedHotCandidate("embedded", false, "candidate", "candidate"))
    assertFalse(isUnconfirmedHotCandidate("hot", false, "", ""))
  }

  @Test
  fun `an unconfirmed recovery boot expires instead of selecting the same package again`() {
    assertTrue(isUnconfirmedRecoveryBoot(recoveryBootPending = true, bootConfirmed = false))
    assertFalse(isUnconfirmedRecoveryBoot(recoveryBootPending = false, bootConfirmed = false))
    assertFalse(isUnconfirmedRecoveryBoot(recoveryBootPending = true, bootConfirmed = true))
    // Confirmation clears the pending flag before the next ordinary process start.
    assertFalse(isUnconfirmedRecoveryBoot(recoveryBootPending = false, bootConfirmed = false))
  }
}
