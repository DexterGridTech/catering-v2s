import type {Page} from 'playwright';
import type {AndroidAutomationConnection} from './androidAutomationConnection.js';

export type MainJourneyShape = 'mobile' | 'dual';

/** TestExpoApp owns these surface nodes under the dev-host module namespace. */
export const testExpoHostPrefix = 'ui.base.dev-host:test-expo';

/** Prepares the shared Expo test host surface before a Web journey starts. */
export const prepareWebJourneySurface = async (input: Readonly<{
  readonly page: Page;
  readonly shape: MainJourneyShape;
}>): Promise<void> => {
  const primary = input.page.getByTestId(`${testExpoHostPrefix}:surface:PRIMARY`);
  await primary.waitFor({state: 'visible', timeout: 15_000});
  const expectedForm = input.shape === 'mobile' ? 'mobile' : 'laptop';
  const form = input.page.getByTestId(`${testExpoHostPrefix}:surface-form:${expectedForm}`);
  if ((await form.getAttribute('aria-checked')) !== 'true') {
    throw new Error('TERMINAL_AUTOMATION_WEB_SURFACE_FORM_MISMATCH');
  }
  if (input.shape === 'dual') {
    await input.page.getByTestId(`${testExpoHostPrefix}:surface-mode:dual`).click();
    await input.page.getByTestId(`${testExpoHostPrefix}:surface:SECONDARY`).waitFor({state: 'visible', timeout: 10_000});
  }
};

/** Checks that an Android main journey's requested display topology is present. */
export const prepareAndroidJourneySurface = async (
  connection: AndroidAutomationConnection,
  shape: MainJourneyShape,
): Promise<void> => {
  const displays = await connection.discoverDisplays();
  if (shape === 'dual' && displays.secondary === null) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_DUAL_DISPLAY_REQUIRED');
  }
};
