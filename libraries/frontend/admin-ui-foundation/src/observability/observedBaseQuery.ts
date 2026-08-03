import {fetchBaseQuery} from '@reduxjs/toolkit/query/react';
import type {BaseQueryFn, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta} from '@reduxjs/toolkit/query';
import {platformHttpProtocol} from '../http/platformHttpProtocol';
import type {SafeLogger} from './safeLogger';

const CORRELATION_HEADER = platformHttpProtocol.CORRELATION_ID;
const REQUEST_HEADER = platformHttpProtocol.REQUEST_ID;
const TRACE_HEADER = platformHttpProtocol.TRACE_ID;

const id = () => globalThis.crypto?.randomUUID?.() ?? 'frontend-' + Date.now() + '-' + Math.random().toString(16).slice(2);

const routeTemplate = (value: string) => value
  .split('?')[0]
  .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
  .replace(/\/[0-9]{4,}(?=\/|$)/g, '/:id');

const errorCode = (error: FetchBaseQueryError) => {
  const data = error.data;
  return typeof data === 'object' && data !== null && 'errorCode' in data && typeof data.errorCode === 'string'
    ? data.errorCode
    : undefined;
};

export type ObservedBaseQueryOptions = {
  baseUrl: string;
  credentials?: RequestCredentials;
  logger: SafeLogger;
  /** App-owned policy for an unauthenticated response (for example cache/session cleanup). */
  onUnauthorized?: () => void | Promise<void>;
  /** Registers a request controller without coupling foundation to an app store or router. */
  registerAbortController?: (controller: AbortController) => void | (() => void);
};

export const createObservedBaseQuery = (options: ObservedBaseQueryOptions): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta> => {
  const baseQuery = fetchBaseQuery({baseUrl: options.baseUrl, credentials: options.credentials ?? 'include'});
  return async (rawArgs, api, extraOptions) => {
    const started = performance.now();
    const args = typeof rawArgs === 'string' ? {url: rawArgs} : rawArgs;
    const {requiresSession = true, ...wireArgs} = args as FetchArgs & {requiresSession?: boolean};
    const headers = new Headers(args.headers as HeadersInit | undefined);
    const correlationId = headers.get(CORRELATION_HEADER) ?? id();
    const requestId = headers.get(REQUEST_HEADER) ?? id();
    const traceId = headers.get(TRACE_HEADER) ?? id();
    headers.set(CORRELATION_HEADER, correlationId);
    headers.set(REQUEST_HEADER, requestId);
    headers.set(TRACE_HEADER, traceId);
    const result = await (async () => {
      const controller = new AbortController();
      const abortApiRequest = () => api.abort('app-owned request cancellation');
      const abortController = () => controller.abort();
      controller.signal.addEventListener('abort', abortApiRequest, {once: true});
      api.signal.addEventListener('abort', abortController, {once: true});
      const unregisterAbortController = options.registerAbortController?.(controller);
      try {
        return await baseQuery({...wireArgs, headers}, api, extraOptions);
      } finally {
        unregisterAbortController?.();
        controller.signal.removeEventListener('abort', abortApiRequest);
        api.signal.removeEventListener('abort', abortController);
      }
    })();
    const response = result.meta?.response;
    const responseCorrelationId = response?.headers.get(CORRELATION_HEADER) ?? correlationId;
    const responseTraceId = response?.headers.get(TRACE_HEADER) ?? traceId;
    const status = result.error?.status ?? response?.status;
    const baseEvent = {
      owner: 'frontend-platform',
      instanceId: 'browser',
      phase: result.error ? 'request.failed' : 'request.completed',
      operationId: routeTemplate(String(args.url)),
      routeTemplate: routeTemplate(String(args.url)),
      correlationId: responseCorrelationId,
      requestId,
      traceId: responseTraceId,
      outcome: result.error ? 'ERROR' : 'SUCCESS',
      attempt: 1,
      status,
      requiresSession,
      durationMs: Math.round(performance.now() - started),
    };
    if (result.error) options.logger.error({...baseEvent, event: 'frontend.request.failed', errorCode: errorCode(result.error)});
    else options.logger.info({...baseEvent, event: 'frontend.request.completed'});
    if (status === 401 && requiresSession) {
      try {
        await options.onUnauthorized?.();
      } catch (error) {
        options.logger.error({...baseEvent, event: 'frontend.request.unauthorized-recovery-failed', errorCode: error instanceof Error ? error.name : 'UNAUTHORIZED_RECOVERY_FAILED'});
      }
    }
    return result;
  };
};
