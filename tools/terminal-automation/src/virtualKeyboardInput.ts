export type TerminalInputDisplay = Readonly<{
  readonly mode: 'PRIMARY' | 'SECONDARY';
  readonly index: 0 | 1;
}>;

export type JourneyFieldValue = Readonly<{readonly testID: string; readonly value: string}>;

type VirtualKeyboardActions<TDisplay extends TerminalInputDisplay> = Readonly<{
  readonly focusInput: (testID: string, display: TDisplay) => Promise<void>;
  readonly click: (testID: string, display: TDisplay) => Promise<void>;
}>;

const keyboardTestId = (key: string): string => `ui.base.input:virtual-keyboard:${key}`;

const keyIdsOf = (value: string): readonly string[] => {
  const keyIds: string[] = [];
  for (const character of value) {
    if (/^[A-Z]$/u.test(character)) {
      keyIds.push('shift', `text-${character.toLowerCase()}`);
    } else if (/^[a-z0-9]$/u.test(character)) {
      keyIds.push(`text-${character}`);
    } else {
      throw new Error('TERMINAL_AUTOMATION_INPUT_CHARACTER_UNSUPPORTED');
    }
  }
  return Object.freeze(keyIds);
};

/**
 * Shared field and virtual-keyboard interaction. Platform adapters own focus,
 * keyboard readiness and physical/Web press evidence; journeys only provide
 * the business field ID and value.
 */
export const createVirtualKeyboardInput = <TDisplay extends TerminalInputDisplay>(
  actions: VirtualKeyboardActions<TDisplay>,
): Readonly<{
  readonly enterText: (testID: string, value: string, display: TDisplay) => Promise<void>;
  readonly enterTextAndComplete: (testID: string, value: string, display: TDisplay) => Promise<void>;
  readonly enterFormValues: (
    fields: readonly JourneyFieldValue[],
    display: TDisplay,
    onField?: (testID: string, index: number) => void,
  ) => Promise<void>;
  readonly completeInput: (display: TDisplay) => Promise<void>;
  readonly completeInputSteps: (count: number, display: TDisplay) => Promise<void>;
}> => {
  const completeInput = (display: TDisplay): Promise<void> => actions.click(keyboardTestId('complete'), display);
  const enterText = async (testID: string, value: string, display: TDisplay): Promise<void> => {
    const keyIds = keyIdsOf(value);
    await actions.focusInput(testID, display);
    for (const keyId of keyIds) await actions.click(keyboardTestId(keyId), display);
  };
  return Object.freeze({
    enterText,
    enterTextAndComplete: async (testID, value, display) => {
      await enterText(testID, value, display);
      await completeInput(display);
    },
    enterFormValues: async (fields, display, onField) => {
      for (const [index, field] of fields.entries()) {
        onField?.(field.testID, index);
        await enterText(field.testID, field.value, display);
        await completeInput(display);
      }
    },
    completeInput,
    completeInputSteps: async (count, display) => {
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('TERMINAL_AUTOMATION_INPUT_STEP_COUNT_INVALID');
      for (let step = 0; step < count; step += 1) await completeInput(display);
    },
  });
};
