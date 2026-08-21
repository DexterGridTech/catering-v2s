import {createApi} from '@reduxjs/toolkit/query/react';
import type {FetchArgs} from '@reduxjs/toolkit/query';
import {
  createBeaconLogSink,
  createObservedBaseQuery,
  createRefreshSignal,
  createSafeLogger,
  serializeJsonOrMultipartBody,
} from '@catering-v2s/admin-ui-foundation';
import {createOperationsAdminRtkEndpoints} from './generated/operations-edge.rtk';
import {createCatalogInventoryRtkEndpoints} from './generated/catalog-inventory-edge.rtk';
import {createPublicRtkEndpoints} from './generated/public-edge.rtk';
import type {
  FaceOperationContracts as OperationsFaceOperationContracts,
  FaceOperationRequest as OperationsFaceOperationRequest,
} from './generated/operations-edge';
import type {
  FaceOperationContracts as CatalogInventoryFaceOperationContracts,
  FaceOperationRequest as CatalogInventoryFaceOperationRequest,
} from './generated/catalog-inventory-edge';
import type {
  FaceOperationContracts as PublicFaceOperationContracts,
  FaceOperationRequest as PublicFaceOperationRequest,
} from './generated/public-edge';

const logger = createSafeLogger({
  service: 'operations-admin',
  enabled: import.meta.env.DEV,
  sink: createBeaconLogSink(import.meta.env.VITE_FRONTEND_LOG_SINK_URL),
});
/** Shared safe logger for feature-level workflow diagnostics. */
export const operationsLogger = logger;
const activeControllers = new Set<AbortController>();
let unauthorizedRecovery: (() => void | Promise<void>) | undefined;
export const operationsRefreshSignal = createRefreshSignal();
/** Shell-level content refresh; imperative read models subscribe without remounting the tab. */
export const operationsContentTabRefreshSignal = createRefreshSignal();

export function recordOperationsRenderError(_error: Error) {
  logger.error({event: 'frontend.render.failed', phase: 'render', outcome: 'ERROR', errorCode: 'UI_RENDER_ERROR'});
}

export function registerOperationsUnauthorizedRecovery(recovery: () => void | Promise<void>) {
  unauthorizedRecovery = recovery;
  return () => {
    if (unauthorizedRecovery === recovery) unauthorizedRecovery = undefined;
  };
}

export function abortOperationsRequests() {
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();
}

type ObservedFetchArgs<RequiresSession extends boolean> = FetchArgs & {requiresSession: RequiresSession};

function toWireRequest<RequiresSession extends boolean>(request: {
  path: string;
  pathParameters: object;
  method: string;
  requiresSession: RequiresSession;
  query?: object;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}): ObservedFetchArgs<RequiresSession> {
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

const toOperationsWireRequest = <I extends keyof OperationsFaceOperationContracts>(
  request: OperationsFaceOperationRequest<I>,
) => toWireRequest(request);
const toCatalogInventoryWireRequest = <I extends keyof CatalogInventoryFaceOperationContracts>(
  request: CatalogInventoryFaceOperationRequest<I>,
) => toWireRequest(request);
const toPublicWireRequest = <I extends keyof PublicFaceOperationContracts>(request: PublicFaceOperationRequest<I>) =>
  toWireRequest(request);

/** Operations and public generated slices share one app-owned, cookie-only RTK substrate. */
export const operationsApi = createApi({
  reducerPath: 'operationsApi',
  baseQuery: createObservedBaseQuery({
    baseUrl: '/',
    credentials: 'include',
    logger,
    onUnauthorized: async () => {
      await unauthorizedRecovery?.();
    },
    registerAbortController: controller => {
      activeControllers.add(controller);
      return () => activeControllers.delete(controller);
    },
  }),
  tagTypes: ['wire', 'catalogInventory'],
  endpoints: build => ({
    ...createOperationsAdminRtkEndpoints(build, toOperationsWireRequest),
    ...createCatalogInventoryRtkEndpoints(build, toCatalogInventoryWireRequest),
    ...createPublicRtkEndpoints(build, toPublicWireRequest),
  }),
});

function expandPath(template: string, pathParameters: object): string {
  let unresolved = template;
  for (const [name, value] of Object.entries(pathParameters))
    unresolved = unresolved.replace(`{${name}}`, encodeURIComponent(String(value)));
  if (/\{[^}]+\}/.test(unresolved)) throw new Error(`OPERATIONS_EDGE_PATH_PARAMETER_MISSING:${template}`);
  return unresolved;
}
