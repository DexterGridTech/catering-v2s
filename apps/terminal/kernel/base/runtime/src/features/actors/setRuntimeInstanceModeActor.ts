import {onCommand, defineActor} from '../../foundations/defineActor';
import {setRuntimeInstanceModeCommand} from '../commands/setRuntimeInstanceMode';
import {runtimeInstanceModeChangedCommand} from '../commands/runtimeInstanceModeChanged';
import {setRuntimeInstanceModeAction} from '../slices/runtimeInstanceMode';
import {selectRuntimeInstanceMode} from '../../selectors/selectRuntimeInstanceMode';
import {moduleName} from '../../moduleName';
import type {ActorDefinition} from '../../types/actor';
import type {RuntimeRoleChangeSignal} from '../../types/module';
import {isRuntimeInstanceMode} from '../../types/role';

export const createSetRuntimeInstanceModeActor = (
  onRoleChange?: (signal: RuntimeRoleChangeSignal) => void,
): ActorDefinition =>
  defineActor(moduleName, 'instance-mode', [
    onCommand(setRuntimeInstanceModeCommand, async context => {
      const payload = context.command.payload;
      if (!isRuntimeInstanceMode(payload.instanceMode)) {
        throw new Error('Runtime instance mode must be MASTER or SLAVE');
      }
      const current = selectRuntimeInstanceMode(context.getState());
      if (payload.instanceMode === current) {
        return {
          changed: false,
          previousMode: current,
          currentMode: current,
        };
      }
      onRoleChange?.({
        kind: 'role.change-requested',
        previousMode: current,
        nextMode: payload.instanceMode,
        context,
        visibility: 'internal',
        allowNoActor: false,
      });
      context.dispatchAction(setRuntimeInstanceModeAction(payload.instanceMode));
      onRoleChange?.({
        kind: 'role.changed',
        previousMode: current,
        nextMode: payload.instanceMode,
        context,
        visibility: 'internal',
        allowNoActor: false,
      });
      try {
        const child = await context.dispatchCommand(
          runtimeInstanceModeChangedCommand,
          Object.freeze({
            previousMode: current,
            nextMode: payload.instanceMode,
          }),
        );
        if (child.status !== 'completed') {
          context.platformPorts.logger
            .withContext({
              commandId: context.command.commandId,
              commandName: context.command.commandName,
              nodeId: context.localNodeId,
            })
            .error({
              category: 'runtime.role',
              event: 'runtime.role.changed-consumer-failed',
              message: 'Post-commit role-change consumer did not complete',
              data: {status: child.status},
            });
        }
      } catch (error) {
        context.platformPorts.logger
          .withContext({
            commandId: context.command.commandId,
            commandName: context.command.commandName,
            nodeId: context.localNodeId,
          })
          .error({
            category: 'runtime.role',
            event: 'runtime.role.changed-consumer-failed',
            message: 'Post-commit role-change consumer failed',
            error: {message: error instanceof Error ? error.message : 'Unknown role-change consumer error'},
          });
      }
      return {
        changed: true,
        previousMode: current,
        currentMode: payload.instanceMode,
      };
    }),
  ]);
