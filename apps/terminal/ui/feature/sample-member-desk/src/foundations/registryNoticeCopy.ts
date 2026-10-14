import type {RegistryNoticeReason} from '../declarations/commands';

export const registryNoticeMessage = (reasonCode: RegistryNoticeReason): string =>
  reasonCode === 'customer-rejected' ? '顾客拒绝了登记' : '登记服务暂时不可用，请重试';
