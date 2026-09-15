import {definePart, type RenderLayerDismissal} from '@catering-v2s/ui-base-render'
import {WallpaperPicker} from '../components/WallpaperPicker'
import {WallpaperSystemNotice} from '../components/WallpaperSystemNotice'
import {dispatchWallpaperSystemFailureDismissal} from '../foundations/systemFailureDismissal'

const allForms = ['laptop', 'mobile'] as const

export const wallpaperPickerPart = definePart({
  partKey: 'sample.wallpaper.picker',
  rendererKey: 'sample.wallpaper.picker',
  containerKeys: ['main'],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: allForms,
  title: '屏幕壁纸',
  description: '选择并确认终端两屏使用的壁纸',
  component: WallpaperPicker,
})

export const systemNoticePart = definePart({
  partKey: 'sample.wallpaper.system-notice',
  rendererKey: 'sample.wallpaper.system-notice',
  containerKeys: [],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: allForms,
  title: '壁纸系统失败提示',
  description: '向店员说明壁纸选择或确认请求的基础设施失败，并允许继续操作',
  component: WallpaperSystemNotice,
  layerTier: 'alert',
})

export const parts = Object.freeze([wallpaperPickerPart, systemNoticePart])

export const layerDismissals: Readonly<Record<string, RenderLayerDismissal>> = Object.freeze({
  [systemNoticePart.catalogEntry.partKey]: ({dispatchCommand}) =>
    dispatchWallpaperSystemFailureDismissal(dispatchCommand),
})
