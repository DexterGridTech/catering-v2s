import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {createConfirmWithoutPendingError, createInvalidWallpaperIdError} from '../../foundations/errors';
import {moduleName} from '../../moduleName';
import {selectPendingWallpaperId, selectWallpaperId, isWallpaperId} from '../../selectors/selectors';
import {wallpaperActions} from '../slices/slice';
import {cancelWallpaperSelectionCommand, confirmWallpaperCommand, selectWallpaperCommand} from '../commands/commands';
import type {WallpaperId} from '../../types/types';

const readWallpaperId = (context: ActorExecutionContext): WallpaperId => {
  const payload: unknown = context.command.payload;
  const value =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? Reflect.get(payload, 'wallpaperId')
      : undefined;
  if (!isWallpaperId(value)) throw createInvalidWallpaperIdError(context);
  return value;
};

export const createSelectionActor = (): ActorDefinition =>
  defineActor(moduleName, 'selection', [
    onCommand(selectWallpaperCommand, context => {
      const wallpaperId = readWallpaperId(context);
      context.dispatchAction(wallpaperActions.setPending(wallpaperId));
      return null;
    }),
    onCommand(confirmWallpaperCommand, context => {
      const pending = selectPendingWallpaperId(context.getState());
      const confirmed = selectWallpaperId(context.getState());
      if (pending === undefined || pending === confirmed) {
        throw createConfirmWithoutPendingError(context);
      }
      context.dispatchAction(wallpaperActions.confirmPending());
      return null;
    }),
    onCommand(cancelWallpaperSelectionCommand, context => {
      context.dispatchAction(wallpaperActions.clearPending());
      return null;
    }),
  ]);
