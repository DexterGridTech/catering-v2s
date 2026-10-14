import {createUiRuntimeModule, type UiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {createStartupReadyActor as createSharedStartupReadyActor} from '@catering-v2s/ui-base-integration-assembly';
import {reconcileStageCommand, startupReadyCommand} from '../declarations/commands';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createWallpaperConsoleExitActor} from '../features/actors/wallpaperConsoleExitActor';
import {createOwnerStageRouteActor} from '../features/actors/ownerStageRouteActor';
import {moduleKind, moduleName} from '../moduleName';
import {parts} from '../declarations/parts';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {selectSampleWallpaperConsoleBusinessInterlockActive} from '../selectors/selectSampleWallpaperConsoleBusinessInterlockActive';
import {selectSampleWallpaperConsoleBusinessMutationAllowed} from '../selectors/selectSampleWallpaperConsoleBusinessMutationAllowed';
import {selectSampleWallpaperConsoleRouteStage} from '../selectors/selectSampleWallpaperConsoleRouteStage';
import {selectSampleWallpaperConsoleStaffLoginAllowed} from '../selectors/selectSampleWallpaperConsoleStaffLoginAllowed';

export const createSampleWallpaperConsoleModule = (surfaceForm: SurfaceForm): UiRuntimeModule => {
  const ownerStageRoute = createOwnerStageRouteActor(surfaceForm);
  const actors = [
    createWallpaperConsoleExitActor(),
    createSharedStartupReadyActor({
      moduleName,
      command: startupReadyCommand,
      message: 'Primary sample2 surface readiness accepted by wallpaper console',
    }),
    ownerStageRoute.actor,
  ] as const;
  return createUiRuntimeModule(
    {
      moduleName,
      kind: moduleKind,
      dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
      commandDefinitions: [startupReadyCommand, reconcileStageCommand],
      actorDefinitions: actors,
      selectorDefinitions: [
        selectSampleWallpaperConsoleBusinessInterlockActive,
        selectSampleWallpaperConsoleBusinessMutationAllowed,
        selectSampleWallpaperConsoleRouteStage,
        selectSampleWallpaperConsoleStaffLoginAllowed,
      ],
      stateSlices: [],
      install: ownerStageRoute.install,
    },
    {parts},
  );
};
