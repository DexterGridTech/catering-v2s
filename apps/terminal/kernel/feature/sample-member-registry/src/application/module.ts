import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {runtimeModuleDependencyNames} from '../dependencies';
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  rejectMemberCommand,
  submitMemberCommand,
  memberWithdrawnCommand,
  withdrawMemberCommand,
  registerBranchConfirmedMemberCommand,
} from '../features/commands/commands';
import {
  createConfirmMemberActor,
  createRejectMemberActor,
  createRegisterBranchConfirmedMemberActor,
  createSubmitMemberActor,
} from '../features/actors/actors';
import {memberErrorDefinitions} from '../foundations/errors';
import {moduleKind, moduleName} from '../moduleName';
import {memberStateRegistration} from '../features/slices/slice';

const commands = [
  submitMemberCommand,
  confirmMemberCommand,
  rejectMemberCommand,
  memberPendingCommand,
  memberConfirmedCommand,
  memberRejectedCommand,
  withdrawMemberCommand,
  memberWithdrawnCommand,
  registerBranchConfirmedMemberCommand,
] as const;

export const createSampleMemberRegistryModule = (): RuntimeModule => {
  const actors = [
    createSubmitMemberActor(),
    createConfirmMemberActor(),
    createRejectMemberActor(),
    createRegisterBranchConfirmedMemberActor(),
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    errorDefinitions: memberErrorDefinitions,
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: memberStateRegistration.name, persistIntent: memberStateRegistration.persistIntent}],
    stateSlices: [memberStateRegistration],
  });
};
