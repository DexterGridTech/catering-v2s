import {describe, expect, it, vi} from 'vitest';
import {createVirtualKeyboardInput} from '../src/virtualKeyboardInput.js';

const primary = Object.freeze({mode: 'PRIMARY' as const, index: 0 as const});

describe('createVirtualKeyboardInput', () => {
  it('focuses the named field and sends a complete character sequence through the platform adapter', async () => {
    const focusInput = vi.fn(async () => undefined);
    const click = vi.fn(async () => undefined);
    const input = createVirtualKeyboardInput({focusInput, click});

    await input.enterText('sample.auth.login:operator-name', 'A01', primary);
    await input.completeInput(primary);

    expect(focusInput).toHaveBeenCalledExactlyOnceWith('sample.auth.login:operator-name', primary);
    expect(click.mock.calls).toEqual([
      ['ui.base.input:virtual-keyboard:shift', primary],
      ['ui.base.input:virtual-keyboard:text-a', primary],
      ['ui.base.input:virtual-keyboard:text-0', primary],
      ['ui.base.input:virtual-keyboard:text-1', primary],
      ['ui.base.input:virtual-keyboard:complete', primary],
    ]);
  });

  it('rejects unsupported characters before focusing or partially entering a value', async () => {
    const focusInput = vi.fn(async () => undefined);
    const click = vi.fn(async () => undefined);
    const input = createVirtualKeyboardInput({focusInput, click});

    await expect(input.enterText('member:name', 'valid值', primary)).rejects.toThrow(
      'TERMINAL_AUTOMATION_INPUT_CHARACTER_UNSUPPORTED',
    );
    expect(focusInput).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('enters a field value and completes the field in one shared driver action', async () => {
    const events: string[] = [];
    const input = createVirtualKeyboardInput({
      focusInput: async testID => {
        events.push(`focus:${testID}`);
      },
      click: async testID => {
        events.push(`click:${testID}`);
      },
    });

    await input.enterTextAndComplete('sample.auth.login:operator-name', 'A01', primary);

    expect(events).toEqual([
      'focus:sample.auth.login:operator-name',
      'click:ui.base.input:virtual-keyboard:shift',
      'click:ui.base.input:virtual-keyboard:text-a',
      'click:ui.base.input:virtual-keyboard:text-0',
      'click:ui.base.input:virtual-keyboard:text-1',
      'click:ui.base.input:virtual-keyboard:complete',
    ]);
  });

  it('enters ordered form fixture values and owns repeated focus progression', async () => {
    const events: string[] = [];
    const input = createVirtualKeyboardInput({
      focusInput: async testID => { events.push(`focus:${testID}`); },
      click: async testID => { events.push(`click:${testID}`); },
    });

    await input.enterFormValues([
      {testID: 'form:name', value: 'A'},
      {testID: 'form:phone', value: '1'},
    ], primary);
    await input.completeInputSteps(2, primary);

    expect(events.filter(event => event.startsWith('focus:'))).toEqual(['focus:form:name', 'focus:form:phone']);
    expect(events.filter(event => event === 'click:ui.base.input:virtual-keyboard:complete')).toHaveLength(4);
  });

  it('rejects invalid focus progression counts before sending any keyboard action', async () => {
    const click = vi.fn(async () => undefined);
    const input = createVirtualKeyboardInput({focusInput: vi.fn(async () => undefined), click});

    await expect(input.completeInputSteps(-1, primary)).rejects.toThrow(
      'TERMINAL_AUTOMATION_INPUT_STEP_COUNT_INVALID',
    );
    expect(click).not.toHaveBeenCalled();
  });
});
