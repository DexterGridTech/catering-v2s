import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import zlib from 'node:zlib'

import {comparePngBuffers, comparePngFiles} from '../compare.mjs'

const crc32 = buffer => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const result = Buffer.alloc(4)
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return result
}

const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, typeBuffer, data, crc32(Buffer.concat([typeBuffer, data]))])
}

const createRgbPng = (width, height, pixels, filterType = 0) => {
  const rowBytes = width * 3
  const scanlines = Buffer.alloc(height * (rowBytes + 1))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowBytes + 1)
    scanlines[rowStart] = filterType
    pixels.copy(scanlines, rowStart + 1, y * rowBytes, (y + 1) * rowBytes)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const createCellPattern = (changedPixelsPerCell, value) => {
  const pixels = Buffer.alloc(16 * 16 * 3)
  for (let cell = 0; cell < 64; cell += 1) {
    const cellX = (cell % 8) * 2
    const cellY = Math.floor(cell / 8) * 2
    for (let offset = 0; offset < changedPixelsPerCell; offset += 1) {
      const x = cellX + (offset % 2)
      const y = cellY + Math.floor(offset / 2)
      pixels.fill(value, (y * 16 + x) * 3, (y * 16 + x + 1) * 3)
    }
  }
  return pixels
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', '..')
const toolPath = path.join(repositoryRoot, 'tools/terminal-image-compare/compare.mjs')
const backgroundPath = path.join(repositoryRoot, 'apps/terminal/application/android/sample-terminal/assets/android-icon-background.png')
const foregroundPath = path.join(repositoryRoot, 'apps/terminal/application/android/sample-terminal/assets/android-icon-foreground.png')
const differentSizePath = path.join(repositoryRoot, 'apps/terminal/application/android/sample-terminal/assets/favicon.png')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-image-compare-'))
const metadataPath = path.join(tempRoot, 'metadata.json')
const metadata = {
  canvasRect: {x: 0, y: 0, width: 512, height: 512},
  roiRect: {x: 0, y: 0, width: 512, height: 512},
  maskRects: [{x: 0, y: 0, width: 16, height: 16}],
  minUnmaskedFraction: 0.25,
}
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`)

try {
  const unchanged = comparePngFiles(backgroundPath, backgroundPath, metadataPath)
  assert.equal(unchanged.changedFraction, 0)
  assert.equal(unchanged.P95, 0)
  assert.equal(unchanged.meanAbsDiff, 0)
  assert.equal(unchanged.changedCellFraction, 0)
  assert.equal(unchanged.participatingCellCount, 64)

  const changed = comparePngFiles(backgroundPath, foregroundPath, metadataPath)
  assert.ok(changed.changedFraction > 0, 'known changed PNG pair must report changed pixels')
  assert.ok(changed.P95 > 0)
  assert.ok(changed.meanAbsDiff > 0)
  assert.ok(changed.changedCellFraction > 0)
  assert.deepEqual(changed.grid.rect, metadata.canvasRect)

  const mismatchedMetadata = path.join(tempRoot, 'mismatch.json')
  fs.writeFileSync(mismatchedMetadata, `${JSON.stringify({
    ...metadata,
    canvasRect: {x: 0, y: 0, width: 48, height: 48},
    roiRect: {x: 0, y: 0, width: 48, height: 48},
  })}\n`)
  assert.throws(() => comparePngFiles(backgroundPath, differentSizePath, mismatchedMetadata), /dimensions must match/)

  const mutationPath = path.join(tempRoot, 'compare-mutated.mjs')
  const original = fs.readFileSync(toolPath, 'utf8')
  const mutation = original.replace('const PIXEL_CHANGE_THRESHOLD = 4', 'const PIXEL_CHANGE_THRESHOLD = 255')
  assert.notEqual(mutation, original, 'threshold mutation anchor must exist exactly')
  fs.writeFileSync(mutationPath, mutation)
  const mutationResult = spawnSync(process.execPath, [mutationPath, backgroundPath, foregroundPath, metadataPath], {
    encoding: 'utf8',
    env: {...process.env, FORCE_COLOR: '0'},
  })
  assert.equal(mutationResult.status, 0, mutationResult.stderr)
  const mutatedMetrics = JSON.parse(mutationResult.stdout)
  assert.equal(mutatedMetrics.changedFraction, 0, 'threshold mutation must change the measured result')
  assert.equal(mutatedMetrics.changedCellFraction, 0, 'threshold mutation must change the cell result')
  const meetsConfirmedWallpaperThresholds = metrics => metrics.changedFraction >= 0.2
    && metrics.P95 >= 8
    && metrics.meanAbsDiff >= 4
    && metrics.changedCellFraction >= 0.75
  assert.equal(meetsConfirmedWallpaperThresholds(changed), true, 'known changed pair must meet the confirmed threshold oracle')
  assert.equal(meetsConfirmedWallpaperThresholds(mutatedMetrics), false, 'threshold mutation must fail the confirmed threshold oracle')

  const smallMetadata = {
    canvasRect: {x: 0, y: 0, width: 16, height: 16},
    roiRect: {x: 0, y: 0, width: 16, height: 16},
    maskRects: [],
    minUnmaskedFraction: 0.25,
  }
  const unchangedPixels = Buffer.alloc(16 * 16 * 3)
  const sparseLargeDelta = createCellPattern(1, 255)
  const denseSmallDelta = createCellPattern(3, 5)
  const sparseMetrics = comparePngBuffers(
    createRgbPng(16, 16, unchangedPixels),
    createRgbPng(16, 16, sparseLargeDelta),
    smallMetadata,
  )
  assert.equal(sparseMetrics.changedCellFraction, 1, 'cell average must catch sparse large deltas')
  const denseMetrics = comparePngBuffers(
    createRgbPng(16, 16, unchangedPixels),
    createRgbPng(16, 16, denseSmallDelta),
    smallMetadata,
  )
  assert.equal(denseMetrics.changedCellFraction, 0, 'cell average must reject dense sub-threshold deltas')

  assert.throws(() => comparePngBuffers(
    createRgbPng(16, 16, unchangedPixels),
    createRgbPng(16, 16, unchangedPixels),
    {...smallMetadata, roiRect: {x: 0, y: 0, width: 1, height: 16}},
  ), /roiRect must cover at least 20%/)
  assert.throws(() => comparePngBuffers(
    createRgbPng(16, 16, unchangedPixels),
    createRgbPng(16, 16, unchangedPixels),
    {...smallMetadata, maskRects: [{x: 0, y: 0, width: 13, height: 16}]},
  ), /mask must cover at most 80%/)
  assert.throws(() => comparePngBuffers(
    createRgbPng(16, 16, unchangedPixels),
    createRgbPng(16, 16, unchangedPixels),
    {...smallMetadata, minUnmaskedFraction: 0.2},
  ), /minUnmaskedFraction must be exactly 0.25/)

  const tinyPng = createRgbPng(1, 1, Buffer.alloc(3))
  assert.throws(() => comparePngBuffers(Buffer.from([0]), tinyPng, smallMetadata), /unsupported PNG signature/)
  assert.throws(() => comparePngBuffers(tinyPng.subarray(0, -1), tinyPng, smallMetadata), /truncated PNG chunk|PNG must contain/)
  const unsupportedColor = Buffer.from(tinyPng)
  unsupportedColor[25] = 3
  assert.throws(() => comparePngBuffers(unsupportedColor, tinyPng, smallMetadata), /only non-interlaced/)
  const unsupportedDepth = Buffer.from(tinyPng)
  unsupportedDepth[24] = 16
  assert.throws(() => comparePngBuffers(unsupportedDepth, tinyPng, smallMetadata), /only non-interlaced/)
  const unsupportedInterlace = Buffer.from(tinyPng)
  unsupportedInterlace[28] = 1
  assert.throws(() => comparePngBuffers(unsupportedInterlace, tinyPng, smallMetadata), /only non-interlaced/)
  const unsupportedFilter = createRgbPng(1, 1, Buffer.alloc(3), 5)
  assert.throws(() => comparePngBuffers(unsupportedFilter, tinyPng, smallMetadata), /unsupported PNG row filter/)
  const tinyMetadata = {
    canvasRect: {x: 0, y: 0, width: 1, height: 1},
    roiRect: {x: 0, y: 0, width: 1, height: 1},
    minUnmaskedFraction: 0.25,
  }
  const missingMetadata = {...tinyMetadata}
  delete missingMetadata.maskRects
  assert.throws(() => comparePngBuffers(tinyPng, tinyPng, missingMetadata), /maskRects must be an array/)
  console.log('IMAGE_COMPARE_RED_THRESHOLD_MUTATION=PASS')
  console.log('IMAGE_COMPARE_SELF_TEST=PASS')
} finally {
  fs.rmSync(tempRoot, {recursive: true, force: true})
}

assert.equal(fs.existsSync(tempRoot), false, 'image compare temporary files must be cleaned')
console.log('IMAGE_COMPARE_CLEANUP=PASS')
