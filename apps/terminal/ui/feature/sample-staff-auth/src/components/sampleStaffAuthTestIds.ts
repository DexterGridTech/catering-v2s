import {createTestId, deriveTestId} from '@catering-v2s/ui-base-primitives/test-id';
import {moduleName} from '../moduleName';

const node = (key: string) => createTestId(moduleName, 'automation', {element: 'node', key: key});
const systemNotice = node('sample.auth.system-notice');
const guide = node('sample.auth.guide');

export const sampleStaffAuthTestIds = Object.freeze({
  login: node('sample.auth.login'),
  loginScroll: node('sample.auth.login.scroll'),
  loginTitle: node('sample.auth.login.title'),
  operatorName: node('sample.auth.login.operator-name'),
  operatorNameLabel: node('sample.auth.login.operator-name-label'),
  passcode: node('sample.auth.login.passcode'),
  passcodeLabel: node('sample.auth.login.passcode-label'),
  loginActions: node('sample.auth.login.actions'),
  loginSubmit: node('sample.auth.login.submit'),
  loginLoading: node('sample.auth.login.loading'),
  guide,
  guideMessage: deriveTestId(guide, 'message')!,
  notice: node('sample.auth.notice'),
  noticeCard: node('sample.auth.notice.card'),
  noticeTitle: node('sample.auth.notice.title'),
  noticeMessage: node('sample.auth.notice.message'),
  noticeActions: node('sample.auth.notice.actions'),
  noticeDismiss: node('sample.auth.notice.dismiss'),
  systemNotice,
  systemNoticeCard: deriveTestId(systemNotice, 'card')!,
  systemNoticeActions: deriveTestId(systemNotice, 'actions')!,
  systemNoticeMessage: deriveTestId(systemNotice, 'message')!,
  systemNoticeDismiss: deriveTestId(systemNotice, 'dismiss')!,
});
