import {definePart, definePartPair, type RenderLayerDismissal} from '@catering-v2s/ui-base-render';
import {WallpaperPicker as LaptopWallpaperPicker} from '../components/laptop/WallpaperPicker';
import {WallpaperPicker as MobileWallpaperPicker} from '../components/mobile/WallpaperPicker';
import {WallpaperSystemNotice as LaptopWallpaperSystemNotice} from '../components/laptop/WallpaperSystemNotice';
import {WallpaperSystemNotice as MobileWallpaperSystemNotice} from '../components/mobile/WallpaperSystemNotice';
import {BranchWallpaperPicker} from '../components/laptop/BranchWallpaperPicker';
import {dispatchWallpaperSystemFailureDismissal} from '../foundations/systemFailureDismissal';
import {WallpaperBackground} from '../components/WallpaperBackground';
import {HostWallpaperDisplay} from '../components/HostWallpaperDisplay';

const primary = ['PRIMARY'] as const;
const secondary = ['SECONDARY'] as const;
const main = ['main'] as const;
const layer = [] as const;
const workspace = ['MAIN'] as const;
const master = ['MASTER'] as const;
const slave = ['SLAVE'] as const;
const branch = ['BRANCH'] as const;
const laptop = ['laptop'] as const;
const hostSecondaryRoles = ['MASTER', 'SLAVE'] as const;

const pickerPair = definePartPair({
  partKey: 'sample.wallpaper.picker',
  containerKeys: main,
  displayModes: primary,
  workspaces: workspace,
  instanceModes: master,
  title: '屏幕壁纸',
  description: '选择并确认终端两屏使用的壁纸',
  components: {laptop: LaptopWallpaperPicker, mobile: MobileWallpaperPicker},
});

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
});

const branchPicker = definePart({
  partKey: 'sample.wallpaper.branch.picker',
  rendererKey: 'sample.wallpaper.branch.picker',
  containerKeys: main,
  displayModes: primary,
  workspaces: branch,
  instanceModes: slave,
  surfaceForm: laptop,
  title: '副机本地壁纸',
  description: '选择并确认副机本机壁纸，不提供店员登出',
  component: BranchWallpaperPicker,
});

const wallpaperHome = definePart({
  partKey: 'sample.wallpaper.home',
  rendererKey: 'sample.wallpaper.home',
  containerKeys: main,
  displayModes: primary,
  workspaces: workspace,
  instanceModes: master,
  surfaceForm: laptop,
  title: '当前壁纸',
  description: '退出壁纸选择后显示已确认的本机壁纸',
  component: WallpaperBackground,
});

const branchWallpaperHome = definePart({
  partKey: 'sample.wallpaper.branch.home',
  rendererKey: 'sample.wallpaper.branch.home',
  containerKeys: main,
  displayModes: primary,
  workspaces: branch,
  instanceModes: slave,
  surfaceForm: laptop,
  title: '副机当前壁纸',
  description: '退出副机壁纸选择后显示本机已确认壁纸',
  component: WallpaperBackground,
});

const hostWallpaperDisplay = definePart({
  partKey: 'sample.wallpaper.host-display',
  rendererKey: 'sample.wallpaper.host-display',
  containerKeys: main,
  displayModes: secondary,
  workspaces: workspace,
  instanceModes: hostSecondaryRoles,
  surfaceForm: laptop,
  title: '主机已确认壁纸',
  description: 'LMS只读显示主机确认壁纸；副机只读当前peer投影',
  component: HostWallpaperDisplay,
});

export const parts = Object.freeze([
  pickerPair.laptop,
  pickerPair.mobile,
  systemNoticePair.laptop,
  systemNoticePair.mobile,
  branchPicker,
  wallpaperHome,
  branchWallpaperHome,
  hostWallpaperDisplay,
]);

export const layerDismissals: Readonly<Record<string, RenderLayerDismissal>> = Object.freeze({
  [systemNoticePair.laptop.catalogEntry.partKey]: ({dispatchCommand}) =>
    dispatchWallpaperSystemFailureDismissal(dispatchCommand),
});
