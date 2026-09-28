import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {
  createClearLayersActor,
  createClearUiVariablesActor,
  createCloseLayerActor,
  createOpenLayerActor,
  createPruneHydratedContainersActor,
  createPruneHydratedLayersActor,
  createSetUiVariablesActor,
  createShowScreenActor,
} from '../features/actors';
import {
  clearLayersCommand,
  clearUiVariablesCommand,
  closeLayerCommand,
  openLayerCommand,
  pruneHydratedContainersCommand,
  pruneHydratedLayersCommand,
  setUiVariablesCommand,
  showScreenCommand,
} from '../features/commands';
import {createContentStateRegistrations, type ContentHydrationDiagnostic} from '../foundations/workspaceSlices';
import {createVariableStateFamily, readVariableState} from '../foundations/variableSlices';
import {createSurfaceFormSlice} from '../features/slices/surfaceForm';
import {selectSurfaceForm as selectSurfaceFormFromState} from '../selectors/selectSurfaceForm';
import {assertUiVariableDeclaration} from '../foundations/uiVariable';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {isSurfaceForm, type SurfaceForm, type UiCatalog} from '../types/catalog';
import type {UiStateModule} from '../types/module';
import type {UiVariableDeclaration} from '../types/variable';

type CreateUiStateModuleInput = Readonly<{
  readonly catalog: UiCatalog;
  readonly variables: readonly UiVariableDeclaration<StateJsonValue>[];
  readonly surfaceForm: SurfaceForm;
}>;

type VariableRegistry = ReadonlyMap<string, UiVariableDeclaration<StateJsonValue>>;

const createVariableRegistry = (variables: readonly UiVariableDeclaration<StateJsonValue>[]): VariableRegistry => {
  if (!Array.isArray(variables)) throw new Error('[ui-state] variables must be an array');
  const registry = new Map<string, UiVariableDeclaration<StateJsonValue>>();
  for (const declaration of variables) {
    assertUiVariableDeclaration(declaration);
    if (registry.has(declaration.key)) throw new Error(`[ui-state] duplicate ui variable: ${declaration.key}`);
    registry.set(declaration.key, declaration);
  }
  return registry;
};

const readCurrentWorkspace = (root: StateRoot) =>
  resolveWorkspace({
    instanceMode: selectRuntimeInstanceMode(root),
    displayRole: selectDisplayRole(root),
  });

export const createUiStateModule = (input: CreateUiStateModuleInput): UiStateModule => {
  if (typeof input !== 'object' || input === null) throw new Error('[ui-state] module input must be an object');
  if (typeof input.catalog !== 'object' || input.catalog === null) throw new Error('[ui-state] catalog is required');
  if (!isSurfaceForm(input.surfaceForm)) throw new Error('[ui-state] surfaceForm is required');
  const registry = createVariableRegistry(input.variables);
  const variableFamily = createVariableStateFamily(registry);
  const surfaceFormSlice = createSurfaceFormSlice(input.surfaceForm);
  const hydrationDiagnostics: ContentHydrationDiagnostic[] = [];
  const contentStateRegistrations = createContentStateRegistrations(diagnostic => {
    hydrationDiagnostics.push(diagnostic);
  });
  const actors = [
    createShowScreenActor(),
    createOpenLayerActor({catalog: input.catalog, selectSurfaceForm: selectSurfaceFormFromState}),
    createCloseLayerActor(),
    createClearLayersActor(),
    createPruneHydratedContainersActor({catalog: input.catalog, selectSurfaceForm: selectSurfaceFormFromState}),
    createPruneHydratedLayersActor({catalog: input.catalog}),
    createSetUiVariablesActor(registry, variableFamily),
    createClearUiVariablesActor(registry, variableFamily),
  ] as const;
  const commands = [
    showScreenCommand,
    openLayerCommand,
    closeLayerCommand,
    clearLayersCommand,
    pruneHydratedContainersCommand,
    pruneHydratedLayersCommand,
    setUiVariablesCommand,
    clearUiVariablesCommand,
  ] as const;
  const stateSlices = Object.freeze([...contentStateRegistrations, ...variableFamily.registrations, surfaceFormSlice]);

  const selectUiVariable = <TValue extends StateJsonValue>(
    root: StateRoot,
    declaration: UiVariableDeclaration<TValue>,
  ): TValue => {
    if (typeof declaration !== 'object' || declaration === null || Array.isArray(declaration)) {
      throw new Error('[ui-state] variable declaration must be registered');
    }
    const registered = registry.get(declaration.key);
    if (registered === undefined || registered !== declaration) {
      throw new Error(`[ui-state] variable declaration is not registered: ${declaration.key}`);
    }
    const state = readVariableState(root, variableFamily.stateKeys, readCurrentWorkspace(root));
    const value = state.values[registered.key];
    return (value === undefined ? declaration.defaultValue : value) as TValue;
  };

  const module: UiStateModule = {
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: stateSlices.map(registration => ({
      name: registration.name,
      persistIntent: registration.persistIntent,
    })),
    stateSlices,
    catalog: input.catalog,
    selectSurfaceForm: selectSurfaceFormFromState,
    selectUiVariable,
    install: async context => {
      const diagnostics = hydrationDiagnostics.splice(0, hydrationDiagnostics.length);
      for (const diagnostic of diagnostics) {
        const subject = diagnostic.scope === 'container' ? 'container' : 'layer';
        context.platformPorts.logger.warn({
          category: 'ui-state-hydration',
          event: `ui-state-hydration.${subject}.discarded`,
          message:
            subject === 'container'
              ? 'Hydrated UI container was discarded during validation'
              : 'Hydrated UI layer was discarded during validation',
          data: diagnostic,
        });
      }
      const containerPruning = await context.dispatchCommand(pruneHydratedContainersCommand, Object.freeze({}));
      if (containerPruning.status !== 'completed') {
        throw new Error(`UI state hydrated-container membership cleanup failed: ${containerPruning.status}`);
      }
      const pruning = await context.dispatchCommand(pruneHydratedLayersCommand, Object.freeze({}));
      if (pruning.status !== 'completed') {
        throw new Error(`UI state hydrated-layer membership cleanup failed: ${pruning.status}`);
      }
    },
  };
  return Object.freeze(module);
};
