package com.catering.v2s.terminal.adapter.android.device

import android.view.Display
import org.junit.Assert.assertEquals
import org.junit.Test

class TerminalDeviceDisplaySelectionTest {
  @Test
  fun `display facts retain primary and presentation displays but exclude unrelated secondary displays`() {
    val selected = orderReportedDisplays(
      listOf(
        TerminalDisplayCandidate(displayId = 4, flags = Display.FLAG_PRIVATE),
        TerminalDisplayCandidate(displayId = Display.DEFAULT_DISPLAY, flags = 0),
        TerminalDisplayCandidate(displayId = 5, flags = 0),
        TerminalDisplayCandidate(displayId = 7, flags = Display.FLAG_PRESENTATION),
      ),
    )

    assertEquals(
      listOf(
        TerminalDisplayCandidate(displayId = Display.DEFAULT_DISPLAY, flags = 0),
        TerminalDisplayCandidate(displayId = 7, flags = Display.FLAG_PRESENTATION),
      ),
      selected,
    )
  }
}
