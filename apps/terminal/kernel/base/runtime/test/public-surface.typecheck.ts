import type {
  ActorDefinition,
  ActorCommandHandlerDefinition,
  ActorExecutionContext,
  ActorExecutionRecord,
  ActorExecutionStatus,
  ActorCommandHandler,
  ActorDispatchOptions,
  CommandAggregateStatus,
  CommandDefinition,
  CommandDispatchOptions,
  CommandDispatchResult,
  CommandIntent,
  CommandRouteIntent,
  CommandTarget,
  CommandTargetResolver,
  CommandTargetResolverInput,
  CommandVisibility,
  CreateRuntimeInput,
  DefineCommandInput,
  DispatchedCommand,
  LedgerError,
  PeerDispatchGateway,
  PeerDispatchOptions,
  RequestExecutionCommandView,
  RequestExecutionView,
  Runtime,
  RuntimeInstanceMode,
  RuntimeJournal,
  RuntimeJournalEvent,
  RuntimeLifecycleObserver,
  RuntimeLimits,
  RuntimeModule,
  RuntimeModuleContext,
  RuntimeModuleDescriptor,
  RuntimeModulePreSetupContext,
  RuntimeModuleResetInput,
  RuntimeStateInput,
  RuntimeStatus,
  RuntimeSubscriptionListener,
  SetRuntimeInstanceModePayload,
  SetRuntimeInstanceModeResult,
} from '../src/index';
import type {StateJsonValue, WorkspaceKey} from '@catering-v2s/kernel-base-state';
import type {CommandRouteContext} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  defineCommand,
  onCommand,
  selectRequestExecutionCommands,
  selectRequestExecutionView,
  selectRequestExecutionViews,
} from '../src/index';

// Positive type references keep every public type in the tsc compilation set.
type PublicTypeReferences = [
  ActorDefinition,
  ActorExecutionContext,
  ActorExecutionRecord,
  ActorExecutionStatus,
  ActorCommandHandler,
  ActorCommandHandlerDefinition,
  ActorDispatchOptions,
  CommandAggregateStatus,
  CommandDefinition<{value: string}>,
  CommandDispatchOptions,
  CommandDispatchResult,
  CommandIntent<{value: string}>,
  CommandRouteIntent,
  CommandTarget,
  CommandTargetResolver,
  CommandTargetResolverInput,
  CommandVisibility,
  CreateRuntimeInput,
  DefineCommandInput,
  DispatchedCommand,
  LedgerError,
  PeerDispatchGateway,
  PeerDispatchOptions,
  RequestExecutionCommandView,
  RequestExecutionView,
  Runtime,
  RuntimeInstanceMode,
  RuntimeJournal,
  RuntimeJournalEvent,
  RuntimeLifecycleObserver,
  RuntimeLimits,
  RuntimeModule,
  RuntimeModuleContext,
  RuntimeModuleDescriptor,
  RuntimeModulePreSetupContext,
  RuntimeModuleResetInput,
  RuntimeStateInput,
  RuntimeStatus,
  RuntimeSubscriptionListener,
  SetRuntimeInstanceModePayload,
  SetRuntimeInstanceModeResult,
];

declare const publicTypeReferences: PublicTypeReferences | undefined;
void publicTypeReferences;

type RuntimeSubscription = ReturnType<Runtime['subscribe']>;
declare const runtimeSubscriptionListener: RuntimeSubscriptionListener;
declare const runtimeUnsubscribe: RuntimeSubscription;
void runtimeSubscriptionListener;
void runtimeUnsubscribe;

const commandWithValue = defineCommand<{value: string}>('type.fixture', {
  name: 'run',
  visibility: 'public',
});
const commandWithOther = defineCommand<{other: string}>('type.fixture', {
  name: 'other',
  visibility: 'public',
});

// @ts-expect-error command definitions bind their payload type through a private phantom brand.
const wrongDefinitionPayload: CommandDefinition<{other: string}> = commandWithValue;
void wrongDefinitionPayload;

const forgedRuntimeModule = {
  commandDefinitions: [
    // @ts-expect-error module command definitions must retain the factory-created private brand.
    {
      moduleName: 'type.fixture',
      commandName: 'type.fixture.run',
      visibility: 'public' as const,
      timeoutMs: 1000,
      allowNoActor: false,
      allowReentry: false,
      defaultTarget: 'local' as const,
    },
  ],
} satisfies Pick<RuntimeModule, 'commandDefinitions'>;
void forgedRuntimeModule;

// @ts-expect-error onCommand must mount a command definition object, not a string command name.
onCommand('type.fixture.run', () => ({ok: true}));

// @ts-expect-error handler context payload must match the mounted command definition payload.
onCommand(commandWithValue, (context: ActorExecutionContext<{other: string}>) => context.command.payload.other);

// @ts-expect-error hand-written handlers cannot satisfy the private onCommand brand.
const forgedHandler: ActorCommandHandlerDefinition<{value: string}> = {
  commandName: commandWithValue.commandName,
  definition: commandWithValue,
  handle: () => null,
};
void forgedHandler;

defineActor('type.fixture', 'actor', [onCommand(commandWithValue, context => context.command.payload.value)]);

defineActor('type.fixture', 'actor-two', [
  // @ts-expect-error different command payload definitions must not be interchangeable in actor mounts.
  onCommand(commandWithOther, (context: ActorExecutionContext<{value: string}>) => context.command.payload.value),
]);

const actorRecordIsJson: StateJsonValue = {
  actorKey: 'type.fixture.actor',
  status: 'completed',
  startedAt: 1,
  completedAt: 2,
  result: null,
  error: null,
} satisfies ActorExecutionRecord;
void actorRecordIsJson;

declare const requestExecutionView: RequestExecutionView;
declare const requestExecutionCommandView: RequestExecutionCommandView;
void requestExecutionView;
void requestExecutionCommandView;
void selectRequestExecutionView;
void selectRequestExecutionViews;
void selectRequestExecutionCommands;

const routeWorkspaceToWorkspaceKey: WorkspaceKey = undefined as unknown as NonNullable<
  CommandRouteContext['workspace']
>;
const workspaceKeyToRouteWorkspace: NonNullable<CommandRouteContext['workspace']> =
  undefined as unknown as WorkspaceKey;
void routeWorkspaceToWorkspaceKey;
void workspaceKeyToRouteWorkspace;
