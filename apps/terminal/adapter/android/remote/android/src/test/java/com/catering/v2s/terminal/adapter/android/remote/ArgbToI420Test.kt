package com.catering.v2s.terminal.adapter.android.remote

import org.junit.Assert.assertEquals
import org.junit.Test
import java.nio.ByteBuffer

class ArgbToI420Test {
  @Test
  fun convertsBlackAndWhiteToLimitedRangeLumaAndNeutralChroma() {
    val y = ByteBuffer.allocate(8)
    val u = ByteBuffer.allocate(2)
    val v = ByteBuffer.allocate(2)
    copyArgbToI420(
      argb = intArrayOf(0xff000000.toInt(), 0xffffffff.toInt(), 0xffffffff.toInt(), 0xff000000.toInt()),
      width = 2,
      height = 2,
      yPlane = y,
      uPlane = u,
      vPlane = v,
      yStride = 2,
      uStride = 1,
      vStride = 1,
    )

    assertEquals(16, y.get(0).toInt() and 0xff)
    assertEquals(235, y.get(1).toInt() and 0xff)
    assertEquals(235, y.get(2).toInt() and 0xff)
    assertEquals(16, y.get(3).toInt() and 0xff)
    assertEquals(128, u.get(0).toInt() and 0xff)
    assertEquals(128, v.get(0).toInt() and 0xff)
  }

  @Test
  fun averagesChromaForEachTwoByTwoPixelBlock() {
    val y = ByteBuffer.allocate(4)
    val u = ByteBuffer.allocate(1)
    val v = ByteBuffer.allocate(1)
    copyArgbToI420(
      argb = IntArray(4) { 0xffff0000.toInt() },
      width = 2,
      height = 2,
      yPlane = y,
      uPlane = u,
      vPlane = v,
      yStride = 2,
      uStride = 1,
      vStride = 1,
    )

    assertEquals(82, y.get(0).toInt() and 0xff)
    assertEquals(90, u.get(0).toInt() and 0xff)
    assertEquals(240, v.get(0).toInt() and 0xff)
  }
}
