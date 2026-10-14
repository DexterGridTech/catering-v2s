import {
  defineActor,
  onCommand,
  primarySurfaceReadyCommand,
  selectRuntimeInstanceMode,
  type ActorExecutionContext,
  type ActorDefinition,
  type RuntimeModuleContext,
} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import type {CommandRouteContext, SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import {selectScreen} from '@catering-v2s/kernel-base-ui-state';
import {selectTopologyFacts, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import {needToActivateTerminalCommand, selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';
import {startMemberDeskCommand} from '@catering-v2s/ui-feature-sample-member-desk';
import {needToLoginStaffCommand} from '@catering-v2s/ui-feature-sample-staff-auth';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {reconcileStageCommand, startupReadyCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {requiredPeerProjectionSliceNames} from '../../selectors/shared/sampleConsoleState';
import {selectSampleConsoleRouteStage} from '../../selectors/selectSampleConsoleRouteStage';

type Placement = Readonly<{route: CommandRouteContext; key: string}>;

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
  context: ActorExecutionContext,
  stage: NonNullable<ReturnType<typeof selectSampleConsoleRouteStage>>,
  route: Placement['route'],
): Promise<void> => {
  if (stage === 'activation') {
    const result = await context.dispatchCommand(needToActivateTerminalCommand, {}, {routeContext: route});
    if (result.status !== 'completed') throw new Error(`[sample-console] activation route failed: ${result.status}`);
    return;
  }
  const existing = route.displayMode === undefined ? undefined : selectScreen(context.getState(), route.displayMode, 'main');
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
    !(route.instanceMode === 'MASTER' && route.displayMode === 'PRIMARY' && existing.partKey === 'sample.desk.customer-welcome');
  if (existingIsBusiness) return;
  const result = await context.dispatchCommand(startMemberDeskCommand, {}, {routeContext: route});
  if (result.status !== 'completed')
    throw new Error(`[sample-console] member desk stage route failed: ${result.status}`);
};

const routeStage = async (context: ActorExecutionContext, surfaceForm: SurfaceForm): Promise<void> => {
  const stage = selectSampleConsoleRouteStage(context.getState());
  if (stage === null) return;
  for (const placement of placementsFor(context.getState(), surfaceForm)) {
    await routePlacement(context, stage, placement.route);
  }
};

type OwnerStageRouteBindings = Readonly<{
  actor: ActorDefinition;
  install: (context: RuntimeModuleContext) => void;
}>;

export const createOwnerStageRouteActor = (surfaceForm: SurfaceForm): OwnerStageRouteBindings => {
  let initialized = false;
  let reconcileScheduled = false;
  let lastSignature: string | null = null;
  const actor = defineActor(moduleName, 'owner-stage-route', [
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
  const install = (context: RuntimeModuleContext): void => {
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
  };
  return Object.freeze({actor, install});
};
