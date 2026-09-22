import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {assetsById} from './assets'
import wallpaperCatalogData from './wallpaperCatalogData.json'

type WallpaperCatalogData = Readonly<{
  readonly ids: readonly WallpaperId[]
  readonly labels: Readonly<Record<WallpaperId, string>>
}>

const catalogData = wallpaperCatalogData as WallpaperCatalogData
const keysOf = (value: object): readonly string[] => Object.keys(value).sort()
const sameKeys = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((key, index) => key === right[index])

const catalogIds = [...catalogData.ids]
const catalogIdKeys = [...new Set(catalogIds)].sort()
const assetIdKeys = keysOf(assetsById)
const labelIdKeys = keysOf(catalogData.labels)
if (catalogIds.length === 0 || catalogIds.length !== catalogIdKeys.length
  || !sameKeys(catalogIdKeys, assetIdKeys) || !sameKeys(catalogIdKeys, labelIdKeys)) {
  throw new Error('[sample-wallpaper-picker] wallpaper catalog ids, labels and assets must be the same set')
}

export const wallpaperIds: readonly WallpaperId[] = Object.freeze(catalogIds)
export const wallpaperLabels: Readonly<Record<WallpaperId, string>> = Object.freeze(
  {...catalogData.labels},
)
