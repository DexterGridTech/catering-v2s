import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime'
import type {LogFields, PortResult} from '@catering-v2s/kernel-base-platform-ports'
import {powerStatusChangedCommand} from '../features/commands/powerStatusChanged'
import {displayDeviceTimeoutMs} from '../foundations/displayDevice'
import {isPowerSource, type PowerSource} from '../types/display'

const logBridge = (
  context: RuntimeModuleContext,
  event: string,
  message: string,
  data: LogFields,
): void => {
  context.platformPorts.logger.withContext({nodeId: context.localNodeId}).warn({
    category: 'display-context.power-bridge',
    event,
    message,
    data,
  })
}

const logNonSucceededPortResult = (
  context: RuntimeModuleContext,
  event: string,
  message: string,
  result: Exclude<PortResult<unknown>, {readonly status: 'succeeded'}>,
): void => {
  if (result.status === 'failed') {
    logBridge(context, event, message, {
      status: result.status,
      capability: result.capability,
      errorCode: result.error.code,
      retryable: result.error.retryable,
    })
    return
  }
  if (result.status === 'timed-out') {
    logBridge(context, event, message, {
      status: result.status,
      capability: result.capability,
      timeoutMs: result.timeoutMs,
    })
    return
  }
  logBridge(context, event, message, {
    status: result.status,
    capability: result.capability,
    reason: result.reason,
  })
}

export const installPowerStatusBridge = async (
  context: RuntimeModuleContext,
): Promise<void> => {
  let lastPowerSource: PowerSource | null = null
  let subscriptionId: string | null = null
  let active = true
  let dispatchTail: Promise<void> = Promise.resolve()

  const enqueue = (candidate: unknown): void => {
    if (!active || !isPowerSource(candidate)) {
      if (active) logBridge(context, 'power-bridge.event-invalid', 'Power bridge ignored an invalid event', {valueType: typeof candidate})
      return
    }
    if (lastPowerSource === null) {
      lastPowerSource = candidate
      return
    }
    if (lastPowerSource === candidate) return
    lastPowerSource = candidate
    dispatchTail = dispatchTail.then(async () => {
      if (!active) return
      try {
        const result = await context.dispatchCommand(powerStatusChangedCommand, Object.freeze({powerSource: candidate}))
        if (result.status !== 'completed') {
          logBridge(context, 'power-bridge.command-rejected', 'Power bridge command did not complete', {status: result.status})
        }
      } catch (error) {
        logBridge(context, 'power-bridge.command-failed', 'Power bridge command failed', {
          errorType: error instanceof Error ? error.name : typeof error,
        })
      }
    }).catch(error => {
      logBridge(context, 'power-bridge.dispatch-tail-failed', 'Power bridge dispatch tail failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      })
    })
  }

  let subscription: PortResult<{readonly subscriptionId: string}>
  try {
    subscription = await context.platformPorts.device.subscribePowerStatus({
      timeoutMs: displayDeviceTimeoutMs,
      listener: event => enqueue(event.status.source),
      onError: error => logBridge(context, 'power-bridge.subscription-error', 'Power status subscription reported an error', {
        errorCode: error.code,
      }),
    })
  } catch (error) {
    logBridge(context, 'power-bridge.subscription-rejected', 'Power status subscription rejected', {
      status: 'rejected',
      capability: 'subscribePowerStatus',
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return
  }
  if (subscription.status !== 'succeeded') {
    logNonSucceededPortResult(
      context,
      'power-bridge.subscription-unavailable',
      'Power status subscription was unavailable',
      subscription,
    )
    return
  }
  if (subscription.value.subscriptionId.trim().length === 0) {
    logBridge(context, 'power-bridge.subscription-invalid', 'Power status subscription returned an empty subscription id', {status: subscription.status})
    return
  }

  subscriptionId = subscription.value.subscriptionId
  const unregister = context.registerResource(() => {
    if (!active) return
    active = false
    const id = subscriptionId
    subscriptionId = null
    lastPowerSource = null
    dispatchTail = Promise.resolve()
    if (id === null) return
    void context.platformPorts.device.unsubscribePowerStatus({
      timeoutMs: displayDeviceTimeoutMs,
      subscriptionId: id,
    }).then(result => {
      if (result.status !== 'succeeded') {
        logNonSucceededPortResult(
          context,
          'power-bridge.unsubscribe-failed',
          'Power status unsubscribe did not complete',
          result,
        )
      }
    }).catch(error => {
      logBridge(context, 'power-bridge.unsubscribe-rejected', 'Power status unsubscribe rejected', {
        errorType: error instanceof Error ? error.name : typeof error,
      })
    })
  })
  // Runtime currently drains this registry only through test-only release.
  // Production has no stop/dispose lifecycle yet, so process exit reclaims
  // the native subscription; keep the disposer unused until that lifecycle exists.
  void unregister
}
