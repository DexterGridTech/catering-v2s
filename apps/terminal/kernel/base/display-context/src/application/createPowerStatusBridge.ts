import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {LogFields, PortResult} from '@catering-v2s/kernel-base-platform-ports';
import {powerStatusChangedCommand} from '../features/commands/powerStatusChanged';
import {displayDeviceTimeoutMs} from '../foundations/displayDevice';
import {isPowerSource, type PowerSource} from '../types/display';

const logBridge = (
  input: Readonly<{
    context: RuntimeModuleContext;
    event: string;
    message: string;
    data: LogFields;
  }>,
): void => {
  input.context.platformPorts.logger.withContext({nodeId: input.context.localNodeId}).warn({
    category: 'display-context.power-bridge',
    event: input.event,
    message: input.message,
    data: input.data,
  });
};

const logNonSucceededPortResult = (
  input: Readonly<{
    context: RuntimeModuleContext;
    event: string;
    message: string;
    result: Exclude<PortResult<unknown>, {readonly status: 'succeeded'}>;
  }>,
): void => {
  if (input.result.status === 'failed') {
    logBridge({
      context: input.context,
      event: input.event,
      message: input.message,
      data: {
        status: input.result.status,
        capability: input.result.capability,
        errorCode: input.result.error.code,
        retryable: input.result.error.retryable,
      },
    });
    return;
  }
  if (input.result.status === 'timed-out') {
    logBridge({
      context: input.context,
      event: input.event,
      message: input.message,
      data: {
        status: input.result.status,
        capability: input.result.capability,
        timeoutMs: input.result.timeoutMs,
      },
    });
    return;
  }
  logBridge({
    context: input.context,
    event: input.event,
    message: input.message,
    data: {
      status: input.result.status,
      capability: input.result.capability,
      reason: input.result.reason,
    },
  });
};

export const installPowerStatusBridge = async (context: RuntimeModuleContext): Promise<void> => {
  let lastPowerSource: PowerSource | null = null;
  let subscriptionId: string | null = null;
  let active = true;
  let dispatchTail: Promise<void> = Promise.resolve();

  const enqueue = (candidate: unknown): void => {
    if (!active || !isPowerSource(candidate)) {
      if (active)
        logBridge({
          context,
          event: 'power-bridge.event-invalid',
          message: 'Power bridge ignored an invalid event',
          data: {valueType: typeof candidate},
        });
      return;
    }
    if (lastPowerSource === null) {
      lastPowerSource = candidate;
      return;
    }
    if (lastPowerSource === candidate) return;
    lastPowerSource = candidate;
    dispatchTail = dispatchTail
      .then(async () => {
        if (!active) return;
        try {
          const result = await context.dispatchCommand(
            powerStatusChangedCommand,
            Object.freeze({powerSource: candidate}),
          );
          if (result.status !== 'completed') {
            logBridge({
              context,
              event: 'power-bridge.command-rejected',
              message: 'Power bridge command did not complete',
              data: {status: result.status},
            });
          }
        } catch (error) {
          logBridge({
            context,
            event: 'power-bridge.command-failed',
            message: 'Power bridge command failed',
            data: {
              errorType: error instanceof Error ? error.name : typeof error,
            },
          });
        }
      })
      .catch(error => {
        logBridge({
          context,
          event: 'power-bridge.dispatch-tail-failed',
          message: 'Power bridge dispatch tail failed',
          data: {
            errorType: error instanceof Error ? error.name : typeof error,
          },
        });
      });
  };

  let subscription: PortResult<{readonly subscriptionId: string}>;
  try {
    subscription = await context.platformPorts.device.subscribePowerStatus({
      timeoutMs: displayDeviceTimeoutMs,
      listener: event => enqueue(event.status.source),
      onError: error =>
        logBridge({
          context,
          event: 'power-bridge.subscription-error',
          message: 'Power status subscription reported an error',
          data: {
            errorCode: error.code,
          },
        }),
    });
  } catch (error) {
    logBridge({
      context,
      event: 'power-bridge.subscription-rejected',
      message: 'Power status subscription rejected',
      data: {
        status: 'rejected',
        capability: 'subscribePowerStatus',
        errorType: error instanceof Error ? error.name : typeof error,
      },
    });
    return;
  }
  if (subscription.status !== 'succeeded') {
    logNonSucceededPortResult({
      context,
      event: 'power-bridge.subscription-unavailable',
      message: 'Power status subscription was unavailable',
      result: subscription,
    });
    return;
  }
  if (subscription.value.subscriptionId.trim().length === 0) {
    logBridge({
      context,
      event: 'power-bridge.subscription-invalid',
      message: 'Power status subscription returned an empty subscription id',
      data: {status: subscription.status},
    });
    return;
  }

  subscriptionId = subscription.value.subscriptionId;
  const unregister = context.registerResource(() => {
    if (!active) return;
    active = false;
    const id = subscriptionId;
    subscriptionId = null;
    lastPowerSource = null;
    dispatchTail = Promise.resolve();
    if (id === null) return;
    void context.platformPorts.device
      .unsubscribePowerStatus({
        timeoutMs: displayDeviceTimeoutMs,
        subscriptionId: id,
      })
      .then(result => {
        if (result.status !== 'succeeded') {
          logNonSucceededPortResult({
            context,
            event: 'power-bridge.unsubscribe-failed',
            message: 'Power status unsubscribe did not complete',
            result,
          });
        }
      })
      .catch(error => {
        logBridge({
          context,
          event: 'power-bridge.unsubscribe-rejected',
          message: 'Power status unsubscribe rejected',
          data: {
            errorType: error instanceof Error ? error.name : typeof error,
          },
        });
      });
  });
  // Runtime currently drains this registry only through test-only release.
  // Production has no stop/dispose lifecycle yet, so process exit reclaims
  // the native subscription; keep the disposer unused until that lifecycle exists.
  void unregister;
};
