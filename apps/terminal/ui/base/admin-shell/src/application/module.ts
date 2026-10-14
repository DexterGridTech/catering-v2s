import {createUiRuntimeModule, type UiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleName} from '../moduleName';
import {createServerConfigPanelParts, createTerminalUpdateInstallReminderParts, parts} from '../declarations/parts';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';

export const createAdminShellModule = (serverSpaces: TransportServerConfig): UiRuntimeModule =>
  createUiRuntimeModule(
    {
      moduleName,
      kind: 'toolkit',
      dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
      commandDefinitions: [],
      actorDefinitions: [],
      stateSlices: [],
    },
    {
      parts: Object.freeze([
        ...parts,
        ...createServerConfigPanelParts(serverSpaces),
        ...createTerminalUpdateInstallReminderParts(),
      ]),
      layerDismissals: Object.freeze({}),
    },
  );
