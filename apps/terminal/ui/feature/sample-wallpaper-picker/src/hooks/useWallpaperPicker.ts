import {useCallback, useRef} from 'react';
import {
  confirmWallpaperRequestedCommand,
  wallpaperPickerExitRequestedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
  type WallpaperSystemFailurePhase,
  type WallpaperSystemOperation,
} from '../features/commands/commands';
import {logoutCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {
  cancelWallpaperSelectionCommand,
  selectPendingWallpaperId,
  selectWallpaperId,
  type WallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useTrackedCommand,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render';
import type {CommandDefinition, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';

type JsonValue = null | boolean | number | string | readonly JsonValue[] | {readonly [key: string]: JsonValue};

const phaseFromActorResult = (result: CommandDispatchResult | undefined): WallpaperSystemFailurePhase => {
  const phase = result?.actorResults
    .map(actor => actor.error?.details?.phase)
    .find(value => value === 'before-write' || value === 'after-write');
  return phase === 'before-write' || phase === 'after-write' ? phase : 'unknown-write-phase';
};

export const useWallpaperPicker = () => {
  const confirmed = useUiStateSelector(selectWallpaperId);
  const pending = useUiStateSelector(selectPendingWallpaperId);
  const effective = pending ?? confirmed;
  const dispatchCommand = useDispatchCommand();
  const trackedCommand = useTrackedCommand();
  const requestInFlight = trackedCommand.requestInFlight;
  const actionInFlight = useRef(false);
  const canConfirm = pending !== undefined && pending !== confirmed && !requestInFlight;

  const observeSystemFailure = useCallback(
    async (operation: WallpaperSystemOperation, phase: WallpaperSystemFailurePhase): Promise<void> => {
      try {
        await dispatchWithRequestId({
          dispatchCommand,
          definition: wallpaperSystemFailureObservedCommand,
          payload: {operation, phase},
        });
      } catch {
        // useDispatchCommand has already emitted the structured rejection diagnostic.
      }
    },
    [dispatchCommand],
  );

  const runAction = useCallback(
    async <TPayload extends JsonValue>({
      definition,
      payload,
      operation,
    }: Readonly<{
      definition: CommandDefinition<TPayload>;
      payload: TPayload;
      operation: WallpaperSystemOperation;
    }>): Promise<CommandDispatchResult | undefined> => {
      if (actionInFlight.current || requestInFlight) return undefined;
      actionInFlight.current = true;
      try {
        return await trackedCommand.run({
          definition,
          payload,
          rejectionPolicy: 'CONSUME',
          onOutcome: (result, outcome) =>
            outcome === 'system-failure' ? observeSystemFailure(operation, phaseFromActorResult(result)) : undefined,
          onRejected: () => observeSystemFailure(operation, 'unknown-write-phase'),
        });
      } finally {
        actionInFlight.current = false;
      }
    },
    [observeSystemFailure, requestInFlight, trackedCommand],
  );

  const selectOption = useCallback(
    (wallpaperId: WallpaperId) =>
      runAction({
        definition: wallpaperOptionSelectedCommand,
        payload: {wallpaperId},
        operation: 'select',
      }),
    [runAction],
  );

  const confirm = useCallback(() => {
    if (!canConfirm || pending === undefined) return undefined;
    return runAction({definition: confirmWallpaperRequestedCommand, payload: {}, operation: 'confirm'});
  }, [canConfirm, pending, runAction]);

  const logout = useCallback(() => {
    if (requestInFlight) return undefined;
    return trackedCommand.run({
      definition: logoutCommand,
      payload: {},
      rejectionPolicy: 'RETHROW',
      onOutcome: (_result, outcome) =>
        outcome === 'system-failure' ? observeSystemFailure('logout', 'unknown-write-phase') : undefined,
      onRejected: () => observeSystemFailure('logout', 'unknown-write-phase'),
    });
  }, [observeSystemFailure, requestInFlight, trackedCommand]);

  const exit = useCallback(
    async () => {
      if (requestInFlight) return undefined;
      const result =
        pending === undefined
          ? undefined
          : await runAction({
              definition: cancelWallpaperSelectionCommand,
              payload: {},
              operation: 'cancel',
            });
      if (pending !== undefined && result?.status !== 'completed') return result;
      return dispatchWithRequestId({
        dispatchCommand,
        definition: wallpaperPickerExitRequestedCommand,
        payload: {},
      });
    },
    [dispatchCommand, pending, requestInFlight, runAction],
  );

  return {confirmed, effective, requestInFlight, canConfirm, selectOption, confirm, logout, exit};
};
