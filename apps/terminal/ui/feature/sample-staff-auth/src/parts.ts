import {definePart} from '@catering-v2s/ui-base-render'
import {AuthNotice} from './components/AuthNotice'
import {AuthSystemNotice} from './components/AuthSystemNotice'
import {StaffLogin} from './components/StaffLogin'

export const loginPart = definePart({
  partKey: 'sample.auth.login',
  rendererKey: 'sample.auth.login',
  containerKeys: ['main'],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  title: '店员登录',
  description: '店员使用工号和密码进入会员登记工作台',
  component: StaffLogin,
})

export const noticePart = definePart({
  partKey: 'sample.auth.notice',
  rendererKey: 'sample.auth.notice',
  containerKeys: [],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  title: '登录失败提示',
  description: '向店员说明登录失败原因并提供关闭动作',
  component: AuthNotice,
  layerTier: 'alert',
})

export const systemNoticePart = definePart({
  partKey: 'sample.auth.system-notice',
  rendererKey: 'sample.auth.system-notice',
  containerKeys: [],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  title: '系统失败提示',
  description: '向店员说明登录或退出的基础设施失败，并允许继续操作',
  component: AuthSystemNotice,
  layerTier: 'alert',
})

export const parts = Object.freeze([loginPart, noticePart, systemNoticePart])
