import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const catalogPath = path.join(
  repositoryRoot,
  'apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperCatalogData.json',
)
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const ids = Array.isArray(catalog.ids) ? catalog.ids : []
const labels = catalog.labels
if (!ids.every(id => typeof id === 'string') || new Set(ids).size !== ids.length
  || labels === null || typeof labels !== 'object' || Array.isArray(labels)
  || ids.length !== Object.keys(labels).length
  || ids.some(id => !Object.prototype.hasOwnProperty.call(labels, id))) {
  throw new Error('wallpaper catalog ids and labels must be a unique, matching set')
}

export const wallpaperIds = Object.freeze([...ids])
export const wallpaperLabels = Object.freeze({...labels})
