import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import zlib from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const PIXEL_CHANGE_THRESHOLD = 4
const GRID_SIZE = 8
const MIN_UNMASKED_FRACTION = 0.25
const MIN_ROI_FRACTION = 0.2
const MAX_MASKED_CANVAS_FRACTION = 0.8

const fail = message => {
  throw new Error(`terminal-image-compare: ${message}`)
}

const assertRect = (rect, label) => {
  if (rect === null || typeof rect !== 'object') fail(`${label} must be an object`)
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isInteger(rect[key]) || rect[key] < 0) fail(`${label}.${key} must be a non-negative integer`)
  }
  if (rect.width === 0 || rect.height === 0) fail(`${label} must not be empty`)
}

const assertRectInsideImage = (rect, image, label) => {
  assertRect(rect, label)
  if (rect.x + rect.width > image.width || rect.y + rect.height > image.height) {
    fail(`${label} must be inside the PNG bounds`)
  }
}

const parsePng = buffer => {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail('unsupported PNG signature')
  }
  let offset = 8
  let header
  const idat = []
  let ended = false
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const chunkEnd = dataEnd + 4
    if (chunkEnd > buffer.length) fail('truncated PNG chunk')
    const data = buffer.subarray(dataStart, dataEnd)
    if (type === 'IHDR') {
      if (length !== 13 || header !== undefined) fail('invalid IHDR')
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      ended = true
      break
    }
    offset = chunkEnd
  }
  if (header === undefined || !ended || idat.length === 0) fail('PNG must contain IHDR, IDAT and IEND')
  if (header.width === 0 || header.height === 0) fail('PNG dimensions must be positive')
  if (header.bitDepth !== 8 || ![2, 6].includes(header.colorType) || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    fail('only non-interlaced 8-bit RGB/RGBA PNG is supported')
  }
  const channels = header.colorType === 6 ? 4 : 3
  const rowBytes = header.width * channels
  const inflated = zlib.inflateSync(Buffer.concat(idat))
  const expectedLength = header.height * (rowBytes + 1)
  if (inflated.length !== expectedLength) fail('PNG scanline length does not match IHDR')
  const pixels = Buffer.alloc(header.width * header.height * 4)
  let sourceOffset = 0
  let previous = Buffer.alloc(rowBytes)
  for (let y = 0; y < header.height; y += 1) {
    const filterType = inflated[sourceOffset]
    sourceOffset += 1
    const encoded = inflated.subarray(sourceOffset, sourceOffset + rowBytes)
    sourceOffset += rowBytes
    const row = Buffer.from(encoded)
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? row[x - channels] : 0
      const up = previous[x] ?? 0
      const upperLeft = x >= channels ? previous[x - channels] : 0
      if (filterType === 1) row[x] = (row[x] + left) & 0xff
      else if (filterType === 2) row[x] = (row[x] + up) & 0xff
      else if (filterType === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff
      else if (filterType === 4) {
        const estimate = left + up - upperLeft
        const pa = Math.abs(estimate - left)
        const pb = Math.abs(estimate - up)
        const pc = Math.abs(estimate - upperLeft)
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft
        row[x] = (row[x] + predictor) & 0xff
      } else if (filterType !== 0) {
        fail(`unsupported PNG row filter ${filterType}`)
      }
    }
    for (let x = 0; x < header.width; x += 1) {
      const source = x * channels
      const target = (y * header.width + x) * 4
      pixels[target] = row[source]
      pixels[target + 1] = row[source + 1]
      pixels[target + 2] = row[source + 2]
      pixels[target + 3] = channels === 4 ? row[source + 3] : 255
    }
    previous = row
  }
  return Object.freeze({width: header.width, height: header.height, pixels})
}

const normalizeMetadata = (metadata, image) => {
  if (metadata === null || typeof metadata !== 'object') fail('metadata must be an object')
  assertRectInsideImage(metadata.canvasRect, image, 'canvasRect')
  assertRectInsideImage(metadata.roiRect, image, 'roiRect')
  const canvas = metadata.canvasRect
  const roi = metadata.roiRect
  if (roi.x < canvas.x || roi.y < canvas.y || roi.x + roi.width > canvas.x + canvas.width || roi.y + roi.height > canvas.y + canvas.height) {
    fail('roiRect must be inside canvasRect')
  }
  if ((roi.width * roi.height) / (canvas.width * canvas.height) < MIN_ROI_FRACTION) {
    fail(`roiRect must cover at least ${MIN_ROI_FRACTION * 100}% of canvasRect`)
  }
  if (!Array.isArray(metadata.maskRects)) fail('maskRects must be an array')
  metadata.maskRects.forEach((rect, index) => assertRectInsideImage(rect, image, `maskRects[${index}]`))
  let maskedCanvasPixels = 0
  for (let y = canvas.y; y < canvas.y + canvas.height; y += 1) {
    for (let x = canvas.x; x < canvas.x + canvas.width; x += 1) {
      if (isMasked(x, y, metadata.maskRects)) maskedCanvasPixels += 1
    }
  }
  if (maskedCanvasPixels / (canvas.width * canvas.height) > MAX_MASKED_CANVAS_FRACTION) {
    fail(`mask must cover at most ${MAX_MASKED_CANVAS_FRACTION * 100}% of canvasRect`)
  }
  if (metadata.minUnmaskedFraction !== MIN_UNMASKED_FRACTION) {
    fail(`minUnmaskedFraction must be exactly ${MIN_UNMASKED_FRACTION}`)
  }
  return Object.freeze({
    canvasRect: canvas,
    roiRect: roi,
    maskRects: metadata.maskRects,
    minUnmaskedFraction: MIN_UNMASKED_FRACTION,
  })
}

const pointInRect = (x, y, rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
const isMasked = (x, y, maskRects) => maskRects.some(rect => pointInRect(x, y, rect))

const pixelDelta = (first, second, index) => Math.max(
  Math.abs(first[index] - second[index]),
  Math.abs(first[index + 1] - second[index + 1]),
  Math.abs(first[index + 2] - second[index + 2]),
)

const percentile = (values, fraction) => {
  if (values.length === 0) fail('ROI has no unmasked pixels')
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)]
}

export const comparePngBuffers = (firstBuffer, secondBuffer, metadata) => {
  const first = parsePng(firstBuffer)
  const second = parsePng(secondBuffer)
  if (first.width !== second.width || first.height !== second.height) fail('PNG dimensions must match')
  const normalized = normalizeMetadata(metadata, first)
  const deltas = []
  let changedPixels = 0
  let roiPixels = 0
  for (let y = normalized.roiRect.y; y < normalized.roiRect.y + normalized.roiRect.height; y += 1) {
    for (let x = normalized.roiRect.x; x < normalized.roiRect.x + normalized.roiRect.width; x += 1) {
      if (isMasked(x, y, normalized.maskRects)) continue
      const index = (y * first.width + x) * 4
      const delta = pixelDelta(first.pixels, second.pixels, index)
      deltas.push(delta)
      roiPixels += 1
      if (delta > PIXEL_CHANGE_THRESHOLD) changedPixels += 1
    }
  }
  if (roiPixels === 0) fail('ROI has no unmasked pixels')
  const cellStates = []
  const canvas = normalized.canvasRect
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const cellX0 = canvas.x + Math.floor((column * canvas.width) / GRID_SIZE)
      const cellX1 = canvas.x + Math.floor(((column + 1) * canvas.width) / GRID_SIZE)
      const cellY0 = canvas.y + Math.floor((row * canvas.height) / GRID_SIZE)
      const cellY1 = canvas.y + Math.floor(((row + 1) * canvas.height) / GRID_SIZE)
      const cellArea = (cellX1 - cellX0) * (cellY1 - cellY0)
      let unmasked = 0
      let cellDeltaTotal = 0
      for (let y = cellY0; y < cellY1; y += 1) {
        for (let x = cellX0; x < cellX1; x += 1) {
          if (x < normalized.roiRect.x || x >= normalized.roiRect.x + normalized.roiRect.width
            || y < normalized.roiRect.y || y >= normalized.roiRect.y + normalized.roiRect.height
            || isMasked(x, y, normalized.maskRects)) continue
          unmasked += 1
          const index = (y * first.width + x) * 4
          cellDeltaTotal += pixelDelta(first.pixels, second.pixels, index)
        }
      }
      if (unmasked / cellArea >= normalized.minUnmaskedFraction) {
        cellStates.push(cellDeltaTotal / unmasked > PIXEL_CHANGE_THRESHOLD)
      }
    }
  }
  if (cellStates.length === 0) fail('mask excludes every grid cell')
  let absoluteChannelDifference = 0
  for (let y = normalized.roiRect.y; y < normalized.roiRect.y + normalized.roiRect.height; y += 1) {
    for (let x = normalized.roiRect.x; x < normalized.roiRect.x + normalized.roiRect.width; x += 1) {
      if (isMasked(x, y, normalized.maskRects)) continue
      const index = (y * first.width + x) * 4
      absoluteChannelDifference += Math.abs(first.pixels[index] - second.pixels[index])
        + Math.abs(first.pixels[index + 1] - second.pixels[index + 1])
        + Math.abs(first.pixels[index + 2] - second.pixels[index + 2])
    }
  }
  return Object.freeze({
    width: first.width,
    height: first.height,
    roiPixelCount: roiPixels,
    participatingCellCount: cellStates.length,
    changedPixelCount: changedPixels,
    changedFraction: changedPixels / roiPixels,
    P95: percentile(deltas, 0.95),
    meanAbsDiff: absoluteChannelDifference / (roiPixels * 3),
    changedCellFraction: cellStates.filter(Boolean).length / cellStates.length,
    threshold: PIXEL_CHANGE_THRESHOLD,
    grid: Object.freeze({columns: GRID_SIZE, rows: GRID_SIZE, rect: canvas}),
  })
}

export const comparePngFiles = (firstPath, secondPath, metadataPath) => (
  comparePngBuffers(
    fs.readFileSync(firstPath),
    fs.readFileSync(secondPath),
    JSON.parse(fs.readFileSync(metadataPath, 'utf8')),
  )
)

const main = () => {
  const [, , firstPath, secondPath, metadataPath] = process.argv
  if (firstPath === undefined || secondPath === undefined || metadataPath === undefined) {
    fail('usage: node compare.mjs <before.png> <after.png> <metadata.json>')
  }
  process.stdout.write(`${JSON.stringify(comparePngFiles(path.resolve(firstPath), path.resolve(secondPath), path.resolve(metadataPath)))}\n`)
}

const invokedAsMain = process.argv[1] !== undefined
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))

if (invokedAsMain) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
