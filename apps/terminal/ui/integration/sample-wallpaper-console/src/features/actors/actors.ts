import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {isCurrentWorkspaceOwnedByInstance, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {wallpaperPickerExitRequestedCommand} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {moduleName} from '../../moduleName';

/** The feature owns choosing a wallpaper; leaving that screen is integration navigation only. */
export const createWallpaperConsoleExitActor = (): ActorDefinition =>
  defineActor(moduleName, 'wallpaper-picker-exit', [
    onCommand(wallpaperPickerExitRequestedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const route = context.command.routeContext;
      const partKey =
        route?.workspace === 'BRANCH' && route.instanceMode === 'SLAVE' && route.displayMode === 'PRIMARY'
          ? 'sample.wallpaper.branch.home'
          : route?.workspace === 'MAIN' && route.instanceMode === 'MASTER' && route.displayMode === 'PRIMARY'
            ? 'sample.wallpaper.home'
            : null;
      if (partKey === null || route === null) return null;
      await context.dispatchCommand(
        showScreenCommand,
        {workspace: route.workspace, displayMode: 'PRIMARY', containerKey: 'main', partKey},
        {routeContext: route},
      );
      return Object.freeze({status: 'wallpaper-selection-exited', partKey});
    }),
  ]);
