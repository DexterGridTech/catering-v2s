import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {TransportConnectionOwner} from '../../foundations/createTransportConnectionOwner';
import type {TransportHttpExecutionResult, TransportHttpRequest} from '../../types/runtimeControl';
import {
  transportInvalidCommand,
  transportHttpAddressAvailableCommand,
  transportHttpRequestCommand,
  transportNetworkStatusChangedCommand,
  transportReadyCommand,
  transportReadyTimeoutCommand,
  transportRetryDueCommand,
  transportStablePeriodElapsedCommand,
  transportStartCommand,
  transportStopCommand,
} from '../commands/transportCommands';

export type TransportHttpActorBoundary = Readonly<{
  readonly readRequest: (requestId: string) => TransportHttpRequest | undefined;
  readonly writeResult: (requestId: string, result: TransportHttpExecutionResult) => void;
}>;

export const createTransportActor = (
  owner: TransportConnectionOwner,
  httpBoundary: TransportHttpActorBoundary,
): ActorDefinition =>
  defineActor(moduleName, 'connection-owner', [
    onCommand(transportStartCommand, async context => {
      await owner.start(context.command.payload);
      return Object.freeze({status: 'started'});
    }),
    onCommand(transportReadyCommand, context => {
      owner.ready(context.command.payload.profileId, context.command.payload.stableAfterMs);
      return Object.freeze({status: 'ready'});
    }),
    onCommand(transportInvalidCommand, async context => {
      await owner.invalid(context.command.payload.profileId, context.command.payload.cause);
      return Object.freeze({status: 'retrying'});
    }),
    onCommand(transportStopCommand, async context => {
      await owner.stop(context.command.payload.profileId);
      return Object.freeze({status: 'stopped'});
    }),
    onCommand(transportHttpRequestCommand, async context => {
      const {requestId} = context.command.payload;
      const request = httpBoundary.readRequest(requestId);
      if (request === undefined) throw new Error('TRANSPORT_HTTP_REQUEST_NOT_FOUND');
      const result = await owner.executeHttp(request);
      httpBoundary.writeResult(requestId, result);
      return Object.freeze({status: 'executed'});
    }),
    onCommand(transportHttpAddressAvailableCommand, context => {
      owner.reportHttpAddressAvailable(context.command.payload);
      return Object.freeze({status: 'accepted'});
    }),
    onCommand(transportNetworkStatusChangedCommand, context => {
      owner.networkStatusChanged(context.command.payload.connected);
      return Object.freeze({status: 'observed'});
    }),
    onCommand(transportRetryDueCommand, async context => {
      await owner.retryDue(context.command.payload.profileId, context.command.payload.token);
      return Object.freeze({status: 'processed'});
    }),
    onCommand(transportReadyTimeoutCommand, async context => {
      await owner.readyTimeout(context.command.payload.profileId, context.command.payload.token);
      return Object.freeze({status: 'processed'});
    }),
    onCommand(transportStablePeriodElapsedCommand, context => {
      owner.stablePeriodElapsed(context.command.payload.profileId, context.command.payload.token);
      return Object.freeze({status: 'processed'});
    }),
  ]);
