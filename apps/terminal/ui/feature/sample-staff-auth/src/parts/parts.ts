import {definePartPair, type RenderLayerDismissal} from '@catering-v2s/ui-base-render';
import {AuthNotice as LaptopAuthNotice} from '../components/laptop/AuthNotice';
import {AuthNotice as MobileAuthNotice} from '../components/mobile/AuthNotice';
import {AuthSystemNotice as LaptopAuthSystemNotice} from '../components/laptop/AuthSystemNotice';
import {AuthSystemNotice as MobileAuthSystemNotice} from '../components/mobile/AuthSystemNotice';
import {StaffLogin as LaptopStaffLogin} from '../components/laptop/StaffLogin';
import {StaffLogin as MobileStaffLogin} from '../components/mobile/StaffLogin';
import {LmsAuthGuide as LaptopLmsAuthGuide, LspAuthGuide as LaptopLspAuthGuide} from '../components/laptop/AuthGuide';
import {LmsAuthGuide as MobileLmsAuthGuide, LspAuthGuide as MobileLspAuthGuide} from '../components/mobile/AuthGuide';
import {dispatchAuthSystemFailureDismissal} from '../foundations/systemFailureDismissal';

const primary = ['PRIMARY'] as const;
const mainContainer = ['main'] as const;
const main = ['MAIN'] as const;
const master = ['MASTER'] as const;
const slave = ['SLAVE'] as const;

const lmsGuidePair = definePartPair({
  partKey: 'sample.auth.guide.lms',
  containerKeys: mainContainer,
  displayModes: ['SECONDARY'] as const,
  workspaces: main,
  instanceModes: slave,
  title: '主屏登录引导',
  description: '主机店员尚未登录时在副机显示只读引导',
  components: {laptop: LaptopLmsAuthGuide, mobile: MobileLmsAuthGuide},
});

const lspGuidePair = definePartPair({
  partKey: 'sample.auth.guide.lsp',
  containerKeys: mainContainer,
  displayModes: ['PRIMARY'] as const,
  workspaces: ['BRANCH'] as const,
  instanceModes: slave,
  title: '主机登录引导',
  description: '副机店员尚未获得主机登录资格时显示只读引导',
  components: {laptop: LaptopLspAuthGuide, mobile: MobileLspAuthGuide},
});

const loginPair = definePartPair({
  partKey: 'sample.auth.login',
  containerKeys: mainContainer,
  displayModes: primary,
  workspaces: main,
  instanceModes: master,
  title: '店员登录',
  description: '店员使用工号和密码进入会员登记工作台',
  components: {laptop: LaptopStaffLogin, mobile: MobileStaffLogin},
});

const noticePair = definePartPair({
  partKey: 'sample.auth.notice',
  containerKeys: [] as const,
  displayModes: primary,
  workspaces: main,
  instanceModes: master,
  title: '登录失败提示',
  description: '向店员说明登录失败原因并提供关闭动作',
  layerTier: 'alert',
  components: {laptop: LaptopAuthNotice, mobile: MobileAuthNotice},
});

const systemNoticePair = definePartPair({
  partKey: 'sample.auth.system-notice',
  containerKeys: [] as const,
  displayModes: primary,
  workspaces: main,
  instanceModes: master,
  title: '系统失败提示',
  description: '向店员说明登录或退出的基础设施失败，并允许继续操作',
  layerTier: 'alert',
  components: {laptop: LaptopAuthSystemNotice, mobile: MobileAuthSystemNotice},
});

export const parts = Object.freeze([
  lmsGuidePair.laptop,
  lmsGuidePair.mobile,
  lspGuidePair.laptop,
  lspGuidePair.mobile,
  loginPair.laptop,
  loginPair.mobile,
  noticePair.laptop,
  noticePair.mobile,
  systemNoticePair.laptop,
  systemNoticePair.mobile,
]);

export const layerDismissals: Readonly<Record<string, RenderLayerDismissal>> = Object.freeze({
  [systemNoticePair.laptop.catalogEntry.partKey]: ({dispatchCommand}) =>
    dispatchAuthSystemFailureDismissal(dispatchCommand),
});
