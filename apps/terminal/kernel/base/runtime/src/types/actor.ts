import type {NodeId, RuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import type {PersistenceOperationResult} from '@catering-v2s/kernel-base-state';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import type {ActorDispatchOptions, CommandDefinition, DispatchedCommand} from './command';
import type {CommandDispatchResult} from './execution';
import type {RuntimeUnknownAction} from './runtime';

export type ActorInfo = Readonly<{
  actorKey: string;
  moduleName: string;
  actorName: string;
}>;

export type ActorExecutionContext<TPayload extends StateJsonValue = StateJsonValue> = Readonly<{
  runtimeId: RuntimeInstanceId;
  localNodeId: NodeId;
  platformPorts: PlatformPorts;
  command: DispatchedCommand<TPayload>;
  actor: ActorInfo;
  getState: () => StateRoot;
  dispatchAction: (action: RuntimeUnknownAction) => RuntimeUnknownAction;
  flushPersistence: () => Promise<PersistenceOperationResult>;
  subscribeState: (listener: () => void) => () => void;
  dispatchCommand: {
    <TChildPayload extends StateJsonValue>(
      definition: CommandDefinition<TChildPayload>,
      payload: TChildPayload,
      options?: ActorDispatchOptions,
    ): Promise<CommandDispatchResult>;
    <TChildPayload extends StateJsonValue>(
      commandName: string,
      payload: TChildPayload,
      options?: ActorDispatchOptions,
    ): Promise<CommandDispatchResult>;
  };
  requestApplicationReset: (reason?: string) => void;
}>;

export type ActorCommandHandler<TPayload extends StateJsonValue = StateJsonValue> = (
  context: ActorExecutionContext<TPayload>,
) => StateJsonValue | void | Promise<StateJsonValue | void>;

export const actorCommandHandlerDefinitionBrand = Symbol('actorCommandHandlerDefinitionBrand');

/**
 * `handle` is a method-shaped member on purpose.  Runtime modules may carry
 * handlers for different payload types in one heterogeneous actor list while
 * `onCommand` still infers and checks the payload type at its call site.
 */
export type ActorCommandHandlerDefinition<TPayload extends StateJsonValue = StateJsonValue> = {
  readonly commandName: string;
  readonly definition: Readonly<{readonly commandName: string}>;
  handle(context: ActorExecutionContext<TPayload>): StateJsonValue | void | Promise<StateJsonValue | void>;
  readonly [actorCommandHandlerDefinitionBrand]: true;
};

export const actorDefinitionBrand = Symbol('actorDefinitionBrand');

export type ActorDefinition = Readonly<{
  moduleName: string;
  actorName: string;
  actorKey: string;
  handlers: readonly ActorCommandHandlerDefinition[];
  readonly [actorDefinitionBrand]: true;
}>;

export type RegisteredActorHandler = Readonly<{
  actor: ActorInfo;
  commandName: string;
  handle: ActorCommandHandler;
  order: number;
}>;
