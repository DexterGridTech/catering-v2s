import {describe, expect, it, vi} from 'vitest';
import type {Page} from 'playwright';
import type {AndroidAutomationConnection} from '../src/androidAutomationConnection.js';
import type {AutomationDriverServer} from '../src/server.js';

const webClick = vi.hoisted(() => vi.fn(async () => undefined));
const webFocus = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../src/webInput.js', () => ({clickRegisteredWebNode: webClick, focusRegisteredWebInput: webFocus}));

import {createAndroidJourneyUiPort, createWebJourneyUiPort} from '../src/journeyUiPort.js';
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
    expect(webClick).toHaveBeenNthCalledWith(2, expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:shift'}));
    expect(webClick).toHaveBeenNthCalledWith(3, expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:text-a'}));
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
    expect(tapRegisteredNode).toHaveBeenNthCalledWith(2, expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:shift'}));
    expect(tapRegisteredNode).toHaveBeenNthCalledWith(3, expect.objectContaining({testID: 'ui.base.input:virtual-keyboard:text-a'}));
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
