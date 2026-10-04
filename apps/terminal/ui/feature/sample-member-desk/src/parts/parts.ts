import {definePartPair, type RenderLayerDismissal} from '@catering-v2s/ui-base-render';
import {CustomerMember as LaptopCustomerMember} from '../components/laptop/CustomerMember';
import {CustomerMember as MobileCustomerMember} from '../components/mobile/CustomerMember';
import {CustomerWelcome as LaptopCustomerWelcome} from '../components/laptop/CustomerWelcome';
import {CustomerWelcome as MobileCustomerWelcome} from '../components/mobile/CustomerWelcome';
import {DiscardConfirm as LaptopDiscardConfirm} from '../components/laptop/DiscardConfirm';
import {DiscardConfirm as MobileDiscardConfirm} from '../components/mobile/DiscardConfirm';
import {MemberForm as LaptopMemberForm} from '../components/laptop/MemberForm';
import {MemberForm as MobileMemberForm} from '../components/mobile/MemberForm';
import {MemberList as LaptopMemberList} from '../components/laptop/MemberList';
import {MemberList as MobileMemberList} from '../components/mobile/MemberList';
import {RegistryNotice as LaptopRegistryNotice} from '../components/laptop/RegistryNotice';
import {RegistryNotice as MobileRegistryNotice} from '../components/mobile/RegistryNotice';
import {DeskSystemNotice as LaptopDeskSystemNotice} from '../components/laptop/DeskSystemNotice';
import {DeskSystemNotice as MobileDeskSystemNotice} from '../components/mobile/DeskSystemNotice';
import {WaitingConfirm as LaptopWaitingConfirm} from '../components/laptop/WaitingConfirm';
import {WaitingConfirm as MobileWaitingConfirm} from '../components/mobile/WaitingConfirm';
import {WithdrawConfirm as LaptopWithdrawConfirm} from '../components/laptop/WithdrawConfirm';
import {WithdrawConfirm as MobileWithdrawConfirm} from '../components/mobile/WithdrawConfirm';
import {dispatchDeskSystemFailureDismissal} from '../foundations/systemFailureDismissal';
import {BranchLaptopMemberList, BranchMobileMemberList} from '../components/branch/MemberList';
import {BranchLaptopMemberForm, BranchMobileMemberForm} from '../components/branch/MemberForm';
import {BranchLaptopCustomerMember, BranchMobileCustomerMember} from '../components/branch/CustomerMember';

const primary = ['PRIMARY'] as const;
const secondary = ['SECONDARY'] as const;
const bothDisplayModes = ['PRIMARY', 'SECONDARY'] as const;
const main = ['main'] as const;
const layer = [] as const;
const mainWorkspace = ['MAIN'] as const;
const master = ['MASTER'] as const;
const masterAndSlave = ['MASTER', 'SLAVE'] as const;
const branchWorkspace = ['BRANCH'] as const;
const slave = ['SLAVE'] as const;

const branchRegistryNoticePair = definePartPair({
  partKey: 'sample.desk.branch.registry-notice',
  containerKeys: layer,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '登记结果提示',
  description: '向副机店员说明本次登记未完成的原因',
  layerTier: 'alert',
  layerGuard: 'decisive',
  components: {laptop: LaptopRegistryNotice, mobile: MobileRegistryNotice},
});

const branchDiscardConfirmPair = definePartPair({
  partKey: 'sample.desk.branch.discard-confirm',
  containerKeys: layer,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '放弃草稿确认',
  description: '在副机取消录入或退出前确认是否放弃当前草稿',
  layerTier: 'alert',
  layerGuard: 'decisive',
  components: {laptop: LaptopDiscardConfirm, mobile: MobileDiscardConfirm},
});

const branchWithdrawConfirmPair = definePartPair({
  partKey: 'sample.desk.branch.withdraw-confirm',
  containerKeys: layer,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '撤回登记确认',
  description: '在副机顾客确认前确认是否撤回本次登记',
  layerTier: 'alert',
  layerGuard: 'decisive',
  components: {laptop: LaptopWithdrawConfirm, mobile: MobileWithdrawConfirm},
});

const branchSystemNoticePair = definePartPair({
  partKey: 'sample.desk.branch.system-notice',
  containerKeys: layer,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '系统失败提示',
  description: '向副机店员说明登记链路失败并允许继续操作',
  layerTier: 'alert',
  components: {laptop: LaptopDeskSystemNotice, mobile: MobileDeskSystemNotice},
});

const branchMemberListPair = definePartPair({
  partKey: 'sample.desk.branch.member-list',
  containerKeys: main,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '已登记会员',
  description: '在副机读取主机会员并开始本地登记',
  components: {laptop: BranchLaptopMemberList, mobile: BranchMobileMemberList},
});

const branchMemberFormPair = definePartPair({
  partKey: 'sample.desk.branch.member-form',
  containerKeys: main,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '新增会员',
  description: '在副机录入会员并交由顾客在本机确认',
  components: {laptop: BranchLaptopMemberForm, mobile: BranchMobileMemberForm},
});

const branchCustomerMemberPair = definePartPair({
  partKey: 'sample.desk.branch.customer-member',
  containerKeys: main,
  displayModes: primary,
  workspaces: branchWorkspace,
  instanceModes: slave,
  title: '顾客会员确认',
  description: '在副机本地展示并确认本机待登记会员',
  components: {laptop: BranchLaptopCustomerMember, mobile: BranchMobileCustomerMember},
});

const memberListPair = definePartPair({
  partKey: 'sample.desk.member-list',
  containerKeys: main,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '已登记会员',
  description: '查看已登记会员并开始新增登记',
  components: {laptop: LaptopMemberList, mobile: MobileMemberList},
});

const memberFormPair = definePartPair({
  partKey: 'sample.desk.member-form',
  containerKeys: main,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '新增会员',
  description: '录入姓名和电话并提交给顾客确认',
  components: {laptop: LaptopMemberForm, mobile: MobileMemberForm},
});

const waitingConfirmPair = definePartPair({
  partKey: 'sample.desk.waiting-confirm',
  containerKeys: layer,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '等待顾客确认',
  description: '告知店员登记已提交并等待顾客确认',
  layerTier: 'standard',
  components: {laptop: LaptopWaitingConfirm, mobile: MobileWaitingConfirm},
});

const registryNoticePair = definePartPair({
  partKey: 'sample.desk.registry-notice',
  containerKeys: layer,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '登记结果提示',
  description: '向店员说明登记未完成的原因',
  layerTier: 'alert',
  layerGuard: 'decisive',
  components: {laptop: LaptopRegistryNotice, mobile: MobileRegistryNotice},
});

const discardConfirmPair = definePartPair({
  partKey: 'sample.desk.discard-confirm',
  containerKeys: layer,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '放弃草稿确认',
  description: '在取消录入或退出前确认是否放弃当前草稿',
  layerTier: 'alert',
  layerGuard: 'decisive',
  components: {laptop: LaptopDiscardConfirm, mobile: MobileDiscardConfirm},
});

const withdrawConfirmPair = definePartPair({
  partKey: 'sample.desk.withdraw-confirm',
  containerKeys: layer,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '撤回登记确认',
  description: '在顾客确认前确认是否撤回本次登记',
  layerTier: 'alert',
  layerGuard: 'decisive',
  components: {laptop: LaptopWithdrawConfirm, mobile: MobileWithdrawConfirm},
});

const systemNoticePair = definePartPair({
  partKey: 'sample.desk.system-notice',
  containerKeys: layer,
  displayModes: primary,
  workspaces: mainWorkspace,
  instanceModes: master,
  title: '系统失败提示',
  description: '向店员说明登记链路的基础设施失败，并允许继续操作',
  layerTier: 'alert',
  components: {laptop: LaptopDeskSystemNotice, mobile: MobileDeskSystemNotice},
});

const customerWelcomePair = definePartPair({
  partKey: 'sample.desk.customer-welcome',
  containerKeys: main,
  displayModes: secondary,
  workspaces: mainWorkspace,
  instanceModes: masterAndSlave,
  title: '顾客欢迎页',
  description: '副屏待机时提示顾客等待店员操作',
  components: {laptop: LaptopCustomerWelcome, mobile: MobileCustomerWelcome},
});

const customerMemberPair = definePartPair({
  partKey: 'sample.desk.customer-member',
  containerKeys: main,
  displayModes: bothDisplayModes,
  workspaces: mainWorkspace,
  instanceModes: masterAndSlave,
  title: '顾客会员确认',
  description: '向顾客展示待登记会员并提供确认或拒绝',
  components: {laptop: LaptopCustomerMember, mobile: MobileCustomerMember},
});

export const parts = Object.freeze([
  branchMemberListPair.laptop,
  branchMemberListPair.mobile,
  branchMemberFormPair.laptop,
  branchMemberFormPair.mobile,
  branchCustomerMemberPair.laptop,
  branchCustomerMemberPair.mobile,
  branchRegistryNoticePair.laptop,
  branchRegistryNoticePair.mobile,
  branchDiscardConfirmPair.laptop,
  branchDiscardConfirmPair.mobile,
  branchWithdrawConfirmPair.laptop,
  branchWithdrawConfirmPair.mobile,
  branchSystemNoticePair.laptop,
  branchSystemNoticePair.mobile,
  memberListPair.laptop,
  memberListPair.mobile,
  memberFormPair.laptop,
  memberFormPair.mobile,
  waitingConfirmPair.laptop,
  waitingConfirmPair.mobile,
  registryNoticePair.laptop,
  registryNoticePair.mobile,
  discardConfirmPair.laptop,
  discardConfirmPair.mobile,
  withdrawConfirmPair.laptop,
  withdrawConfirmPair.mobile,
  systemNoticePair.laptop,
  systemNoticePair.mobile,
  customerWelcomePair.laptop,
  customerWelcomePair.mobile,
  customerMemberPair.laptop,
  customerMemberPair.mobile,
]);

export const layerDismissals: Readonly<Record<string, RenderLayerDismissal>> = Object.freeze({
  [systemNoticePair.laptop.catalogEntry.partKey]: ({dispatchCommand}) =>
    dispatchDeskSystemFailureDismissal(dispatchCommand),
});
