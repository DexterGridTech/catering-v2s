import {ErrorBoundary} from 'react-error-boundary';
import {Linking} from 'react-native';
import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {resetRuntimeAfterSystemFailureCommand} from '@catering-v2s/kernel-base-runtime';
import {dispatchWithRequestId} from '../foundations/dispatchWithRequestId';
import {useDispatchCommand} from '../hooks/useDispatchCommand';
import {useRenderContext} from '../contexts/RenderContext';
import {SystemFailureNotice} from './SystemFailureNotice';

const errorNameOf = (error: unknown): string => (error instanceof Error ? error.name : 'UnknownError');

export const isDebugFailureInjectionEnabled = (devMode: boolean, buildFlag: string | undefined): boolean =>
  devMode || buildFlag === 'true';

const debugFailureInjectionEnabled = isDebugFailureInjectionEnabled(
  __DEV__,
  process.env.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION,
);

export function parseDebugFailureInjectionUrl(value: string | null): string | null | undefined {
  if (value === null) return undefined;
  if (value === 'ter-failure://clear') return null;
  const match = /^ter-failure:\/\/inject\/([^/?#]+)$/.exec(value);
  if (match) {
    try {
      const ownerId = decodeURIComponent(match[1] ?? '');
      return /^[A-Za-z0-9:._-]{1,160}$/.test(ownerId) ? ownerId : undefined;
    } catch {
      return undefined;
    }
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const owners = url.searchParams.getAll('terFailureOwner');
    if (owners.length !== 1) return undefined;
    const ownerId = owners[0] ?? '';
    if (ownerId === 'clear') return null;
    return /^[A-Za-z0-9:._-]{1,160}$/.test(ownerId) ? ownerId : undefined;
  } catch {
    return undefined;
  }
}

const DebugFailureInjection = ({
  ownerId,
  children,
  logger,
}: Readonly<{
  readonly ownerId: string;
  readonly children: ReactNode;
  readonly logger: ReturnType<typeof useRenderContext>['logger'];
}>) => {
  const [ready, setReady] = useState(!debugFailureInjectionEnabled);
  const [targetOwnerId, setTargetOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!debugFailureInjectionEnabled) return;
    let active = true;
    const applyUrl = (value: string | null, source: 'initial' | 'event') => {
      const target = parseDebugFailureInjectionUrl(value);
      if (!active) return;
      const outcome =
        value === null
          ? 'no-url'
          : target === undefined
            ? 'unrecognized'
            : target === null
              ? 'clear'
              : target === ownerId
                ? 'matched'
                : 'other-owner';
      logger.info({
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.debug-injection-resolution',
        message: `TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=${source} owner=${ownerId} outcome=${outcome}`,
        data: {ownerId, source, urlPresent: value !== null, outcome},
      });
      if (target !== undefined) setTargetOwnerId(target);
      setReady(true);
    };
    const subscription = Linking.addEventListener('url', event => applyUrl(event.url, 'event'));
    void Linking.getInitialURL().then(
      value => applyUrl(value, 'initial'),
      () => {
        if (active) {
          logger.warn({
            category: 'runtime.system-failure',
            event: 'runtime.system-failure.debug-injection-read-failed',
            message: `TER_DEBUG_FAILURE_INJECTION_READ_FAILED source=initial owner=${ownerId}`,
            data: {ownerId, source: 'initial'},
          });
          setReady(true);
        }
      },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [logger, ownerId]);

  if (!debugFailureInjectionEnabled) return children;
  if (!ready) return null;
  if (targetOwnerId === ownerId) throw new Error('TER_DEBUG_FAILURE_INJECTION');
  return children;
};

export const SystemFailureNoticeWithReset = ({ownerId}: Readonly<{readonly ownerId: string}>) => {
  const dispatchCommand = useDispatchCommand();
  const onDismiss = useCallback(() => {
    void dispatchWithRequestId({
      dispatchCommand,
      definition: resetRuntimeAfterSystemFailureCommand,
      payload: Object.freeze({}),
    }).catch(() => undefined);
  }, [dispatchCommand]);

  return <SystemFailureNotice testIDPrefix={`ui-base-render:system-failure:${ownerId}`} onDismiss={onDismiss} />;
};

export const SystemFailureBoundary = ({
  ownerId,
  children,
  fallback,
}: Readonly<{
  readonly ownerId: string;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}>) => {
  const {logger} = useRenderContext();
  const onError = useCallback(
    (error: unknown) => {
      logger.error({
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.render-failed',
        message: 'A rendered terminal region failed',
        data: {ownerId, errorName: errorNameOf(error)},
      });
    },
    [logger, ownerId],
  );

  return (
    <ErrorBoundary
      onError={onError}
      fallbackRender={() => fallback ?? <SystemFailureNoticeWithReset ownerId={ownerId} />}
    >
      <DebugFailureInjection ownerId={ownerId} logger={logger}>
        {children}
      </DebugFailureInjection>
    </ErrorBoundary>
  );
};
