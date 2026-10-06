import {beforeEach, describe, expect, it, vi} from 'vitest';

const {dispatchObservedUiCommand} = vi.hoisted(() => ({dispatchObservedUiCommand: vi.fn()}));
vi.mock('../src/uiAction.js', () => ({dispatchObservedUiCommand}));

import {clickObservedJourneyCommand} from '../journeys/journeyActions.js';

describe('clickObservedJourneyCommand', () => {
  beforeEach(() => dispatchObservedUiCommand.mockReset());

  it('correlates a registered UI click with its command and display context', async () => {
    const click = vi.fn(async () => undefined);
    const server = {};
    dispatchObservedUiCommand.mockResolvedValue(undefined);

    await clickObservedJourneyCommand(
      {server: server as never, sessionId: 'session-1', click},
      {commandName: 'kernel.feature.example.submit', testID: 'feature.submit', display: {mode: 'SECONDARY', index: 1}},
    );

    expect(dispatchObservedUiCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        workspace: 'MAIN',
        displayMode: 'SECONDARY',
        commandName: 'kernel.feature.example.submit',
        timeoutMs: 30_000,
      }),
    );
    const observed = dispatchObservedUiCommand.mock.calls[0]?.[0] as {readonly action: () => Promise<void>} | undefined;
    if (observed === undefined) throw new Error('OBSERVED_UI_COMMAND_NOT_CAPTURED');
    await observed.action();
    expect(click).toHaveBeenCalledExactlyOnceWith('feature.submit', {mode: 'SECONDARY', index: 1});
  });
});
