import {describe, expect, it} from 'vitest';
import {createJourneyUiPort} from '../src/journeyUiPort.js';

describe('createJourneyUiPort', () => {
  it('keeps platform actions injectable and owns the shared keyboard sequence', async () => {
    const events: string[] = [];
    const display = {mode: 'PRIMARY' as const, index: 0 as const};
    const port = createJourneyUiPort({
      click: async (testID, target) => {
        events.push(`click:${target.mode}:${testID}`);
      },
      focusInput: async (testID, target) => {
        events.push(`focus:${target.mode}:${testID}`);
      },
    });

    await port.enterText('sample.staff.password', 'A1', display);
    await port.enterTextAndComplete('sample.staff.operator', 'B2', display);
    await port.completeInput(display);

    expect(events).toEqual([
      'focus:PRIMARY:sample.staff.password',
      'click:PRIMARY:ui.base.input:virtual-keyboard:shift',
      'click:PRIMARY:ui.base.input:virtual-keyboard:text-a',
      'click:PRIMARY:ui.base.input:virtual-keyboard:text-1',
      'focus:PRIMARY:sample.staff.operator',
      'click:PRIMARY:ui.base.input:virtual-keyboard:shift',
      'click:PRIMARY:ui.base.input:virtual-keyboard:text-b',
      'click:PRIMARY:ui.base.input:virtual-keyboard:text-2',
      'click:PRIMARY:ui.base.input:virtual-keyboard:complete',
      'click:PRIMARY:ui.base.input:virtual-keyboard:complete',
    ]);
  });

  it('marks each form field with a safe field-specific journey step', async () => {
    const steps: string[] = [];
    const display = {mode: 'PRIMARY' as const, index: 0 as const};
    const port = createJourneyUiPort({
      click: async () => undefined,
      focusInput: async () => undefined,
      onStep: step => steps.push(step),
    });

    await port.enterFormValues([
      {testID: 'form:member-name', value: 'A'},
      {testID: 'form,unsafe:field', value: 'B'},
    ], display);

    expect(steps).toEqual(['ui.input:form:member-name', 'ui.input:field-2']);
  });
});
