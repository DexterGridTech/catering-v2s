import {createApi} from '@reduxjs/toolkit/query/react';
import type {FetchArgs} from '@reduxjs/toolkit/query';
import {createObservedBaseQuery, createRefreshSignal, createSafeLogger, serializeJsonOrMultipartBody} from '@catering-v2s/admin-ui-foundation';
import {createPlatformAdminRtkEndpoints} from './generated/platform-edge.rtk';
import type {FaceOperationContracts, FaceOperationRequest} from './generated/platform-edge';

const logger = createSafeLogger({service: 'platform-admin', enabled: import.meta.env.DEV});
const activeControllers = new Set<AbortController>();
let unauthorizedRecovery: (() => void | Promise<void>) | undefined;
/** Successful generated commands publish here; read models remain app-owned subscribers. */
export const platformRefreshSignal = createRefreshSignal();

/** The platform shell owns the outcome; this substrate only fans a 401 out once. */
export function registerPlatformUnauthorizedRecovery(recovery: () => void | Promise<void>) {
  unauthorizedRecovery = recovery;
  return () => { if (unauthorizedRecovery === recovery) unauthorizedRecovery = undefined; };
}

/** Local session transitions call this before cache reset so outstanding responses cannot win late. */
export function abortPlatformRequests() {
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();
}

type ObservedFetchArgs<RequiresSession extends boolean> = FetchArgs & {requiresSession: RequiresSession};

function toWireRequest<I extends keyof FaceOperationContracts>(request: FaceOperationRequest<I>): ObservedFetchArgs<FaceOperationContracts[I]['requiresSession']> {
  const path = expandPath(request.path, request.pathParameters);
  const query = new URLSearchParams(
    Object.entries(request.query ?? {})
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([name, value]) => [name, String(value)]),
  );
  const headers = new Headers(request.headers);
  headers.set('Accept', 'application/json');
  return {
    url: query.size === 0 ? path : `${path}?${query.toString()}`,
    method: request.method.toUpperCase(),
    headers,
    body: serializeJsonOrMultipartBody(request.body, headers),
    requiresSession: request.requiresSession,
  };
}

/** App-owned RTK transport substrate; feature facades consume this boundary instead of raw fetch. */
export const platformApi = createApi({
  reducerPath: 'platformApi',
  baseQuery: createObservedBaseQuery({
    baseUrl: '/',
    credentials: 'include',
    logger,
    onUnauthorized: async () => { await unauthorizedRecovery?.(); },
    registerAbortController: (controller) => {
      activeControllers.add(controller);
      return () => activeControllers.delete(controller);
    },
  }),
  tagTypes: ['wire'],
  endpoints: (build) => createPlatformAdminRtkEndpoints(build, toWireRequest),
});

function expandPath(template: string, pathParameters: object): string {
  let unresolved = template;
  for (const [name, value] of Object.entries(pathParameters)) unresolved = unresolved.replace(`{${name}}`, encodeURIComponent(String(value)));
  if (/\{[^}]+\}/.test(unresolved)) throw new Error(`PLATFORM_EDGE_PATH_PARAMETER_MISSING:${template}`);
  return unresolved;
}
