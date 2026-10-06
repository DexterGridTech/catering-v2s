import {createTestId} from '@catering-v2s/ui-base-primitives';
import {moduleName} from '../moduleName';

const activation = (element: string) => createTestId(moduleName, 'activation', {element: element});
const activationAdmin = (element: string) => createTestId(moduleName, 'admin', {element: element});
const activationGuide = (element: string) => createTestId(moduleName, 'guide', {element: element});

export const terminalActivationTestIds = Object.freeze({
  screen: activation('screen'),
  scroll: activation('scroll'),
  title: activation('title'),
  serviceSpace: activation('service-space'),
  codeInput: activation('code-input'),
  codeLabel: activation('code-label'),
  actions: activation('actions'),
  submit: activation('submit'),
  result: activation('result'),
  adminScreen: activationAdmin('screen'),
  adminScroll: activationAdmin('scroll'),
  adminTitle: activationAdmin('title'),
  adminCard: activationAdmin('card'),
  adminState: activationAdmin('state'),
  adminProjectionStatus: activationAdmin('projection-status'),
  adminTerminal: activationAdmin('terminal'),
  adminStore: activationAdmin('store'),
  adminWorkspace: activationAdmin('workspace'),
  adminConnection: activationAdmin('connection'),
  adminLatency: activationAdmin('latency'),
  adminLastError: activationAdmin('last-error'),
  adminCancel: activationAdmin('cancel'),
  adminResult: activationAdmin('result'),
  guideScreen: activationGuide('screen'),
  guideTitle: activationGuide('title'),
  guideMessage: activationGuide('message'),
});
