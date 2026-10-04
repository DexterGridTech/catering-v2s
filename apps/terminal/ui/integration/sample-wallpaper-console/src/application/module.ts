import {
  defineActor,
  defineCommand,
  onCommand,
  selectRuntimeInstanceMode,
  type ActorExecutionContext,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import type {CommandRouteContext, SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {contentStateSliceName, selectScreen, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {
  selectTopologyFacts,
  selectTopologyRequiredProjectionsReady,
  selectTopologyState,
} from '@catering-v2s/kernel-base-topology';
import {selectHostStaffQualification, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {wallpaperSliceName} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {terminalClientStatusProjectionSliceName} from '@catering-v2s/kernel-base-terminal-data-client';
import {needToActivateTerminalCommand, selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';
import {startWallpaperPickerCommand} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {needToLoginStaffCommand} from '@catering-v2s/ui-feature-sample-staff-auth';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {
  createStartupReadyActor as createSharedStartupReadyActor,
  type StartupReadyPayload,
} from '@catering-v2s/ui-base-integration-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createWallpaperConsoleExitActor} from '../features/actors/actors';
import {moduleKind, moduleName} from '../moduleName';

export type SampleWallpaperConsoleReadyPayload = StartupReadyPayload;
type Stage = 'activation' | 'staff' | 'business';
type Placement = Readonly<{route: CommandRouteContext; key: string}>;

const reconcileStageCommand = defineCommand<Readonly<Record<string, never>>>(moduleName, {
  name: 'reconcile-owner-stage',
  visibility: 'internal',
});

export const startupReadyCommand = defineCommand<SampleWallpaperConsoleReadyPayload>(moduleName, {
  name: 'startup-ready',
  visibility: 'internal',
});

const requiredPeerProjectionSliceNames = Object.freeze([
  contentStateSliceName('MAIN'),
  sessionSliceName,
  wallpaperSliceName,
  serverConfigSliceName,
  terminalClientStatusProjectionSliceName,
]);

const hasCurrentActivatedTerminal = (state: StateRoot): boolean => {
  const activation = selectActivationStatusView(state);
  return activation !== null && activation.currentPeerValue && activation.activation.status === 'active';
};

export const selectSampleWallpaperConsoleBusinessInterlockActive = (state: StateRoot): boolean =>
  selectTopologyState(state).repairPending ||
  (selectRuntimeInstanceMode(state) === 'SLAVE' &&
    !selectTopologyRequiredProjectionsReady(state, requiredPeerProjectionSliceNames)) ||
  (selectHostStaffQualification(state)?.status === 'authenticated' && !hasCurrentActivatedTerminal(state));

export const selectSampleWallpaperConsoleStaffLoginAllowed = (state: StateRoot): boolean =>
  selectRuntimeInstanceMode(state) === 'MASTER' &&
  !selectTopologyState(state).repairPending &&
  hasCurrentActivatedTerminal(state);

export const selectSampleWallpaperConsoleBusinessMutationAllowed = (state: StateRoot): boolean =>
  !selectTopologyState(state).repairPending &&
  !selectSampleWallpaperConsoleBusinessInterlockActive(state) &&
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

export const selectSampleWallpaperConsoleRouteStage = (state: StateRoot): Stage | null => {
  const topology = selectTopologyState(state);
  if (topology.repairPending) return null;
  const activationView = selectActivationStatusView(state);
  if (activationView === null || !activationView.currentPeerValue) return null;
  const status = activationView.activation.status;
  if (status === 'activating' || status === 'cancelling') return null;
  if (status === 'inactive') return 'activation';
  if (selectSampleWallpaperConsoleBusinessInterlockActive(state)) return null;
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
  // VICE renders the MASTER's projected host secondary; local MAIN writes are rejected by the owner boundary.
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
    stage: NonNullable<ReturnType<typeof selectSampleWallpaperConsoleRouteStage>>;
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
    if (result.status !== 'completed')
      throw new Error(`[sample-wallpaper-console] activation route failed: ${result.status}`);
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
    if (result.status !== 'completed')
      throw new Error(`[sample-wallpaper-console] staff stage route failed: ${result.status}`);
    return;
  }
  if (existing?.partKey.startsWith('sample.wallpaper.') === true) return;
  const result = await context.dispatchCommand(startWallpaperPickerCommand, {}, {routeContext: route});
  if (result.status !== 'completed')
    throw new Error(`[sample-wallpaper-console] wallpaper stage route failed: ${result.status}`);
};

const routeStage = async (context: ActorExecutionContext, surfaceForm: SurfaceForm): Promise<void> => {
  const state = context.getState();
  const stage = selectSampleWallpaperConsoleRouteStage(state);
  const activationView = selectActivationStatusView(state);
  const staff = selectHostStaffQualification(state);
  context.platformPorts.logger.info({
    category: 'terminal-stage-routing',
    event: 'sample-wallpaper-console.stage-observed',
    message: 'Observed the current owner facts before stage routing',
    data: {
      stage,
      surfaceForm,
      instanceMode: selectRuntimeInstanceMode(state),
      displayRole: selectDisplayRole(state),
      repairPending: selectTopologyState(state).repairPending,
      activationStatus: activationView?.activation.status ?? null,
      activationPeerCurrent: activationView?.currentPeerValue ?? false,
      staffStatus: staff?.status ?? null,
    },
  });
  if (stage === null) return;
  for (const placement of placementsFor(state, surfaceForm)) {
    await routePlacement({context, surfaceForm, stage, route: placement.route});
  }
};

export const createSampleWallpaperConsoleModule = (surfaceForm: SurfaceForm): RuntimeModule => {
  let initialized = false;
  let reconcileScheduled = false;
  let lastSignature: string | null = null;
  let lastSecondaryAvailability: boolean | null = null;
  const logSecondaryAvailability = (
    state: StateRoot,
    logger: ActorExecutionContext['platformPorts']['logger'],
  ): void => {
    const hasTopologySecondarySurface = selectTopologyFacts(state)?.hasTopologySecondarySurface ?? false;
    const secondaryAvailable = surfaceForm === 'laptop' && hasTopologySecondarySurface;
    if (lastSecondaryAvailability === secondaryAvailable) return;
    lastSecondaryAvailability = secondaryAvailable;
    logger.info({
      category: 'terminal-stage-routing',
      event: 'sample-wallpaper-console.secondary-placement',
      message: 'Resolved host secondary placement from current topology facts',
      data: {hasTopologySecondarySurface, secondaryAvailable},
    });
  };
  const reconcileActor = defineActor(moduleName, 'owner-stage-route', [
    onCommand(startupReadyCommand, async context => {
      initialized = true;
      lastSignature = signature(context.getState(), surfaceForm);
      logSecondaryAvailability(context.getState(), context.platformPorts.logger);
      await routeStage(context, surfaceForm);
      return null;
    }),
    onCommand(reconcileStageCommand, async context => {
      logSecondaryAvailability(context.getState(), context.platformPorts.logger);
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
    createWallpaperConsoleExitActor(),
    createSharedStartupReadyActor({
      moduleName,
      command: startupReadyCommand,
      message: 'Primary sample2 surface readiness accepted by wallpaper console',
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
        logSecondaryAvailability(context.getState(), context.platformPorts.logger);
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
                  event: 'sample-wallpaper-console.reconcile-rejected',
                  message: 'Owner-stage reconciliation command did not complete',
                  data: {
                    status: result.status,
                    actorFailures: result.actorResults
                      .filter(actor => actor.status === 'error' || actor.status === 'timed-out')
                      .map(actor => ({
                        actorKey: actor.actorKey,
                        status: actor.status,
                        errorKey: actor.error?.key ?? null,
                        errorCode: actor.error?.code ?? null,
                      })),
                  },
                });
              }
            })
            .catch(error => {
              context.platformPorts.logger.error({
                category: 'terminal-stage-routing',
                event: 'sample-wallpaper-console.reconcile-failed',
                message: 'Owner-stage reconciliation failed',
                data: {errorType: error instanceof Error ? error.name : typeof error},
              });
            });
        });
      });
    },
  });
};
