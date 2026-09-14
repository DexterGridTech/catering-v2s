import {definePart} from '@catering-v2s/ui-base-render'
import {WallpaperPicker} from '../components/WallpaperPicker'

export const wallpaperPickerPart = definePart({
  partKey: 'sample.wallpaper.picker',
  rendererKey: 'sample.wallpaper.picker',
  containerKeys: ['main'],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: ['laptop', 'mobile'] as const,
  title: '屏幕壁纸',
  description: '选择并确认终端两屏使用的壁纸',
  component: WallpaperPicker,
})

export const parts = Object.freeze([wallpaperPickerPart])
