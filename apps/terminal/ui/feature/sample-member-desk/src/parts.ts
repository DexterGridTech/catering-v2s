import {definePart} from '@catering-v2s/ui-base-render'
import {CustomerMember} from './components/CustomerMember'
import {CustomerWelcome} from './components/CustomerWelcome'
import {MemberForm} from './components/MemberForm'
import {MemberList} from './components/MemberList'
import {RegistryNotice} from './components/RegistryNotice'
import {WaitingConfirm} from './components/WaitingConfirm'

const main = ['main'] as const
const primary = ['PRIMARY'] as const
const secondary = ['SECONDARY'] as const
const both = ['PRIMARY', 'SECONDARY'] as const
const mainWorkspace = ['MAIN'] as const
const masterInstance = ['MASTER'] as const

export const memberListPart = definePart({
  partKey: 'sample.desk.member-list',
  rendererKey: 'sample.desk.member-list',
  containerKeys: main,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  title: '已登记会员',
  description: '查看已登记会员并开始新增登记',
  component: MemberList,
})

export const memberFormPart = definePart({
  partKey: 'sample.desk.member-form',
  rendererKey: 'sample.desk.member-form',
  containerKeys: main,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  title: '新增会员',
  description: '录入姓名和电话并提交给顾客确认',
  component: MemberForm,
})

export const waitingConfirmPart = definePart({
  partKey: 'sample.desk.waiting-confirm',
  rendererKey: 'sample.desk.waiting-confirm',
  containerKeys: [],
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  title: '等待顾客确认',
  description: '告知店员登记已提交并等待顾客确认',
  component: WaitingConfirm,
  layerTier: 'standard',
})

export const registryNoticePart = definePart({
  partKey: 'sample.desk.registry-notice',
  rendererKey: 'sample.desk.registry-notice',
  containerKeys: [],
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  title: '登记结果提示',
  description: '向店员说明登记未完成的原因',
  component: RegistryNotice,
  layerTier: 'alert',
})

export const customerWelcomePart = definePart({
  partKey: 'sample.desk.customer-welcome',
  rendererKey: 'sample.desk.customer-welcome',
  containerKeys: main,
  displayModes: secondary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  title: '顾客欢迎页',
  description: '副屏待机时提示顾客等待店员操作',
  component: CustomerWelcome,
})

export const customerMemberPart = definePart({
  partKey: 'sample.desk.customer-member',
  rendererKey: 'sample.desk.customer-member',
  containerKeys: main,
  displayModes: both,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  title: '顾客会员确认',
  description: '向顾客展示待登记会员并提供确认或拒绝',
  component: CustomerMember,
})

export const parts = Object.freeze([
  memberListPart,
  memberFormPart,
  waitingConfirmPart,
  registryNoticePart,
  customerWelcomePart,
  customerMemberPart,
])
