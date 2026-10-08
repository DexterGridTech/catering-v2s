import {beforeEach, describe, expect, it, vi} from 'vitest';

const {waitForSelector, dispatchObservedUiCommand} = vi.hoisted(() => ({
  waitForSelector: vi.fn(),
  dispatchObservedUiCommand: vi.fn(),
}));

vi.mock('../src/selectorObservation.js', () => ({waitForSelector}));
vi.mock('../src/uiAction.js', () => ({dispatchObservedUiCommand}));

import {loginSampleStaff, type SampleStaffLoginPort} from '../journeys/sampleStaffLogin.js';

let screenRead = 0;

describe('loginSampleStaff', () => {
  beforeEach(() => {
    screenRead = 0;
    waitForSelector.mockReset();
    dispatchObservedUiCommand.mockReset();
    waitForSelector.mockImplementation(async (_server, _session, selector, _args, matches) => {
      const value = selector === 'kernel.feature.sample-staff-session.selectHostStaffQualification'
        ? {status: 'authenticated', operatorName: 'tester'}
        : {partKey: screenRead++ === 0 ? 'sample.auth.login' : 'sample.home'};
      if (!matches(value)) throw new Error('SAMPLE_STAFF_LOGIN_SELECTOR_MISMATCH');
      return value;
    });
    dispatchObservedUiCommand.mockImplementation(async input => input.action());
  });

  it('performs real field completion, correlates login, and waits for the requested business screen', async () => {
    const click = vi.fn(async () => undefined);
    const enterTextAndComplete = vi.fn(async () => undefined);
    const server = {};
    await loginSampleStaff(
      {server: server as never, sessionId: 'session-1', click, enterTextAndComplete},
      {operatorName: 'tester', passcode: 'secret-input', expectedScreen: 'sample.home'},
    );

    expect(enterTextAndComplete.mock.calls).toEqual([
      ['ui.feature.sample-staff-auth:automation:node:sample.auth.login.operator-name', 'tester', {mode: 'PRIMARY', index: 0}],
      ['ui.feature.sample-staff-auth:automation:node:sample.auth.login.passcode', 'secret-input', {mode: 'PRIMARY', index: 0}],
    ]);
    expect(dispatchObservedUiCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        timeoutMs: 30_000,
      }),
    );
    expect(waitForSelector).toHaveBeenCalledTimes(3);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('fails when the authenticated owner readback does not match the submitted identity', async () => {
    waitForSelector.mockImplementation(async (_server, _session, selector) => {
      if (selector === 'kernel.feature.sample-staff-session.selectHostStaffQualification') {
        return {status: 'authenticated', operatorName: 'different'};
      }
      return {partKey: 'sample.auth.login'};
    });
    await expect(
      loginSampleStaff(
        {
          server: {} as never,
          sessionId: 'session-1',
          click: vi.fn(async () => undefined),
          enterTextAndComplete: vi.fn(async () => undefined),
        },
        {operatorName: 'tester', passcode: 'secret-input', expectedScreen: 'sample.home'},
      ),
    ).rejects.toThrow('TERMINAL_AUTOMATION_STAFF_LOGIN_READBACK_MISMATCH');
  });

  it('rebuilds the session-bound login controls before clicking after a Runtime session replacement', async () => {
    const clickOld = vi.fn(async () => undefined);
    const enterOld = vi.fn(async () => undefined);
    const clickNew = vi.fn(async () => undefined);
    const enterNew = vi.fn(async () => undefined);
    const server = {};
    const refreshedPort = {
      server: server as never,
      sessionId: 'session-2',
      click: clickNew,
      enterTextAndComplete: enterNew,
    };
    const firstPort = {
      server: server as never,
      sessionId: 'session-1',
      click: clickOld,
      enterTextAndComplete: enterOld,
      refreshSession: vi.fn(async () => refreshedPort),
    };
    const result = await loginSampleStaff(firstPort, {
      operatorName: 'tester',
      passcode: 'secret-input',
      expectedScreen: 'sample.home',
    });

    expect(result.sessionId).toBe('session-2');
    expect(enterOld).not.toHaveBeenCalled();
    expect(enterNew).toHaveBeenCalledTimes(2);
    expect(clickOld).not.toHaveBeenCalled();
    expect(clickNew).toHaveBeenCalledTimes(1);
    expect(dispatchObservedUiCommand).toHaveBeenCalledWith(expect.objectContaining({sessionId: 'session-2'}));
    expect(clickNew).toHaveBeenCalledWith('ui.feature.sample-staff-auth:automation:node:sample.auth.login.submit', {
      mode: 'PRIMARY',
      index: 0,
    });
  });

  it('rebinds once when the old session closes after refresh but before the login action starts', async () => {
    const clickOld = vi.fn(async () => undefined);
    const clickNew = vi.fn(async () => undefined);
    const enterOld = vi.fn(async () => undefined);
    const enterNew = vi.fn(async () => undefined);
    const server = {};
    const currentPort: SampleStaffLoginPort = {
      server: server as never,
      sessionId: 'session-2',
      click: clickNew,
      enterTextAndComplete: enterNew,
      refreshSession: async () => currentPort,
    };
    const firstPort = {
      server: server as never,
      sessionId: 'session-1',
      click: clickOld,
      enterTextAndComplete: enterOld,
      refreshSession: vi.fn(async () => currentPort),
    };
    dispatchObservedUiCommand.mockImplementationOnce(async () => {
      throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION');
    });

    const result = await loginSampleStaff(firstPort, {
      operatorName: 'tester',
      passcode: 'secret-input',
      expectedScreen: 'sample.home',
    });

    expect(result.sessionId).toBe('session-2');
    expect(enterOld).not.toHaveBeenCalled();
    expect(enterNew).toHaveBeenCalledTimes(2);
    expect(clickOld).not.toHaveBeenCalled();
    expect(clickNew).toHaveBeenCalledTimes(1);
    expect(dispatchObservedUiCommand).toHaveBeenCalledTimes(2);
  });
});
