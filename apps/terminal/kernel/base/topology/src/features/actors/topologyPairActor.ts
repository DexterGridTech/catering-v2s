import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {switchDisplayRoleCommand, switchInstanceModeCommand} from '@catering-v2s/kernel-base-display-context';
import {topologyTransportConfig} from '@catering-v2s/kernel-base-contracts';
import type {TopologyIdentityResponse} from '@catering-v2s/kernel-base-contracts';
import {topologyActions} from '../slices/topology';
import {selectTopologyFacts} from '../../selectors/selectTopologyFacts';
import {selectTopologyState} from '../../selectors/selectTopologyState';
import {
  pairByHostTopologyCommand,
  pairTopologyCommand,
  queryTopologyHostCommand,
  requestTopologySlaveUnpairStateClearCommand,
  completeTopologySlaveUnpairStateClearCommand,
  unpairTopologyCommand
} from '../../declarations/commands';
import {
  type TopologyActorInput,
  createTopologyFailure,
  ensurePairPreconditions,
  normalizePairHost,
  toTopologyIdentity,
  safeErrorCode,
  pairingLog,
  unpairingLog,
  dispatchCompleted,
  repairPairState,
  completeLocalUnpair,
  resolvePeerClose
} from './topologyActorSupport';

export const createTopologyPairActor = (input: TopologyActorInput = {}): ActorDefinition =>
  defineActor(moduleName, 'pair-lifecycle', [
    onCommand(queryTopologyHostCommand, async context => {
      const host = context.command.payload.host.trim();
      if (host.length === 0) throw new Error('Topology host is empty');
      if (!input.identityClient) throw new Error('Topology identity client unavailable');
      return input.identityClient.query(host);
    }),
    onCommand(pairByHostTopologyCommand, async context => {
      ensurePairPreconditions(context, input.canPair);
      let host: string;
      try {
        host = normalizePairHost(context.command.payload.host);
      } catch (error) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_INVALID_LOCATOR',
          message: 'Topology host is invalid',
          cause: error,
        });
      }
      if (!input.identityClient) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_IDENTITY_FAILED',
          message: 'Topology identity client is unavailable',
        });
      }

      let identityResponse: TopologyIdentityResponse;
      try {
        identityResponse = await input.identityClient.query(host);
      } catch (error) {
        pairingLog(context, 'identity-failed', {phase: 'identity-query'});
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_IDENTITY_FAILED',
          message: 'Topology identity query failed',
          cause: error,
        });
      }

      const peerIdentity = toTopologyIdentity(identityResponse);
      if (input.moduleName !== undefined && peerIdentity.moduleName !== input.moduleName) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Topology identity module does not match',
        });
      }
      if (peerIdentity.instanceMode !== 'MASTER' || peerIdentity.displayRole !== 'CHIEF') {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Topology peer is not a MASTER and CHIEF',
        });
      }

      const locator = Object.freeze({
        host,
        port: topologyTransportConfig.port,
        basePath: topologyTransportConfig.basePath,
        identity: peerIdentity,
      });
      try {
        await dispatchCompleted({
          context,
          definition: pairTopologyCommand,
          payload: Object.freeze({locator}),
          label: 'Topology direct pairing',
        });
      } catch (error) {
        pairingLog(context, 'failed', {
          phase: 'pair-command',
          errorType: error instanceof Error ? error.name : typeof error,
          errorCode: safeErrorCode(error),
        });
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_UNAVAILABLE',
          message: 'Topology direct pairing failed',
          cause: error,
        });
      }

      pairingLog(context, 'completed', {phase: 'pair-by-host'});
      return Object.freeze({type: 'identity' as const, ...peerIdentity});
    }),
    onCommand(pairTopologyCommand, async context => {
      ensurePairPreconditions(context, input.canPair);
      const payload = context.command.payload;
      if (input.moduleName !== undefined && payload.locator.identity.moduleName !== input.moduleName) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Topology pairing requires matching integration module',
        });
      }
      context.dispatchAction(topologyActions.setRepairPending(true));
      context.dispatchAction(topologyActions.setMasterLocator(payload.locator));
      context.dispatchAction(topologyActions.setPeerIdentity(payload.locator.identity));
      pairingLog(context, 'started');
      let phase = 'state-prepared';
      try {
        phase = 'switch-instance-mode';
        const modeResult = await dispatchCompleted({
          context,
          definition: switchInstanceModeCommand,
          payload: Object.freeze({instanceMode: 'SLAVE' as const}),
          label: 'Topology instance mode switch',
        });
        pairingLog(context, 'instance-mode-completed', {status: modeResult.status});
        phase = 'switch-display-role';
        const roleResult = await dispatchCompleted({
          context,
          definition: switchDisplayRoleCommand,
          payload: Object.freeze({displayRole: 'VICE' as const}),
          label: 'Topology display role switch',
        });
        pairingLog(context, 'display-role-completed', {status: roleResult.status});
        phase = 'flush-persistence';
        const persistence = await context.flushPersistence();
        if (persistence.status !== 'succeeded')
          throw new Error(`Topology pairing persistence did not complete: ${persistence.status}`);
        pairingLog(context, 'persistence-completed', {status: persistence.status, failureCount: 0});
        context.dispatchAction(topologyActions.setRepairPending(false));
        pairingLog(context, 'state-sync-enabled', {instanceMode: selectRuntimeInstanceMode(context.getState())});
        return null;
      } catch (error) {
        pairingLog(context, 'failed', {
          phase,
          errorType: error instanceof Error ? error.name : typeof error,
          errorCode: safeErrorCode(error),
        });
        const repaired = await repairPairState(context);
        if (repaired) {
          context.dispatchAction(topologyActions.clearMasterLocator());
          context.dispatchAction(topologyActions.setRepairPending(false));
        } else {
          context.dispatchAction(topologyActions.setRepairPending(true));
        }
        throw error;
      }
    }),
    onCommand(unpairTopologyCommand, async context => {
      const currentFacts = selectTopologyFacts(context.getState());
      if (currentFacts === undefined || !currentFacts.paired) {
        throw createTopologyFailure({context, code: 'TOPOLOGY_NOT_PAIRED', message: 'Topology is not paired'});
      }
      const initialInstanceMode = selectRuntimeInstanceMode(context.getState());
      context.dispatchAction(topologyActions.setRepairPending(true));
      if (initialInstanceMode === 'SLAVE') {
        try {
          await dispatchCompleted({
            context,
            definition: requestTopologySlaveUnpairStateClearCommand,
            payload: Object.freeze({transition: 'local-unpair' as const}),
            label: 'Topology slave TDC state clear',
          });
          return null;
        } catch (error) {
          context.dispatchAction(topologyActions.setRepairPending(true));
          unpairingLog(context, 'failed', {
            phase: 'slave-state-clear',
            errorType: error instanceof Error ? error.name : typeof error,
            instanceMode: selectRuntimeInstanceMode(context.getState()),
            hasLocator: selectTopologyState(context.getState()).masterLocator !== null,
          });
          throw error;
        }
      }
      return completeLocalUnpair(context, input, initialInstanceMode);
    }),
    onCommand(completeTopologySlaveUnpairStateClearCommand, async context => {
      if (selectRuntimeInstanceMode(context.getState()) !== 'SLAVE') {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Slave unpair completion requires the SLAVE role',
        });
      }
      const {transition} = context.command.payload;
      if (transition === 'local-unpair') return completeLocalUnpair(context, input, 'SLAVE');
      if (transition === 'peer-unpaired') {
        const resolution = await resolvePeerClose({context, instanceMode: 'SLAVE'});
        for (const action of resolution.actions) context.dispatchAction(action);
        return null;
      }
      throw createTopologyFailure({
        context,
        code: 'TOPOLOGY_PROTOCOL_REJECTED',
        message: 'Slave unpair completion transition is invalid',
      });
    }),
  ]);
