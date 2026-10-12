package com.catering.v2s.terminal.adapter.android.remote

import org.junit.Assert.assertEquals
import org.junit.Test

class CaptureSizeTest {
  @Test
  fun keepsNormalWindowSizeAndBoundsLargeFramesToEvenEdges() {
    assertEquals(960 to 540, captureSize(960, 540))
    assertEquals(1280 to 720, captureSize(1920, 1080))
    assertEquals(1280 to 720, captureSize(1921, 1081))
  }

  @Test(expected = IllegalArgumentException::class)
  fun rejectsAnUnavailableWindowSize() {
    captureSize(0, 720)
  }
}
