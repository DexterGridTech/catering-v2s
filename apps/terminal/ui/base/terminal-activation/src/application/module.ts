import {createUiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import type {SurfaceForm, TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {needToActivateTerminalCommand} from '../declarations/commands';
import {moduleKind, moduleName} from '../moduleName';
import {selectActivationStatusView} from '../selectors/selectActivationStatusView';
import {createTerminalActivationParts} from '../declarations/parts';
import {createTerminalActivationRouteActor} from '../features/actors/terminalActivationRouteActor';

/** The activation owner routes its public UI intent using its own declared presentation parts. */
export const createTerminalActivationModule = (serverSpaces: TransportServerConfig, surfaceForm: SurfaceForm) => {
  const parts = createTerminalActivationParts(serverSpaces);
  const activationRouteActor = createTerminalActivationRouteActor(parts, surfaceForm);

  return createUiRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: [needToActivateTerminalCommand],
    selectorDefinitions: [selectActivationStatusView],
    actorDefinitions: [activationRouteActor],
    stateSlices: [],
  }, {parts});
};
