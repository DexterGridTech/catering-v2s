import {definePart} from '@catering-v2s/ui-base-render'
import {CustomerMember} from '../components/CustomerMember'
import {CustomerWelcome} from '../components/CustomerWelcome'
import {DiscardConfirm} from '../components/DiscardConfirm'
import {MemberForm} from '../components/MemberForm'
import {MemberList} from '../components/MemberList'
import {RegistryNotice} from '../components/RegistryNotice'
import {DeskSystemNotice} from '../components/DeskSystemNotice'
import {WaitingConfirm} from '../components/WaitingConfirm'
import {WithdrawConfirm} from '../components/WithdrawConfirm'

const main = ['main'] as const
const primary = ['PRIMARY'] as const
const secondary = ['SECONDARY'] as const
const both = ['PRIMARY', 'SECONDARY'] as const
const mainWorkspace = ['MAIN'] as const
const masterInstance = ['MASTER'] as const
const allForms = ['laptop', 'mobile'] as const

export const memberListPart = definePart({
  partKey: 'sample.desk.member-list',
  rendererKey: 'sample.desk.member-list',
  containerKeys: main,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  surfaceForm: allForms,
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
  surfaceForm: allForms,
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
  surfaceForm: allForms,
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
  surfaceForm: allForms,
  title: '登记结果提示',
  description: '向店员说明登记未完成的原因',
  component: RegistryNotice,
  layerTier: 'alert',
  layerGuard: 'decisive',
})

export const discardConfirmPart = definePart({
  partKey: 'sample.desk.discard-confirm',
  rendererKey: 'sample.desk.discard-confirm',
  containerKeys: [],
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  surfaceForm: allForms,
  title: '放弃草稿确认',
  description: '在取消录入或退出前确认是否放弃当前草稿',
  component: DiscardConfirm,
  layerTier: 'alert',
  layerGuard: 'decisive',
})

export const withdrawConfirmPart = definePart({
  partKey: 'sample.desk.withdraw-confirm',
  rendererKey: 'sample.desk.withdraw-confirm',
  containerKeys: [],
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  surfaceForm: allForms,
  title: '撤回登记确认',
  description: '在顾客确认前确认是否撤回本次登记',
  component: WithdrawConfirm,
  layerTier: 'alert',
  layerGuard: 'decisive',
})

export const systemNoticePart = definePart({
  partKey: 'sample.desk.system-notice',
  rendererKey: 'sample.desk.system-notice',
  containerKeys: [],
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  surfaceForm: allForms,
  title: '系统失败提示',
  description: '向店员说明登记链路的基础设施失败，并允许继续操作',
  component: DeskSystemNotice,
  layerTier: 'alert',
})

export const customerWelcomePart = definePart({
  partKey: 'sample.desk.customer-welcome',
  rendererKey: 'sample.desk.customer-welcome',
  containerKeys: main,
  displayModes: secondary,
  workspaces: mainWorkspace,
  instanceModes: masterInstance,
  surfaceForm: allForms,
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
  surfaceForm: allForms,
  title: '顾客会员确认',
  description: '向顾客展示待登记会员并提供确认或拒绝',
  component: CustomerMember,
})

export const parts = Object.freeze([
  memberListPart,
  memberFormPart,
  waitingConfirmPart,
  registryNoticePart,
  discardConfirmPart,
  withdrawConfirmPart,
  systemNoticePart,
  customerWelcomePart,
  customerMemberPart,
])
