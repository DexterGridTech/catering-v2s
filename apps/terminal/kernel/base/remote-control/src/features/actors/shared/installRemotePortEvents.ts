import {onCommand, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {RemoteControlScreen} from '@catering-v2s/kernel-base-platform-ports';
import {remoteControlPortEventCommand, type RemoteControlPortEventPayload, type StopRemoteControlPayload} from '../../../declarations/commands';
import {remoteControlParameters} from '../../../declarations/parameters';
import type {RemoteControlReadyScreen, RemoteControlState} from '../../slices/remoteControl';
import type {RemoteControlSession, RemoteControlSessionFence} from './createRemoteControlSession';

type RemoteControlLog = (
  context: ActorExecutionContext,
  event: string,
  data?: Readonly<Record<string, string | number | boolean | null>>,
) => void;

type RemotePortEventDependencies = Readonly<{
  readonly ownerSession: RemoteControlSession;
  readonly now: () => number;
  readonly log: RemoteControlLog;
  readonly readRemoteState: (context: ActorExecutionContext) => RemoteControlState;
  readonly replace: (context: ActorExecutionContext, session: RemoteControlState) => void;
  readonly stop: (context: ActorExecutionContext, payload: StopRemoteControlPayload) => Promise<StateJsonValue>;
  readonly reportActive: (context: ActorExecutionContext, session: RemoteControlState) => Promise<void>;
  readonly fenceReason: (
    context: ActorExecutionContext,
    fence: RemoteControlSessionFence,
  ) => StopRemoteControlPayload['reason'] | null;
  readonly scheduleWatchdog: (context: ActorExecutionContext, sessionId: string) => void;
  readonly cancelGesture: (input: Readonly<{
    context: ActorExecutionContext;
    session: RemoteControlState;
    screen: RemoteControlScreen;
    reason: 'INPUT_CONFLICT' | 'STALE_STREAM';
  }>) => Promise<void>;
  readonly sendScreenReady: (
    context: ActorExecutionContext,
    session: RemoteControlState,
    ready: RemoteControlReadyScreen,
  ) => Promise<void>;
  readonly maybeActivate: (context: ActorExecutionContext, session: RemoteControlState) => Promise<void>;
  readonly processData: (input: Readonly<{
    context: ActorExecutionContext;
    session: RemoteControlState;
    senderIdentity: string;
    bytes: readonly number[];
  }>) => Promise<StateJsonValue>;
}>;

export const installRemotePortEvents = (deps: RemotePortEventDependencies) =>
  onCommand(remoteControlPortEventCommand, context => {
    const event = context.command.payload as RemoteControlPortEventPayload;
    const queuedAt = deps.now();
    const eventIdentity = {
      eventType: typeof event.type === 'string' ? event.type : 'non-string',
      sessionId: typeof event.sessionId === 'string' ? event.sessionId : null,
    };
    deps.log(context, 'port-event-queued', eventIdentity);
    return deps.ownerSession.serializeMutation(async () => {
      deps.log(context, 'port-event-started', {...eventIdentity, queueWaitMs: Math.max(0, deps.now() - queuedAt)});
      if (event.type === 'lease-tick' && typeof event.sessionId === 'string') {
        const session = deps.readRemoteState(context);
        const allScreensReady =
          session.description !== null && session.readyScreens.length === session.description.screens.length;
        if (session.sessionId !== event.sessionId || session.phase !== 'active' || !allScreensReady) {
          return {status: 'processed'};
        }
        try {
          await deps.reportActive(context, session);
        } catch {
          await deps.stop(context, {sessionId: session.sessionId, reason: 'LEASE_EXPIRED'});
        }
        return {status: 'processed'};
      }
      if (event.type === 'watchdog-tick' && typeof event.sessionId === 'string') {
        const session = deps.readRemoteState(context);
        if (session.sessionId === event.sessionId && session.phase !== 'idle' && session.phase !== 'ended') {
          if (deps.now() - deps.ownerSession.lastKeepaliveAt >= remoteControlParameters.keepaliveTimeoutMs.defaultValue)
            await deps.stop(context, {sessionId: event.sessionId, reason: 'CONTROLLER_DISCONNECTED'});
          else deps.scheduleWatchdog(context, event.sessionId);
        }
        return {status: 'processed'};
      }
      if (event.type === 'state-changed') {
        if (
          deps.ownerSession.activeFence !== null &&
          deps.ownerSession.activeFence.sessionId === deps.readRemoteState(context).sessionId
        ) {
          const reason = deps.fenceReason(context, deps.ownerSession.activeFence);
          if (reason !== null) await deps.stop(context, {sessionId: deps.ownerSession.activeFence.sessionId, reason});
        }
        return {status: 'processed'};
      }
      const session = deps.readRemoteState(context);
      if (session.sessionId === null || event.sessionId !== session.sessionId) return {status: 'ignored'};
      if (event.type === 'disconnected') {
        const participantIdentity = typeof event.participantIdentity === 'string' ? event.participantIdentity : null;
        const reason =
          participantIdentity === session.description?.controllerIdentity
            ? 'CONTROLLER_DISCONNECTED'
            : participantIdentity !== null &&
                session.description?.endpoints.some(item => item.participantIdentity === participantIdentity)
              ? 'SCREEN_DISCONNECTED'
              : 'TDP_DISCONNECTED';
        return deps.stop(context, {sessionId: session.sessionId, reason});
      }
      if (event.type === 'capture-failed')
        return deps.stop(context, {sessionId: session.sessionId, reason: 'CAPTURE_FAILED'});
      if (event.type === 'cleanup-failed') {
        deps.log(context, 'cleanup-failed', {sessionId: session.sessionId, resource: String(event.resource ?? 'unknown')});
        return {status: 'cleanup-failed'};
      }
      if (
        event.type === 'screen-ready' &&
        typeof event.screen === 'string' &&
        typeof event.streamId === 'string' &&
        typeof event.trackSid === 'string' &&
        typeof event.widthPx === 'number' &&
        typeof event.heightPx === 'number' &&
        session.description !== null &&
        session.localEndpointId !== null
      ) {
        const screen = event.screen as RemoteControlScreen;
        const localReady: RemoteControlReadyScreen = Object.freeze({
          endpointId: session.localEndpointId,
          screen,
          streamId: event.streamId,
          trackSid: event.trackSid,
          widthPx: event.widthPx,
          heightPx: event.heightPx,
        });
        const next = Object.freeze({
          ...session,
          readyScreens: Object.freeze([
            ...session.readyScreens.filter(item => item.endpointId !== localReady.endpointId || item.screen !== screen),
            localReady,
          ]),
        });
        deps.replace(context, next);
        await deps.sendScreenReady(context, next, localReady);
        await deps.maybeActivate(context, next);
        return {status: 'ready'};
      }
      if (event.type === 'data' && Array.isArray(event.payload) && typeof event.senderIdentity === 'string')
        return deps.processData({
          context,
          session,
          senderIdentity: event.senderIdentity,
          bytes: event.payload.filter((byte): byte is number => typeof byte === 'number'),
        });
      if (event.type === 'geometry-changed' && typeof event.screen === 'string') {
        const screen = event.screen as RemoteControlScreen;
        await deps.cancelGesture({context, session, screen, reason: 'STALE_STREAM'});
        deps.replace(context, {
          ...session,
          readyScreens: Object.freeze(
            session.readyScreens.filter(item => item.endpointId !== session.localEndpointId || item.screen !== screen),
          ),
        });
        deps.log(context, 'screen-invalidated', {
          sessionId: session.sessionId,
          screen,
          generation: typeof event.generation === 'number' ? event.generation : -1,
        });
        return {status: 'screen-invalidated'};
      }
      if (event.type === 'local-input-conflict' && typeof event.screen === 'string') {
        const screen = event.screen as RemoteControlScreen;
        await deps.cancelGesture({context, session, screen, reason: 'INPUT_CONFLICT'});
        deps.log(context, 'local-input-preempted', {sessionId: session.sessionId, screen});
        return {status: 'local-input-preempted'};
      }
      return {status: 'ignored'};
    });
  });
