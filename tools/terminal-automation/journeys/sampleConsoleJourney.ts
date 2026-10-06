import type {AutomationDriverServer} from '../src/server.js';
import {terminalAutomationMemberFixture} from '../fixtures/member.js';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import {readSelector, waitForSelector} from '../src/selectorObservation.js';
import type {JourneyDisplay} from '../src/journeyUiPort.js';
import {loginSampleStaff} from './sampleStaffLogin.js';
import type {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

type JourneyDiagnostics = ReturnType<typeof createJourneyFailureDiagnostics>;
import {
  clickObservedJourneyCommand,
  dispatchObservedJourneyCommand as dispatchObserved,
  waitForJourneyScreen as waitForScreen,
} from './journeyActions.js';

type Display = JourneyDisplay;

const waitForMainScreen = (port: SampleConsoleJourneyPort, display: Display, expected: string): Promise<void> =>
  waitForScreen(port.server, port.sessionId, display, expected);

export type SampleConsoleJourneyPort = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly diagnostics?: JourneyDiagnostics;
  readonly click: (testID: string, display: Display) => Promise<void>;
  readonly enterTextAndComplete: (testID: string, value: string, display: Display) => Promise<void>;
  readonly enterFormValues: (
    fields: readonly Readonly<{readonly testID: string; readonly value: string}>[],
    display: Display,
  ) => Promise<void>;
  readonly completeInput: (display: Display) => Promise<void>;
  readonly completeInputSteps: (count: number, display: Display) => Promise<void>;
}>;

export type SampleConsoleJourneyInput = Readonly<{
  readonly runId: string;
  readonly shape: 'mobile' | 'dual';
  readonly caseName: 'normal' | 'reject-retry' | 'abandon' | 'withdraw' | 'render-smoke';
  readonly age?: 'empty' | '37';
}>;

const fail = (code: string): never => {
  throw new Error(code);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const waitForLayer = async (port: SampleConsoleJourneyPort, display: Display, expected: string): Promise<void> => {
  await waitForSelector(
    port.server,
    port.sessionId,
    'kernel.base.ui-state.selectLayers',
    [display.mode, 'MAIN'],
    value => Array.isArray(value) && value.some(layer => isRecord(layer) && layer.partKey === expected),
  );
};

const assertBusinessEmpty = async (port: SampleConsoleJourneyPort): Promise<void> => {
  const members = await readSelector(
    port.server,
    port.sessionId,
    'kernel.feature.sample-member-registry.selectMembers',
    [],
  );
  const pending = await readSelector(
    port.server,
    port.sessionId,
    'kernel.feature.sample-member-registry.selectPendingMember',
    [],
  );
  if (!Array.isArray(members) || members.length !== 0 || pending !== null) {
    fail('TERMINAL_AUTOMATION_MEMBER_EMPTY_STATE_MISMATCH');
  }
};

const assertPending = async (
  port: SampleConsoleJourneyPort,
  expected: Readonly<{readonly name: string; readonly phone: string}>,
): Promise<void> => {
  const value = await waitForSelector(
    port.server,
    port.sessionId,
    'kernel.feature.sample-member-registry.selectPendingMember',
    [],
    current => isRecord(current) && current.name === expected.name && current.phone === expected.phone,
  );
  if (!isRecord(value) || typeof value.operationId !== 'string' || value.operationId.length === 0) {
    fail('TERMINAL_AUTOMATION_PENDING_MEMBER_INVALID');
  }
};

const assertMemberRegistered = async (
  port: SampleConsoleJourneyPort,
  expected: Readonly<{readonly name: string; readonly phone: string; readonly age?: number}>,
): Promise<void> => {
  const value = await waitForSelector(
    port.server,
    port.sessionId,
    'kernel.feature.sample-member-registry.selectMembers',
    [],
    current =>
      Array.isArray(current) &&
      current.some(member => isRecord(member) && member.name === expected.name && member.phone === expected.phone),
  );
  if (!Array.isArray(value)) return fail('TERMINAL_AUTOMATION_MEMBER_LIST_INVALID');
  const matches = value.filter(
    member => isRecord(member) && member.name === expected.name && member.phone === expected.phone,
  );
  if (matches.length !== 1 || !isRecord(matches[0])) fail('TERMINAL_AUTOMATION_MEMBER_RESULT_NOT_UNIQUE');
  if (expected.age === undefined ? 'age' in matches[0] : matches[0].age !== expected.age) {
    fail('TERMINAL_AUTOMATION_MEMBER_AGE_RESULT_MISMATCH');
  }
  if (
    (await readSelector(
      port.server,
      port.sessionId,
      'kernel.feature.sample-member-registry.selectPendingMember',
      [],
    )) !== null
  ) {
    fail('TERMINAL_AUTOMATION_PENDING_MEMBER_NOT_CLEARED');
  }
};

const submitMember = async (port: SampleConsoleJourneyPort, display: Display): Promise<void> => {
  await clickObservedJourneyCommand(port, {
    commandName: 'kernel.feature.sample-member-registry.submit-member',
    testID: mainSampleTestIds.memberFormSubmit,
    display,
  });
};

const registerMember = async (
  port: SampleConsoleJourneyPort,
  input: SampleConsoleJourneyInput,
  identity: Readonly<{readonly name: string; readonly phone: string}>,
  primary: Display,
  customer: Display,
): Promise<void> => {
  await assertBusinessEmpty(port);
  await clickObservedJourneyCommand(port, {
    commandName: 'ui.feature.sample-member-desk.member-form-opened',
    testID: mainSampleTestIds.memberListEmptyAction,
    display: primary,
  });
  await waitForMainScreen(port, primary, 'sample.desk.member-form');
  await port.enterFormValues(
    [
      {testID: mainSampleTestIds.memberFormName, value: identity.name},
      {testID: mainSampleTestIds.memberFormPhone, value: identity.phone},
    ],
    primary,
  );
  // The form declares two sample-only probe fields after phone. Complete moves
  // phone -> alpha probe -> financial probe; the third press closes the
  // keyboard because the financial probe is the final registered field.
  await port.completeInputSteps(2, primary);
  await submitMember(port, primary);
  await waitForMainScreen(port, customer, 'sample.desk.customer-member');
  await assertPending(port, identity);

  if (input.caseName === 'reject-retry') {
    await clickObservedJourneyCommand(port, {
      commandName: 'kernel.feature.sample-member-registry.reject-member',
      testID: mainSampleTestIds.memberReject,
      display: customer,
    });
    await waitForLayer(port, primary, 'sample.desk.registry-notice');
    await clickObservedJourneyCommand(port, {
      commandName: 'ui.feature.sample-member-desk.member-registration-retry-requested',
      testID: mainSampleTestIds.memberRetry,
      display: primary,
    });
    await waitForMainScreen(port, primary, 'sample.desk.member-form');
    await assertPending(port, identity);
    await submitMember(port, primary);
    await waitForMainScreen(port, customer, 'sample.desk.customer-member');
    await assertPending(port, identity);
  }

  if (input.caseName === 'abandon') {
    await clickObservedJourneyCommand(port, {
      commandName: 'kernel.feature.sample-member-registry.reject-member',
      testID: mainSampleTestIds.memberReject,
      display: customer,
    });
    await waitForLayer(port, primary, 'sample.desk.registry-notice');
    await clickObservedJourneyCommand(port, {
      commandName: 'ui.feature.sample-member-desk.member-registration-abandoned',
      testID: mainSampleTestIds.memberAbandon,
      display: primary,
    });
    await waitForMainScreen(port, primary, 'sample.desk.member-list');
    await assertBusinessEmpty(port);
    return;
  }

  if (input.caseName === 'withdraw') {
    await clickObservedJourneyCommand(port, {
      commandName: 'kernel.base.ui-state.open-layer',
      testID: mainSampleTestIds.memberWithdraw,
      display: primary,
    });
    await waitForLayer(port, primary, 'sample.desk.withdraw-confirm');
    await clickObservedJourneyCommand(port, {
      commandName: 'ui.feature.sample-member-desk.member-submission-withdrawn',
      testID: mainSampleTestIds.memberWithdrawConfirm,
      display: primary,
    });
    await waitForMainScreen(port, primary, 'sample.desk.member-form');
    await assertBusinessEmpty(port);
    return;
  }

  if (input.caseName === 'normal' || input.caseName === 'reject-retry') {
    const age = input.age ?? 'empty';
    if (age === '37') {
      await port.enterFormValues([{testID: mainSampleTestIds.memberAge, value: '37'}], customer);
    }
    await clickObservedJourneyCommand(port, {
      commandName: 'kernel.feature.sample-member-registry.confirm-member',
      testID: mainSampleTestIds.memberConfirm,
      display: customer,
    });
    await assertMemberRegistered(port, {...identity, ...(age === '37' ? {age: 37} : {})});
    await waitForMainScreen(port, primary, 'sample.desk.member-list');
  }
};

export const runSampleConsoleJourney = async (
  port: SampleConsoleJourneyPort,
  input: SampleConsoleJourneyInput,
): Promise<void> => {
  const primary: Display = Object.freeze({mode: 'PRIMARY', index: 0});
  const secondary: Display = Object.freeze({mode: 'SECONDARY', index: 1});
  const customer = input.shape === 'dual' ? secondary : primary;
  const runFixture = terminalAutomationMemberFixture(input.runId);
  await loginSampleStaff(port, {
    operatorName: 'A001',
    passcode: '1111',
    expectedScreen: 'sample.desk.member-list',
  });

  if (input.caseName === 'render-smoke') {
    if (input.shape !== 'dual') return fail('TERMINAL_AUTOMATION_RENDER_SMOKE_REQUIRES_DUAL');
    await waitForMainScreen(port, primary, 'sample.desk.member-list');
    await waitForMainScreen(port, secondary, 'sample.desk.customer-welcome');
    await assertBusinessEmpty(port);
    return;
  }

  if (input.caseName === 'withdraw' && input.shape !== 'dual') {
    return fail('TERMINAL_AUTOMATION_WITHDRAW_REQUIRES_DUAL');
  }
  await registerMember(port, input, runFixture, primary, customer);
};
