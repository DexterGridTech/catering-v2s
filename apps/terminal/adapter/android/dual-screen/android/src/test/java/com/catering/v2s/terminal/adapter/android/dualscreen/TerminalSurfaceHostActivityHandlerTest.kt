package com.catering.v2s.terminal.adapter.android.dualscreen

import android.content.pm.ActivityInfo
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalSurfaceHostActivityHandlerTest {
  @Test
  fun `only default physical display is the primary Activity surface`() {
    assertTrue(isPrimaryActivitySurface(surfaceIndex = 0, displayId = 0))
    assertFalse(isPrimaryActivitySurface(surfaceIndex = 0, displayId = 2))
    assertFalse(isPrimaryActivitySurface(surfaceIndex = 1, displayId = 0))
    assertFalse(isPrimaryActivitySurface(surfaceIndex = 0, displayId = null))
  }

  private val stableSnapshot = TerminalSurfaceHostSnapshot(
    surfaceKey = "PRIMARY",
    generation = 1,
    displayId = 0,
    isHostPrimaryDisplay = true,
    windowIdentity = "primary",
    orientation = "landscape",
    stableWidthLogical = 1280.0,
    stableHeightLogical = 800.0,
    currentWidthLogical = 1280.0,
    currentHeightLogical = 800.0,
    stableWidthPx = 2560,
    stableHeightPx = 1600,
    currentWidthPx = 2560,
    currentHeightPx = 1600,
    hardwareDensityDpi = 320,
    hardwareDensity = 2.0f,
    hardwareScaledDensity = 2.0f,
    surfaceDensityDpi = 320,
    surfaceDensity = 2.0f,
  )

  private data class ReuseTruthTableRow(
    val previousSnapshot: TerminalSurfaceHostSnapshot?,
    val sameOwner: Boolean,
    val orientation: String,
    val widthPx: Int,
    val heightPx: Int,
    val hardwareDensityDpi: Int,
    val hardwareDensity: Float,
    val surfaceDensityDpi: Int,
    val surfaceDensity: Float,
    val imeVisibleBeforeRetirement: Boolean,
  )

  private fun preRetirementReuse(row: ReuseTruthTableRow): Boolean {
    val previous = row.previousSnapshot ?: return false
    if (!row.sameOwner) return false
    if (previous.orientation != row.orientation) return false
    if (previous.hardwareDensityDpi != row.hardwareDensityDpi || previous.hardwareDensity != row.hardwareDensity) return false
    if (previous.surfaceDensityDpi != row.surfaceDensityDpi || previous.surfaceDensity != row.surfaceDensity) return false
    return row.imeVisibleBeforeRetirement ||
      (previous.stableWidthPx == row.widthPx && previous.stableHeightPx == row.heightPx)
  }

  private fun postRetirementReuse(row: ReuseTruthTableRow): Boolean = shouldReuseStableHostContext(
    previousSnapshot = row.previousSnapshot,
    sameOwner = row.sameOwner,
    orientation = row.orientation,
    widthPx = row.widthPx,
    heightPx = row.heightPx,
    hardwareDensityDpi = row.hardwareDensityDpi,
    hardwareDensity = row.hardwareDensity,
    surfaceDensityDpi = row.surfaceDensityDpi,
    surfaceDensity = row.surfaceDensity,
  )

  @Test
  fun `classifies calibrated device widths without using current orientation`() {
    assertEquals("mobile", classifySurfaceForm(360).surfaceForm)
    assertEquals("mobile", classifySurfaceForm(580).surfaceForm)
    assertEquals("laptop", classifySurfaceForm(581).surfaceForm)
    assertEquals("laptop", classifySurfaceForm(800).surfaceForm)
    assertEquals("mobile", classifySurfaceForm(360, laptopThresholdDp = 581).surfaceForm)
  }

  @Test
  fun `falls back to laptop with diagnostic for unavailable device width`() {
    listOf(null, 0, -1).forEach { smallestWidthDp ->
      val decision = classifySurfaceForm(smallestWidthDp)
      assertEquals("laptop", decision.surfaceForm)
      assertEquals("smallest-screen-width-unavailable", decision.diagnostic)
    }
  }

  @Test
  fun `selects primary-only and secondary display snapshots from display ids`() {
    assertEquals(
      DisplaySnapshotReadResult.Ready(displayCount = 1, secondaryDisplayIndex = null),
      readDisplaySnapshotSelection { listOf(0) },
    )
    assertEquals(
      DisplaySnapshotReadResult.Ready(displayCount = 2, secondaryDisplayIndex = 1),
      readDisplaySnapshotSelection { listOf(0, 2) },
    )
  }

  @Test
  fun `reports unavailable manager and failed display snapshot distinctly`() {
    assertEquals(
      DisplaySnapshotReadResult.Unavailable("display-manager-unavailable"),
      readDisplaySnapshotSelection { null },
    )
    assertEquals(
      DisplaySnapshotReadResult.Unavailable("display-snapshot-failed"),
      readDisplaySnapshotSelection { error("display read failed") },
    )
  }

  @Test
  fun `keeps the already selected form when a later configuration value changes`() {
    val frozen = classifySurfaceForm(360)
    val laterConfiguration = classifySurfaceForm(800)
    val options = createSurfaceLaunchOptions(0, 1, frozen.surfaceForm)

    assertEquals("mobile", frozen.surfaceForm)
    assertEquals("laptop", laterConfiguration.surfaceForm)
    assertEquals("mobile", options.surfaceForm)
  }

  @Test
  fun `maps the frozen form to the matching requested orientation`() {
    assertEquals(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, requestedOrientationForSurfaceForm("mobile"))
    assertEquals(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE, requestedOrientationForSurfaceForm("laptop"))
  }

  @Test
  fun `propagates one frozen form to primary and secondary launch options`() {
    val decision = classifySurfaceForm(360)
    val primary = createSurfaceLaunchOptions(0, 2, decision.surfaceForm)
    val secondary = createSurfaceLaunchOptions(1, 2, decision.surfaceForm)

    assertEquals(0, primary.displayIndex)
    assertEquals(1, secondary.displayIndex)
    assertEquals(2, primary.displayCount)
    assertEquals(2, secondary.displayCount)
    assertEquals("mobile", primary.surfaceForm)
    assertEquals("mobile", secondary.surfaceForm)

    val laterConfiguration = classifySurfaceForm(800)
    assertEquals("laptop", laterConfiguration.surfaceForm)
    assertEquals("mobile", primary.surfaceForm)
    assertEquals("mobile", secondary.surfaceForm)
  }

  @Test
  fun `accepts a shared render density independent of hardware density`() {
    assertTrue(areSurfaceDensitiesUsable(320, 2.0f, 320, 2.0f))
    assertTrue(areSurfaceDensitiesUsable(213, 1.33125f, 320, 2.0f))
    assertTrue(areSurfaceDensitiesUsable(440, 2.75f, 320, 2.0f))
    assertFalse(areSurfaceDensitiesUsable(213, 0f, 320, 2.0f))
    assertFalse(areSurfaceDensitiesUsable(213, 1.33125f, 0, 2.0f))
  }

  @Test
  fun `reuses stable bounds for unchanged owner and unchanged host size`() {
    assertTrue(
      shouldReuseStableHostContext(
        previousSnapshot = stableSnapshot,
        sameOwner = true,
        orientation = "landscape",
        widthPx = 2560,
        heightPx = 1600,
        hardwareDensityDpi = 320,
        hardwareDensity = 2.0f,
        surfaceDensityDpi = 320,
        surfaceDensity = 2.0f,
      ),
    )
  }

  @Test
  fun `does not reuse stable bounds after orientation or density changes`() {
    assertFalse(
      shouldReuseStableHostContext(
        previousSnapshot = stableSnapshot,
        sameOwner = true,
        orientation = "portrait",
        widthPx = 1600,
        heightPx = 2560,
        hardwareDensityDpi = 320,
        hardwareDensity = 2.0f,
        surfaceDensityDpi = 320,
        surfaceDensity = 2.0f,
      ),
    )
    assertFalse(
      shouldReuseStableHostContext(
        previousSnapshot = stableSnapshot,
        sameOwner = true,
        orientation = "landscape",
        widthPx = 2560,
        heightPx = 1600,
        hardwareDensityDpi = 213,
        hardwareDensity = 1.33125f,
        surfaceDensityDpi = 213,
        surfaceDensity = 1.33125f,
      ),
    )
  }

  @Test
  fun `does not reuse stable bounds after a host resize`() {
    assertFalse(
      shouldReuseStableHostContext(
        previousSnapshot = stableSnapshot,
        sameOwner = true,
        orientation = "landscape",
        widthPx = 1920,
        heightPx = 1200,
        hardwareDensityDpi = 320,
        hardwareDensity = 2.0f,
        surfaceDensityDpi = 320,
        surfaceDensity = 2.0f,
      ),
    )
  }

  @Test
  fun `retired predicate matches every reachable pre-retirement false row`() {
    val rows = listOf(
      ReuseTruthTableRow(null, true, "landscape", 2560, 1600, 320, 2.0f, 320, 2.0f, false),
      ReuseTruthTableRow(stableSnapshot, false, "landscape", 2560, 1600, 320, 2.0f, 320, 2.0f, false),
      ReuseTruthTableRow(stableSnapshot, true, "portrait", 1600, 2560, 320, 2.0f, 320, 2.0f, false),
      ReuseTruthTableRow(stableSnapshot, true, "landscape", 2560, 1600, 213, 1.33125f, 320, 2.0f, false),
      ReuseTruthTableRow(stableSnapshot, true, "landscape", 2560, 1600, 320, 2.0f, 213, 1.33125f, false),
      ReuseTruthTableRow(stableSnapshot, true, "landscape", 2560, 1600, 320, 2.0f, 320, 2.0f, false),
      ReuseTruthTableRow(stableSnapshot, true, "landscape", 1920, 1200, 320, 2.0f, 320, 2.0f, false),
      ReuseTruthTableRow(stableSnapshot, true, "landscape", 1920, 1200, 320, 2.0f, 320, 2.0f, true),
      ReuseTruthTableRow(stableSnapshot, true, "landscape", 2560, 1600, 320, 2.0f, 320, 2.0f, true),
    )
    val reachableRows = rows.filterNot { it.imeVisibleBeforeRetirement }
    assertEquals(
      reachableRows.map(::preRetirementReuse),
      reachableRows.map(::postRetirementReuse),
    )
    assertTrue(rows.any { it.imeVisibleBeforeRetirement && preRetirementReuse(it) })
  }

  @Test
  fun `invalid owner layout keeps matching entry and publishes a recoverable next generation`() {
    val result = resolveSurfaceHostRemoval(
      currentSnapshot = stableSnapshot,
      ownerMatches = true,
      nextGeneration = 2,
      reason = "invalid-owner-layout",
    )

    assertFalse(result.shouldClear)
    assertEquals(stableSnapshot, result.snapshotToKeep)
    val event = result.recoverable
    assertTrue(event != null)
    assertEquals("PRIMARY", event?.surfaceKey)
    assertEquals(2L, event?.generation)
    assertEquals(0, event?.displayId)
    assertEquals("primary", event?.windowIdentity)
    assertEquals("invalid-owner-layout", event?.reason)
  }

  @Test
  fun `invalid owner layout without an old entry does not publish an event`() {
    val result = resolveSurfaceHostRemoval(
      currentSnapshot = null,
      ownerMatches = false,
      nextGeneration = 1,
      reason = "invalid-owner-layout",
    )

    assertFalse(result.shouldClear)
    assertNull(result.snapshotToKeep)
    assertNull(result.recoverable)
  }

  @Test
  fun `invalid layout from a different owner keeps the existing entry`() {
    val result = resolveSurfaceHostRemoval(
      currentSnapshot = stableSnapshot,
      ownerMatches = false,
      nextGeneration = 2,
      reason = "invalid-owner-layout",
    )

    assertFalse(result.shouldClear)
    assertEquals(stableSnapshot, result.snapshotToKeep)
    assertNull(result.recoverable)
  }

  @Test
  fun `invalidating one surface does not alter the other surface entry`() {
    val secondarySnapshot = stableSnapshot.copy(
      surfaceKey = "SECONDARY",
      displayId = 2,
      windowIdentity = "secondary",
      stableWidthLogical = 640.0,
      stableHeightLogical = 360.0,
      currentWidthLogical = 640.0,
      currentHeightLogical = 360.0,
      stableWidthPx = 1280,
      stableHeightPx = 720,
      currentWidthPx = 1280,
      currentHeightPx = 720,
      hardwareDensityDpi = 213,
      hardwareDensity = 1.33125f,
      hardwareScaledDensity = 1.33125f,
      surfaceDensityDpi = 320,
      surfaceDensity = 2.0f,
    )
    val entries = mutableMapOf(0 to stableSnapshot, 1 to secondarySnapshot)
    val primaryRemoval = resolveSurfaceHostRemoval(
      currentSnapshot = entries[0],
      ownerMatches = true,
      nextGeneration = 2,
      reason = "invalid-owner-layout",
    )

    if (primaryRemoval.shouldClear) entries.remove(0)

    assertEquals(stableSnapshot, entries[0])
    assertEquals(secondarySnapshot, entries[1])
  }
}
