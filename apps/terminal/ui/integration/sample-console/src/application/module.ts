import {createUiRuntimeModule, type UiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {createStartupReadyActor as createSharedStartupReadyActor} from '@catering-v2s/ui-base-integration-assembly';
import {reconcileStageCommand, startupReadyCommand} from '../declarations/commands';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createOwnerStageRouteActor} from '../features/actors/ownerStageRouteActor';
import {moduleKind, moduleName} from '../moduleName';
import {sampleAdminTestPart} from '../declarations/parts';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {selectSampleConsoleBusinessInterlockActive} from '../selectors/selectSampleConsoleBusinessInterlockActive';
import {selectSampleConsoleBusinessMutationAllowed} from '../selectors/selectSampleConsoleBusinessMutationAllowed';
import {selectSampleConsoleRouteStage} from '../selectors/selectSampleConsoleRouteStage';
import {selectSampleConsoleStaffLoginAllowed} from '../selectors/selectSampleConsoleStaffLoginAllowed';

/** The integration owns the one ordered activation → staff → sample stage decision. */
export const createSampleConsoleModule = (surfaceForm: SurfaceForm): UiRuntimeModule => {
  const ownerStageRoute = createOwnerStageRouteActor(surfaceForm);
  const actors = [
    createSharedStartupReadyActor({
      moduleName,
      command: startupReadyCommand,
      message: 'Primary surface readiness accepted by sample console',
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
        selectSampleConsoleBusinessInterlockActive,
        selectSampleConsoleBusinessMutationAllowed,
        selectSampleConsoleRouteStage,
        selectSampleConsoleStaffLoginAllowed,
      ],
      stateSlices: [],
      install: ownerStageRoute.install,
    },
    {parts: [sampleAdminTestPart]},
  );
};
