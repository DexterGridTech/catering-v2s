import {ErrorBoundary} from 'react-error-boundary';
import {Linking} from 'react-native';
import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {resetRuntimeAfterSystemFailureCommand} from '@catering-v2s/kernel-base-runtime';
import {dispatchWithRequestId} from '../foundations/dispatchWithRequestId';
import {useDispatchCommand} from '../hooks/useDispatchCommand';
import {useRenderContext} from '../contexts/RenderContext';
import {SystemFailureNotice} from './SystemFailureNotice';

const errorNameOf = (error: unknown): string => (error instanceof Error ? error.name : 'UnknownError');

export function parseDebugFailureInjectionUrl(value: string | null): string | null | undefined {
  if (value === null) return undefined;
  if (value === 'ter-failure://clear') return null;
  const match = /^ter-failure:\/\/inject\/([^/?#]+)$/.exec(value);
  if (!match) return undefined;
  try {
    const ownerId = decodeURIComponent(match[1] ?? '');
    return /^[A-Za-z0-9:._-]{1,160}$/.test(ownerId) ? ownerId : undefined;
  } catch {
    return undefined;
  }
}

const DebugFailureInjection = ({
  ownerId,
  children,
}: Readonly<{readonly ownerId: string; readonly children: ReactNode}>) => {
  const [ready, setReady] = useState(!__DEV__);
  const [targetOwnerId, setTargetOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    let active = true;
    const applyUrl = (value: string | null) => {
      const target = parseDebugFailureInjectionUrl(value);
      if (!active || target === undefined) return;
      setTargetOwnerId(target);
      setReady(true);
    };
    const subscription = Linking.addEventListener('url', event => applyUrl(event.url));
    void Linking.getInitialURL().then(applyUrl, () => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!__DEV__) return children;
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
      <DebugFailureInjection ownerId={ownerId}>{children}</DebugFailureInjection>
    </ErrorBoundary>
  );
};
