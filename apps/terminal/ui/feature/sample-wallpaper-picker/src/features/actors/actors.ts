import {
  closeLayerCommand,
  isCurrentWorkspaceOwnedByInstance,
  openLayerCommand,
  selectLayers,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state';
import type {ActorDefinition, ActorExecutionContext, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {
  confirmWallpaperCommand,
  isWallpaperId,
  selectPendingWallpaperId,
  selectWallpaperCommand,
  selectWallpaperId,
  type WallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {moduleName} from '../../moduleName';
import {
  confirmWallpaperRequestedCommand,
  wallpaperSystemFailureDismissedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
  startWallpaperPickerCommand,
  type WallpaperSystemOperation,
} from '../commands/commands';
import {createChildDispatchFailureError} from '../../foundations/errors';
import {classifyWallpaperWritePhase, type WallpaperSnapshot} from '../../foundations/writePhase';

const wallpaperSnapshot = (context: ActorExecutionContext): WallpaperSnapshot =>
  Object.freeze({
    confirmed: selectWallpaperId(context.getState()),
    pending: selectPendingWallpaperId(context.getState()),
  });

const dispatchWallpaperChild = async (
  context: ActorExecutionContext,
  input: Readonly<{
    readonly operation: WallpaperSystemOperation;
    readonly requested: WallpaperId;
    readonly dispatch: () => Promise<CommandDispatchResult>;
  }>,
): Promise<void> => {
  const before = wallpaperSnapshot(context);
  let result: CommandDispatchResult | undefined;
  let rejection: unknown;
  try {
    result = await input.dispatch();
  } catch (error) {
    rejection = error;
  }
  const after = wallpaperSnapshot(context);
  if (rejection !== undefined || result?.status !== 'completed') {
    throw createChildDispatchFailureError(context, {
      operation: input.operation,
      phase: classifyWallpaperWritePhase({
        operation: input.operation,
        requested: input.requested,
        before,
        after,
      }),
      result,
      rejection,
    });
  }
};

const noticeLayerId = 'sample.wallpaper.system-notice';

const effectiveWallpaperId = (context: ActorExecutionContext): WallpaperId =>
  selectPendingWallpaperId(context.getState()) ?? selectWallpaperId(context.getState());

export const createWallpaperPickerActor = (): ActorDefinition =>
  defineActor(moduleName, 'wallpaper-picker', [
    onCommand(wallpaperOptionSelectedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const wallpaperId = context.command.payload.wallpaperId;
      if (!isWallpaperId(wallpaperId)) {
        throw new Error('[ui.feature.sample-wallpaper-picker] invalid wallpaper option');
      }
      if (wallpaperId === effectiveWallpaperId(context)) return null;
      await dispatchWallpaperChild(context, {
        operation: 'select',
        requested: wallpaperId,
        dispatch: () => context.dispatchCommand(selectWallpaperCommand, {wallpaperId}),
      });
      return null;
    }),
    onCommand(confirmWallpaperRequestedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const pending = selectPendingWallpaperId(context.getState());
      const confirmed = selectWallpaperId(context.getState());
      if (pending === undefined || pending === confirmed) return null;
      await dispatchWallpaperChild(context, {
        operation: 'confirm',
        requested: pending,
        dispatch: () => context.dispatchCommand(confirmWallpaperCommand, {}),
      });
      return null;
    }),
    onCommand(wallpaperSystemFailureObservedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const hasNotice = selectLayers(context.getState(), 'PRIMARY').some(layer => layer.layerId === noticeLayerId);
      if (hasNotice) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: 'PRIMARY',
        layerId: noticeLayerId,
        partKey: noticeLayerId,
        props: {
          operation: context.command.payload.operation,
          phase: context.command.payload.phase,
        },
        persistence: 'ephemeral',
      });
      return null;
    }),
    onCommand(wallpaperSystemFailureDismissedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: 'PRIMARY',
        layerId: noticeLayerId,
      });
      return null;
    }),
  ]);

export const createWallpaperPickerEntryActor = (): ActorDefinition =>
  defineActor(moduleName, 'wallpaper-picker-entry', [
    onCommand(startWallpaperPickerCommand, async context => {
      const route = context.command.routeContext;
      if (route?.displayMode === undefined || route.workspace === undefined || route.instanceMode === undefined) {
        throw new Error('[ui.feature.sample-wallpaper-picker] stage route context is incomplete');
      }
      let partKey: string | null = null;
      if (route.workspace === 'MAIN' && route.displayMode === 'SECONDARY') {
        partKey = 'sample.wallpaper.host-display';
      } else if (route.instanceMode === 'MASTER' && route.workspace === 'MAIN' && route.displayMode === 'PRIMARY') {
        partKey = 'sample.wallpaper.picker';
      } else if (route.instanceMode === 'SLAVE' && route.workspace === 'BRANCH' && route.displayMode === 'PRIMARY') {
        partKey = 'sample.wallpaper.branch.picker';
      }
      if (partKey === null) throw new Error('[ui.feature.sample-wallpaper-picker] stage route is unavailable');
      await context.dispatchCommand(showScreenCommand, {
        displayMode: route.displayMode,
        containerKey: 'main',
        partKey,
      }, {routeContext: route});
      return Object.freeze({status: 'wallpaper-stage-requested', partKey});
    }),
  ]);
