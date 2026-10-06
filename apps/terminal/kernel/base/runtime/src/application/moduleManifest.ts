import type {RuntimeModule, RuntimeModuleDescriptor} from '../types/module';
import {freezeList} from '../foundations/freezeList';
import {readStateSelectorMetadata} from '../foundations/defineStateSelector';

export const describeRuntimeModule = (module: RuntimeModule): RuntimeModuleDescriptor =>
  Object.freeze({
    moduleName: module.moduleName,
    kind: module.kind,
    packageVersion: module.packageVersion,
    protocolVersion: module.protocolVersion,
    dependencies: freezeList(module.dependencies ?? []),
    stateSliceNames: freezeList((module.stateSlices ?? []).map(slice => slice.name)),
    commandNames: freezeList((module.commands ?? []).map(command => command.name)),
    actorKeys: freezeList((module.actorDefinitions ?? []).map(actor => `${actor.moduleName}.${actor.actorName}`)),
    selectorNames: freezeList(
      (module.selectorDefinitions ?? []).flatMap(selector => {
        const metadata = readStateSelectorMetadata(selector);
        return metadata === undefined ? [] : [`${metadata.moduleName}.${metadata.selectorName}`];
      }),
    ),
    selectorParameters: Object.freeze(
      Object.fromEntries(
        (module.selectorDefinitions ?? []).flatMap(selector => {
          const metadata = readStateSelectorMetadata(selector);
          return metadata === undefined
            ? []
            : [[`${metadata.moduleName}.${metadata.selectorName}`, metadata.parameters]];
        }),
      ),
    ),
    hasPreSetup: typeof module.preSetup === 'function',
    hasInstall: typeof module.install === 'function',
    hasReset: typeof module.onApplicationReset === 'function',
  });
