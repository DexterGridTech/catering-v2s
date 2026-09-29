package com.catering.v2s.terminal.application.base.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class NativeLoadingGateIndexTest {
  private data class EqualOwner(val label: String)
  private data class Gate(val token: String)

  @Test
  fun `destroying one owner removes only its gate and token lookup`() {
    val index = NativeLoadingGateIndex<EqualOwner, Gate> { it.token }
    val firstOwner = EqualOwner("same")
    val secondOwner = EqualOwner("same")
    val firstGate = Gate("activity-1")
    val secondGate = Gate("activity-2")

    index.put(firstOwner, firstGate)
    index.put(secondOwner, secondGate)

    assertSame(firstGate, index.remove(firstOwner))
    assertNull(index.forOwner(firstOwner))
    assertNull(index.forToken(firstGate.token))
    assertSame(secondGate, index.forOwner(secondOwner))
    assertSame(secondGate, index.forToken(secondGate.token))
    assertNull(index.remove(EqualOwner("absent")))
  }
}
