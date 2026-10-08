import {describe, expect, it, vi} from 'vitest';
import type {Page} from 'playwright';
import type {AndroidAutomationConnection} from '../src/androidAutomationConnection.js';
import type {AutomationDriverServer} from '../src/server.js';

const webClick = vi.hoisted(() => vi.fn(async () => undefined));
const webFocus = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../src/webInput.js', () => ({clickRegisteredWebNode: webClick, focusRegisteredWebInput: webFocus}));

import {createAndroidJourneyUiPort, createWebJourneyUiPort} from '../src/journeyUiPort.js';
import type {AndroidJourneyUiPort} from '../src/journeyUiPort.js';
import {prepareAndroidJourneySurface, prepareWebJourneySurface, testExpoHostPrefix} from '../src/journeySurface.js';

describe('platform journey UI ports', () => {
  it('maps Web display roots and leaves registered-node interaction to the driver', async () => {
    webClick.mockClear();
    webFocus.mockClear();
    const page = {getByTestId: (testID: string) => ({root: testID})} as unknown as Page;
    const server = {} as AutomationDriverServer;
    const ui = createWebJourneyUiPort({server, sessionId: 'session-1', page});

    await ui.click('member.submit', {mode: 'SECONDARY', index: 1});
    await ui.enterText('member.name', 'A1', {mode: 'SECONDARY', index: 1});

    expect(webClick).toHaveBeenNthCalledWith(1, {
      server,
      sessionId: 'session-1',
      surfaceRoot: {root: `${testExpoHostPrefix}:surface:SECONDARY`},
      testID: 'member.submit',
      surface: 'SECONDARY',
      displayIndex: 1,
    });
    expect(webFocus).toHaveBeenCalledWith({
      server,
      sessionId: 'session-1',
      surfaceRoot: {root: `${testExpoHostPrefix}:surface:SECONDARY`},
      testID: 'member.name',
      surface: 'SECONDARY',
      displayIndex: 1,
    });
    expect(webClick).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:shift'}),
    );
    expect(webClick).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:text-a'}),
    );
  });

  it('maps Android display names and keyboard input to registered taps', async () => {
    const tapRegisteredNode = vi.fn(async () => undefined);
    const tapRegisteredInput = vi.fn(async () => undefined);
    const connection = {tapRegisteredNode, tapRegisteredInput} as unknown as AndroidAutomationConnection;
    const ui = createAndroidJourneyUiPort({connection, sessionId: 'session-2'});

    await ui.click('member.submit', {mode: 'SECONDARY', index: 1});
    await ui.enterText('member.name', 'A1', {mode: 'PRIMARY', index: 0});

    expect(tapRegisteredNode).toHaveBeenCalledWith({
      sessionId: 'session-2',
      testID: 'member.submit',
      surface: 'secondary',
      displayIndex: 1,
    });
    expect(tapRegisteredInput).toHaveBeenCalledWith({
      sessionId: 'session-2',
      testID: 'member.name',
      surface: 'primary',
      displayIndex: 0,
    });
    expect(tapRegisteredNode).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:shift'}),
    );
    expect(tapRegisteredNode).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:text-a'}),
    );
  });

  it('rebuilds Android registered controls for a replacement Runtime session', async () => {
    const tapRegisteredNode = vi.fn(async () => undefined);
    const connection = {
      tapRegisteredNode,
      tapRegisteredInput: vi.fn(async () => undefined),
    } as unknown as AndroidAutomationConnection;
    const resolveSessionId = vi.fn(async (previous: string) => previous === 'session-old' ? 'session-new' : previous);
    const oldPort = createAndroidJourneyUiPort({connection, sessionId: 'session-old', resolveSessionId});
    const currentPort = await oldPort.refreshSession!();

    await currentPort.click('sample.login.submit', {mode: 'PRIMARY', index: 0});

    expect(resolveSessionId).toHaveBeenCalledWith('session-old');
    expect(currentPort.sessionId).toBe('session-new');
    expect(tapRegisteredNode).toHaveBeenCalledWith({
      sessionId: 'session-new',
      testID: 'sample.login.submit',
      surface: 'primary',
      displayIndex: 0,
    });
  });

  it('uses one Android journey port for registered app controls and native system controls', async () => {
    const tapRegisteredNode = vi.fn(async () => undefined);
    const button = {label: 'Update'} as never;
    const waitForButton = vi.fn(async () => button);
    const clickButton = vi.fn(async () => button);
    const tapButton = vi.fn(async () => undefined);
    const setChecked = vi.fn(async () => ({label: 'Allow from this source', checked: true}) as never);
    const pressBack = vi.fn(async () => undefined);
    const acknowledgeImmersiveModeEducation = vi.fn(async () => true);
    const readScreenSummary = vi.fn(async () => 'PACKAGE_COM_ANDROID_SETTINGS');
    const connection = {
      tapRegisteredNode,
      tapRegisteredInput: vi.fn(async () => undefined),
      systemUi: {
        readHierarchy: vi.fn(async () => '<hierarchy/>'),
        readScreenSummary,
        waitForButton,
        clickButton,
        tapButton,
        setChecked,
        pressBack,
        acknowledgeImmersiveModeEducation,
      },
    } as unknown as AndroidAutomationConnection;
    const onStep = vi.fn();
    const ui: AndroidJourneyUiPort = createAndroidJourneyUiPort({connection, sessionId: 'session-android', onStep});

    await ui.click('update.install', {mode: 'PRIMARY', index: 0});
    const installerButton = await ui.clickSystemButton({labels: ['Update'], timeoutMs: 5_000, allowedPackagePrefixes: [
      'com.google.android.packageinstaller',
    ]});
    await ui.waitForSystemButton({labels: ['Update'], timeoutMs: 5_000, allowedPackagePrefixes: ['com.google.android.packageinstaller']});
    await ui.setSystemChecked({labels: ['Allow from this source'], checked: true, timeoutMs: 5_000});
    await ui.pressSystemBack();
    await expect(ui.acknowledgeImmersiveModeEducation()).resolves.toBe(true);
    await ui.readSystemScreenSummary();

    expect(tapRegisteredNode).toHaveBeenCalledWith({
      sessionId: 'session-android',
      testID: 'update.install',
      surface: 'primary',
      displayIndex: 0,
    });
    expect(clickButton).toHaveBeenCalledWith({labels: ['Update'], timeoutMs: 5_000, allowedPackagePrefixes: [
      'com.google.android.packageinstaller',
    ]});
    expect(onStep).toHaveBeenCalledWith('ui.system.click');
    expect(onStep).toHaveBeenCalledWith('ui.system.click.complete');
    expect(onStep).toHaveBeenCalledWith('ui.system.wait-button');
    expect(onStep).toHaveBeenCalledWith('ui.system.wait-button.complete');
    expect(onStep).toHaveBeenCalledWith('ui.system.set-checked');
    expect(onStep).toHaveBeenCalledWith('ui.system.set-checked.complete');
    expect(onStep).toHaveBeenCalledWith('ui.system.back');
    expect(onStep).toHaveBeenCalledWith('ui.system.back.complete');
    expect(onStep).toHaveBeenCalledWith('ui.system.acknowledge-fullscreen-education');
    expect(onStep).toHaveBeenCalledWith('ui.system.acknowledge-fullscreen-education.complete');
    expect(onStep).toHaveBeenCalledWith('ui.system.screen-summary');
    expect(onStep).toHaveBeenCalledWith('ui.system.screen-summary.complete');
    expect(waitForButton).toHaveBeenCalledWith(['Update'], 5_000, undefined, ['com.google.android.packageinstaller'], undefined);
    expect(tapButton).not.toHaveBeenCalled();
    expect(pressBack).toHaveBeenCalledOnce();
    expect(acknowledgeImmersiveModeEducation).toHaveBeenCalledOnce();
    expect(readScreenSummary).toHaveBeenCalledOnce();
    expect(setChecked).toHaveBeenCalledWith({
      labels: ['Allow from this source'],
      checked: true,
      timeoutMs: 5_000,
    });
  });

  it('records and propagates a failed native system action without hiding the driver error', async () => {
    const onStep = vi.fn();
    const connection = {
      tapRegisteredNode: vi.fn(async () => undefined),
      tapRegisteredInput: vi.fn(async () => undefined),
      systemUi: {
        clickButton: vi.fn(async () => { throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_STALE'); }),
      },
    } as unknown as AndroidAutomationConnection;
    const ui = createAndroidJourneyUiPort({connection, sessionId: 'session-android', onStep});

    await expect(ui.clickSystemButton({labels: ['Update'], timeoutMs: 5_000})).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_STALE',
    );
    expect(onStep).toHaveBeenCalledWith('ui.system.click');
    expect(onStep).toHaveBeenCalledWith('ui.system.click.failed');
    expect(onStep).not.toHaveBeenCalledWith('ui.system.click.complete');
  });

  it('selects the requested Expo form and waits for the required displays', async () => {
    const calls: string[] = [];
    const page = {
      getByTestId: (testID: string) => ({
        waitFor: async (options: {state: string; timeout: number}) => {
          calls.push(`wait:${testID}:${options.state}:${options.timeout}`);
        },
        getAttribute: async (name: string) => {
          calls.push(`attribute:${testID}:${name}`);
          return 'true';
        },
        click: async () => {
          calls.push(`click:${testID}`);
        },
      }),
    } as unknown as Page;
    await prepareWebJourneySurface({page, shape: 'dual'});
    expect(calls).toEqual([
      `wait:${testExpoHostPrefix}:surface:PRIMARY:visible:15000`,
      `attribute:${testExpoHostPrefix}:surface-form:laptop:aria-checked`,
      `click:${testExpoHostPrefix}:surface-mode:dual`,
      `wait:${testExpoHostPrefix}:surface:SECONDARY:visible:10000`,
    ]);
  });

  it('rejects a dual Android journey if the secondary display is absent', async () => {
    const connection = {discoverDisplays: vi.fn(async () => ({primary: {}, secondary: null}))};
    await expect(prepareAndroidJourneySurface(connection as never, 'dual')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_DUAL_DISPLAY_REQUIRED',
    );
    expect(connection.discoverDisplays).toHaveBeenCalledOnce();
  });
});
