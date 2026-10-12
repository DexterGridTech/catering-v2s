package com.catering.v2s.terminal.adapter.android.remote

import java.nio.ByteBuffer

internal fun copyArgbToI420(
  argb: IntArray,
  width: Int,
  height: Int,
  yPlane: ByteBuffer,
  uPlane: ByteBuffer,
  vPlane: ByteBuffer,
  yStride: Int,
  uStride: Int,
  vStride: Int,
) {
  require(width > 0 && height > 0 && width % 2 == 0 && height % 2 == 0)
  require(argb.size == width * height)
  require(yStride >= width && uStride >= width / 2 && vStride >= width / 2)
  yPlane.clear()
  uPlane.clear()
  vPlane.clear()

  for (row in 0 until height) {
    val rowOffset = row * width
    val yOffset = row * yStride
    for (column in 0 until width) {
      val pixel = argb[rowOffset + column]
      val red = pixel shr 16 and 0xff
      val green = pixel shr 8 and 0xff
      val blue = pixel and 0xff
      yPlane.put(yOffset + column, clamp(((66 * red + 129 * green + 25 * blue + 128) shr 8) + 16).toByte())
    }
  }

  for (row in 0 until height step 2) {
    val chromaRowOffset = row / 2
    for (column in 0 until width step 2) {
      var redSum = 0
      var greenSum = 0
      var blueSum = 0
      for (dy in 0..1) for (dx in 0..1) {
        val pixel = argb[(row + dy) * width + column + dx]
        redSum += pixel shr 16 and 0xff
        greenSum += pixel shr 8 and 0xff
        blueSum += pixel and 0xff
      }
      val red = redSum / 4
      val green = greenSum / 4
      val blue = blueSum / 4
      val chromaColumn = column / 2
      uPlane.put(chromaRowOffset * uStride + chromaColumn,
        clamp(((-38 * red - 74 * green + 112 * blue + 128) shr 8) + 128).toByte())
      vPlane.put(chromaRowOffset * vStride + chromaColumn,
        clamp(((112 * red - 94 * green - 18 * blue + 128) shr 8) + 128).toByte())
    }
  }
}

private fun clamp(value: Int): Int = value.coerceIn(0, 255)
