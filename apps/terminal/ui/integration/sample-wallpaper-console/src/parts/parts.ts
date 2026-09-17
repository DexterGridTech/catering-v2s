import {definePart} from '@catering-v2s/ui-base-render'
import {WallpaperConsoleWaiting} from '../components/Waiting'
import {WallpaperConsoleWelcome} from '../components/Welcome'

const main = ['main'] as const
const secondary = ['SECONDARY'] as const
const mainWorkspace = ['MAIN'] as const
const masterAndSlave = ['MASTER', 'SLAVE'] as const
const laptop = ['laptop'] as const

export const waitingPart = definePart({
  partKey: 'sample.wallpaper-console.waiting',
  rendererKey: 'sample.wallpaper-console.waiting',
  containerKeys: main,
  displayModes: secondary,
  workspaces: mainWorkspace,
  instanceModes: masterAndSlave,
  surfaceForm: laptop,
  title: '等待店员登录',
  description: '副屏在店员登录前显示等待提示',
  component: WallpaperConsoleWaiting,
})

export const welcomePart = definePart({
  partKey: 'sample.wallpaper-console.welcome',
  rendererKey: 'sample.wallpaper-console.welcome',
  containerKeys: main,
  displayModes: secondary,
  workspaces: mainWorkspace,
  instanceModes: masterAndSlave,
  surfaceForm: laptop,
  title: '顾客欢迎页',
  description: '店员登录后在副屏显示顾客欢迎语',
  component: WallpaperConsoleWelcome,
})

export const parts = Object.freeze([waitingPart, welcomePart])
