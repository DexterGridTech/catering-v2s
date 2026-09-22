import {definePartPair, type RenderLayerDismissal} from '@catering-v2s/ui-base-render'
import {WallpaperPicker as LaptopWallpaperPicker} from '../components/laptop/WallpaperPicker'
import {WallpaperPicker as MobileWallpaperPicker} from '../components/mobile/WallpaperPicker'
import {WallpaperSystemNotice as LaptopWallpaperSystemNotice} from '../components/laptop/WallpaperSystemNotice'
import {WallpaperSystemNotice as MobileWallpaperSystemNotice} from '../components/mobile/WallpaperSystemNotice'
import {dispatchWallpaperSystemFailureDismissal} from '../foundations/systemFailureDismissal'

const primary = ['PRIMARY'] as const
const main = ['main'] as const
const layer = [] as const
const workspace = ['MAIN'] as const
const master = ['MASTER'] as const

const pickerPair = definePartPair({
  partKey: 'sample.wallpaper.picker',
  containerKeys: main,
  displayModes: primary,
  workspaces: workspace,
  instanceModes: master,
  title: '屏幕壁纸',
  description: '选择并确认终端两屏使用的壁纸',
  components: {laptop: LaptopWallpaperPicker, mobile: MobileWallpaperPicker},
})

const systemNoticePair = definePartPair({
  partKey: 'sample.wallpaper.system-notice',
  containerKeys: layer,
  displayModes: primary,
  workspaces: workspace,
  instanceModes: master,
  title: '壁纸系统失败提示',
  description: '向店员说明壁纸选择或确认请求的基础设施失败，并允许继续操作',
  layerTier: 'alert',
  components: {laptop: LaptopWallpaperSystemNotice, mobile: MobileWallpaperSystemNotice},
})

export const parts = Object.freeze([
  pickerPair.laptop,
  pickerPair.mobile,
  systemNoticePair.laptop,
  systemNoticePair.mobile,
])

export const layerDismissals: Readonly<Record<string, RenderLayerDismissal>> = Object.freeze({
  [systemNoticePair.laptop.catalogEntry.partKey]: ({dispatchCommand}) =>
    dispatchWallpaperSystemFailureDismissal(dispatchCommand),
})
