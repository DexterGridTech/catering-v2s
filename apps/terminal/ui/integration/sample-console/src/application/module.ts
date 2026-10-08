import {
  defineActor,
  defineCommand,
  onCommand,
  primarySurfaceReadyCommand,
  selectRuntimeInstanceMode,
  type ActorExecutionContext,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import type {CommandRouteContext, SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {selectScreen, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {
  selectTopologyFacts,
  selectTopologyRequiredProjectionsReady,
  selectTopologyState,
} from '@catering-v2s/kernel-base-topology';
import {selectHostStaffQualification, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {memberSliceName} from '@catering-v2s/kernel-feature-sample-member-registry';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {terminalClientStatusProjectionSliceName} from '@catering-v2s/kernel-base-terminal-data-client';
import {needToActivateTerminalCommand, selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';
import {startMemberDeskCommand} from '@catering-v2s/ui-feature-sample-member-desk';
import {needToLoginStaffCommand} from '@catering-v2s/ui-feature-sample-staff-auth';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {
  createStartupReadyActor as createSharedStartupReadyActor,
  type StartupReadyPayload,
} from '@catering-v2s/ui-base-integration-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';

export type SampleConsoleReadyPayload = StartupReadyPayload;
type Stage = 'activation' | 'staff' | 'business';
type Placement = Readonly<{route: CommandRouteContext; key: string}>;

/** The integration owns this internal wake-up command; owner facts remain authoritative. */
const reconcileStageCommand = defineCommand<Readonly<Record<string, never>>>(moduleName, {
  name: 'reconcile-owner-stage',
  visibility: 'internal',
});

export const startupReadyCommand = defineCommand<SampleConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
});

const requiredPeerProjectionSliceNames = Object.freeze([
  contentStateSliceName('MAIN'),
  sessionSliceName,
  memberSliceName,
  serverConfigSliceName,
  terminalClientStatusProjectionSliceName,
]);

const hasCurrentActivatedTerminal = (state: StateRoot): boolean => {
  const activation = selectActivationStatusView(state);
  return activation !== null && activation.currentPeerValue && activation.activation.status === 'active';
};

export const selectSampleConsoleBusinessInterlockActive = (state: StateRoot): boolean =>
  selectTopologyState(state).repairPending ||
  (selectRuntimeInstanceMode(state) === 'SLAVE' &&
    !selectTopologyRequiredProjectionsReady(state, requiredPeerProjectionSliceNames)) ||
  (selectHostStaffQualification(state)?.status === 'authenticated' && !hasCurrentActivatedTerminal(state));

export const selectSampleConsoleStaffLoginAllowed = (state: StateRoot): boolean =>
  selectRuntimeInstanceMode(state) === 'MASTER' &&
  !selectTopologyState(state).repairPending &&
  hasCurrentActivatedTerminal(state);

export const selectSampleConsoleBusinessMutationAllowed = (state: StateRoot): boolean =>
  !selectTopologyState(state).repairPending &&
  !selectSampleConsoleBusinessInterlockActive(state) &&
  hasCurrentActivatedTerminal(state) &&
  selectHostStaffQualification(state)?.status === 'authenticated';

const activationPartFor = (surfaceForm: SurfaceForm, route: CommandRouteContext): string | null => {
  if (route.displayMode === undefined || route.workspace === undefined || route.instanceMode === undefined) return null;
  if (surfaceForm === 'mobile') {
    return route.displayMode === 'PRIMARY' && route.workspace === 'MAIN' && route.instanceMode === 'MASTER'
      ? 'terminal.activation.mmp'
      : null;
  }
  if (route.instanceMode === 'SLAVE' && route.workspace === 'MAIN' && route.displayMode === 'SECONDARY')
    return 'terminal.activation.lms';
  if (route.instanceMode === 'SLAVE' && route.workspace === 'BRANCH' && route.displayMode === 'PRIMARY')
    return 'terminal.activation.lsp';
  if (route.instanceMode === 'MASTER' && route.workspace === 'MAIN')
    return route.displayMode === 'SECONDARY' ? 'terminal.activation.lms' : 'terminal.activation.lmp';
  return null;
};

export const selectSampleConsoleRouteStage = (state: StateRoot): Stage | null => {
  const topology = selectTopologyState(state);
  if (topology.repairPending) return null;
  const activationView = selectActivationStatusView(state);
  if (activationView === null || !activationView.currentPeerValue) return null;
  const status = activationView.activation.status;
  if (status === 'activating' || status === 'cancelling') return null;
  if (status === 'inactive') return 'activation';
  if (selectSampleConsoleBusinessInterlockActive(state)) return null;
  const staff = selectHostStaffQualification(state);
  if (staff === null) return null;
  return staff.status === 'authenticated' ? 'business' : 'staff';
};

const placementsFor = (state: StateRoot, surfaceForm: SurfaceForm): readonly Placement[] => {
  const mode = selectRuntimeInstanceMode(state);
  const role = selectDisplayRole(state);
  const facts = selectTopologyFacts(state);
  if (mode === 'MASTER') {
    const placements: Placement[] = [
      {route: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'}, key: 'MASTER/MAIN/PRIMARY'},
    ];
    if (surfaceForm === 'laptop' && facts?.hasTopologySecondarySurface === true) {
      placements.push({
        route: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'SECONDARY'},
        key: 'MASTER/MAIN/SECONDARY',
      });
    }
    return placements;
  }
  if (role === 'CHIEF') {
    return [{route: {workspace: 'BRANCH', instanceMode: 'SLAVE', displayMode: 'PRIMARY'}, key: 'SLAVE/BRANCH/PRIMARY'}];
  }
  // VICE consumes the MASTER's projected MAIN secondary placement; it cannot write that workspace locally.
  return [];
};

const signature = (state: StateRoot, surfaceForm: SurfaceForm): string => {
  const topology = selectTopologyState(state);
  const activation = selectActivationStatusView(state);
  const staff = selectHostStaffQualification(state);
  return JSON.stringify([
    selectRuntimeInstanceMode(state),
    selectDisplayRole(state),
    topology.repairPending,
    topology.peerIdentity?.nodeId ?? null,
    topology.peerReachable,
    topology.peerStateSyncConnectionId,
    requiredPeerProjectionSliceNames.map(name => topology.peerAppliedStateSyncRevisions[name] ?? null),
    selectTopologyFacts(state)?.hasTopologySecondarySurface ?? false,
    activation?.activation.status ?? null,
    activation?.currentPeerValue ?? false,
    staff?.status ?? null,
    placementsFor(state, surfaceForm).map(({route, key}) => [
      key,
      route.displayMode === undefined ? null : (selectScreen(state, route.displayMode, 'main')?.partKey ?? null),
    ]),
  ]);
};

const routePlacement = async (
  input: Readonly<{
    context: ActorExecutionContext;
    surfaceForm: SurfaceForm;
    stage: NonNullable<ReturnType<typeof selectSampleConsoleRouteStage>>;
    route: ReturnType<typeof placementsFor>[number]['route'];
  }>,
): Promise<void> => {
  const {context, surfaceForm, stage, route} = input;
  const existing =
    route.displayMode === undefined ? undefined : selectScreen(context.getState(), route.displayMode, 'main');
  if (stage === 'activation') {
    const expected = activationPartFor(surfaceForm, route);
    if (expected === null || existing?.partKey === expected) return;
    const result = await context.dispatchCommand(needToActivateTerminalCommand, {}, {routeContext: route});
    if (result.status !== 'completed') throw new Error(`[sample-console] activation route failed: ${result.status}`);
    return;
  }
  if (stage === 'staff') {
    const expected =
      route.instanceMode === 'MASTER' && route.displayMode === 'PRIMARY'
        ? 'sample.auth.login'
        : route.displayMode === 'PRIMARY'
          ? 'sample.auth.guide.lsp'
          : 'sample.auth.guide.lms';
    if (existing?.partKey === expected) return;
    const result = await context.dispatchCommand(needToLoginStaffCommand, {}, {routeContext: route});
    if (result.status !== 'completed') throw new Error(`[sample-console] staff stage route failed: ${result.status}`);
    return;
  }
  const existingIsBusiness =
    existing?.partKey.startsWith('sample.desk.') === true &&
    !(
      route.instanceMode === 'MASTER' &&
      route.displayMode === 'PRIMARY' &&
      existing.partKey === 'sample.desk.customer-welcome'
    );
  if (existingIsBusiness) return;
  const result = await context.dispatchCommand(startMemberDeskCommand, {}, {routeContext: route});
  if (result.status !== 'completed')
    throw new Error(`[sample-console] member desk stage route failed: ${result.status}`);
};

const routeStage = async (context: ActorExecutionContext, surfaceForm: SurfaceForm): Promise<void> => {
  const stage = selectSampleConsoleRouteStage(context.getState());
  if (stage === null) return;
  for (const placement of placementsFor(context.getState(), surfaceForm)) {
    await routePlacement({context, surfaceForm, stage, route: placement.route});
  }
};

/** The integration owns the one ordered activation → staff → sample stage decision. */
export const createSampleConsoleModule = (surfaceForm: SurfaceForm): RuntimeModule => {
  let initialized = false;
  let reconcileScheduled = false;
  let lastSignature: string | null = null;
  const reconcileActor = defineActor(moduleName, 'owner-stage-route', [
    onCommand(startupReadyCommand, async context => {
      initialized = true;
      lastSignature = signature(context.getState(), surfaceForm);
      await routeStage(context, surfaceForm);
      const ready = context.command.payload;
      const signal = await context.dispatchCommand(primarySurfaceReadyCommand, {
        contentReady: ready.contentFailure === null,
      });
      if (signal.status !== 'completed')
        throw new Error(`[sample-console] primary surface lifecycle signal failed: ${signal.status}`);
      return null;
    }),
    onCommand(reconcileStageCommand, async context => {
      await routeStage(context, surfaceForm);
      return null;
    }),
  ]);
  const activationRouteActor = defineActor(moduleName, 'terminal-activation-route', [
    onCommand(needToActivateTerminalCommand, async context => {
      const route = context.command.routeContext;
      if (route === null || route.displayMode === undefined)
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_ROUTE_CONTEXT_INCOMPLETE'});
      const partKey = activationPartFor(surfaceForm, route);
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
  const actors = [
    createSharedStartupReadyActor({
      moduleName,
      command: startupReadyCommand,
      message: 'Primary surface readiness accepted by sample console',
    }),
    activationRouteActor,
    reconcileActor,
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: [
      {name: startupReadyCommand.commandName, visibility: startupReadyCommand.visibility},
      {name: reconcileStageCommand.commandName, visibility: reconcileStageCommand.visibility},
    ],
    commandDefinitions: [startupReadyCommand, reconcileStageCommand],
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [],
    stateSlices: [],
    install: (context: RuntimeModuleContext) => {
      context.subscribeState(() => {
        if (!initialized) return;
        const nextSignature = signature(context.getState(), surfaceForm);
        if (nextSignature === lastSignature) return;
        lastSignature = nextSignature;
        if (reconcileScheduled) return;
        reconcileScheduled = true;
        queueMicrotask(() => {
          reconcileScheduled = false;
          void context
            .dispatchCommand(reconcileStageCommand, {}, {requestId: createRequestId()})
            .then(result => {
              if (result.status !== 'completed') {
                context.platformPorts.logger.error({
                  category: 'terminal-stage-routing',
                  event: 'sample-console.reconcile-rejected',
                  message: 'Owner-stage reconciliation command did not complete',
                  data: {status: result.status},
                });
              }
            })
            .catch(error => {
              context.platformPorts.logger.error({
                category: 'terminal-stage-routing',
                event: 'sample-console.reconcile-failed',
                message: 'Owner-stage reconciliation failed',
                data: {errorType: error instanceof Error ? error.name : typeof error},
              });
            });
        });
      });
    },
  });
};
