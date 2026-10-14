import {showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {startWallpaperPickerCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';

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
      await context.dispatchCommand(
        showScreenCommand,
        {
          workspace: route.workspace,
          displayMode: route.displayMode,
          containerKey: 'main',
          partKey,
        },
        {routeContext: route},
      );
      return Object.freeze({status: 'wallpaper-stage-requested', partKey});
    }),
  ]);
