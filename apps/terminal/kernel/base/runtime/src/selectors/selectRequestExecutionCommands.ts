import type {RequestId} from '@catering-v2s/kernel-base-contracts';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {defineStateSelector} from '../foundations/defineStateSelector';
import {freezeList} from '../foundations/freezeList';
import {moduleName} from '../moduleName';
import type {RequestExecutionCommandView} from '../types/requestLedger';
import {selectRequestExecutionView} from './selectRequestExecutionView';

const selectRequestExecutionCommandsImplementation = (
  state: StateRoot,
  requestId: RequestId,
  displayMode?: 'PRIMARY' | 'SECONDARY',
): readonly RequestExecutionCommandView[] => {
  const view = selectRequestExecutionView(state, requestId);
  if (view === null) return freezeList([]);
  return freezeList(
    view.commands.filter(
      command => displayMode === undefined || command.displayMode === null || command.displayMode === displayMode,
    ),
  );
};

export const selectRequestExecutionCommands = defineStateSelector(moduleName, 'selectRequestExecutionCommands', {
  parameters: [{kind: 'string'}, {kind: 'enum', values: ['PRIMARY', 'SECONDARY'], optional: true}],
  selector: selectRequestExecutionCommandsImplementation,
});
