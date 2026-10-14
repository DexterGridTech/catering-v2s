import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {selectScreen, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import type {CommandRouteContext, SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {needToActivateTerminalCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import type {createTerminalActivationParts} from '../../declarations/parts';

const activationPartFor = (
  parts: ReturnType<typeof createTerminalActivationParts>,
  surfaceForm: SurfaceForm,
  route: CommandRouteContext,
): string | null => {
  const {displayMode, instanceMode, workspace} = route;
  if (displayMode === undefined || instanceMode === undefined || workspace === undefined) return null;
  return (
    parts.find(({catalogEntry}) =>
      catalogEntry.containerKeys.includes('main') &&
      catalogEntry.displayModes.includes(displayMode) &&
      catalogEntry.instanceModes.includes(instanceMode) &&
      catalogEntry.workspaces.includes(workspace) &&
      catalogEntry.surfaceForm.includes(surfaceForm),
    )?.catalogEntry.partKey ?? null
  );
};

export const createTerminalActivationRouteActor = (
  parts: ReturnType<typeof createTerminalActivationParts>,
  surfaceForm: SurfaceForm,
): ActorDefinition =>
  defineActor(moduleName, 'terminal-activation-route', [
    onCommand(needToActivateTerminalCommand, async context => {
      const route = context.command.routeContext;
      if (route === null || route.displayMode === undefined)
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_ROUTE_CONTEXT_INCOMPLETE'});
      const partKey = activationPartFor(parts, surfaceForm, route);
      if (partKey === null) return Object.freeze({status: 'rejected', reason: 'ACTIVATION_ROUTE_UNAVAILABLE'});
      if (selectScreen(context.getState(), route.displayMode, 'main')?.partKey !== partKey) {
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
      }
      return Object.freeze({status: 'activation-screen-requested', partKey});
    }),
  ]);
