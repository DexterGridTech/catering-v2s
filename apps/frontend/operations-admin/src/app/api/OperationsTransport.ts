import {
  type FaceOperationContracts as OperationsFaceOperationContracts,
  type FaceOperationRequest as OperationsFaceOperationRequest,
  type FaceExecutor as OperationsFaceExecutor,
  createOperationsAdminClient,
  type EdgeProblemCode as OperationsEdgeProblemCode,
} from './generated/operations-edge';
import {
  CATALOG_INVENTORY_PROBLEM_CODES,
  createCatalogInventoryClient,
  type CatalogInventoryProblemCode,
  type FaceExecutor as CatalogInventoryFaceExecutor,
  type FaceOperationContracts as CatalogInventoryFaceOperationContracts,
  type FaceOperationRequest as CatalogInventoryFaceOperationRequest,
} from './generated/catalog-inventory-edge';
import {
  type FaceOperationContracts as PublicFaceOperationContracts,
  type FaceOperationRequest as PublicFaceOperationRequest,
  type FaceExecutor as PublicFaceExecutor,
  createPublicClient,
  type EdgeProblemCode as PublicEdgeProblemCode,
} from './generated/public-edge';
import {isOperationsProblemCode, operationsProblemFeedback, type ProblemFeedback} from './operationsProblemFeedback';
import {
  abortOperationsRequests,
  operationsApi,
  operationsContentTabRefreshSignal,
  operationsRefreshSignal,
  registerOperationsUnauthorizedRecovery,
} from './OperationsApi';
import {operationsStore} from '../state/OperationsStore';

export type ApiProblem = ProblemFeedback & {
  type: string;
  title: string;
  status: number;
  errorCode: OperationsEdgeProblemCode | PublicEdgeProblemCode | CatalogInventoryProblemCode | 'NETWORK_ERROR';
  correlationId: string;
  /** Contract fields are retained for diagnostics, never rendered by UI. */
  contractTitle?: string;
  contractDetail?: string;
};
export class ApiFailure extends Error {
  constructor(public readonly problem: ApiProblem) {
    super(problem.detail);
  }
}

type WireInitiateOptions = {subscribe?: boolean; track?: boolean};
type PendingWireRequest = {unwrap: () => Promise<unknown>; unsubscribe?: () => void; reset?: () => void};
let contextStaleRecovery: (() => void | Promise<void>) | undefined;

export function registerOperationsContextStaleRecovery(recovery: () => void | Promise<void>) {
  contextStaleRecovery = recovery;
  return () => {
    if (contextStaleRecovery === recovery) contextStaleRecovery = undefined;
  };
}

async function dispatchWire<Response>(operationId: string, request: object): Promise<Response> {
  const endpoint = (operationsApi.endpoints as Record<string, unknown>)[operationId] as {
    initiate: (arg: object, options?: WireInitiateOptions) => unknown;
  };
  const method = 'method' in request && typeof request.method === 'string' ? request.method.toUpperCase() : 'POST';
  const pending = operationsStore.dispatch(
    endpoint.initiate(request, method === 'GET' ? {subscribe: false} : {track: false}) as never,
  ) as PendingWireRequest;
  try {
    const response = (await pending.unwrap()) as Response;
    if ('method' in request && typeof request.method === 'string' && request.method.toUpperCase() !== 'GET')
      operationsRefreshSignal.publish();
    return response;
  } catch (error) {
    const failure = problem(error);
    if (failure.errorCode === 'PLATFORM_COMMON_CONTEXT_STALE') {
      try {
        await contextStaleRecovery?.();
      } catch {
        /* Keep the original owner response visible. */
      }
    }
    throw new ApiFailure(failure);
  } finally {
    pending.unsubscribe?.();
    pending.reset?.();
  }
}

const executeOperations: OperationsFaceExecutor = async <I extends keyof OperationsFaceOperationContracts>(
  request: OperationsFaceOperationRequest<I>,
): Promise<OperationsFaceOperationContracts[I]['response']> => dispatchWire(request.operationId, request);

const executePublic: PublicFaceExecutor = async <I extends keyof PublicFaceOperationContracts>(
  request: PublicFaceOperationRequest<I>,
): Promise<PublicFaceOperationContracts[I]['response']> => dispatchWire(request.operationId, request);

const executeCatalogInventory: CatalogInventoryFaceExecutor = async <
  I extends keyof CatalogInventoryFaceOperationContracts,
>(
  request: CatalogInventoryFaceOperationRequest<I>,
): Promise<CatalogInventoryFaceOperationContracts[I]['response']> => dispatchWire(request.operationId, request);

export const operationsClient = createOperationsAdminClient(executeOperations);
export const publicClient = createPublicClient(executePublic);
export const catalogInventoryClient = createCatalogInventoryClient(executeCatalogInventory);

/** Generated RTK hook failures retain the same user-facing problem normalization as client calls. */
export function operationsProblemOf(error: unknown): ApiProblem {
  return error instanceof ApiFailure ? error.problem : problem(error);
}

export function clearOperationsTransportState() {
  abortOperationsRequests();
  operationsStore.dispatch(operationsApi.util.resetApiState());
}

/** Refreshes active page queries without remounting their filters or pagination state. */
export function refreshOperationsCurrentPage() {
  operationsStore.dispatch(
    operationsApi.util.invalidateTags([
      {type: 'wire', id: 'LIST'},
      {type: 'catalogInventory', id: 'LIST'},
    ]),
  );
  operationsContentTabRefreshSignal.publish();
}

export function registerOperationsSessionRecovery(recovery: () => void | Promise<void>) {
  return registerOperationsUnauthorizedRecovery(recovery);
}

/** The app shell observes render failures through the transport boundary. */
export {operationsLogger, recordOperationsRenderError} from './OperationsApi';

export {operationsContentTabRefreshSignal, operationsRefreshSignal};
/** Feature-facing generated RTK hooks stay behind the app transport boundary. */
export const operationsRtk = operationsApi;

function problem(error: unknown): ApiProblem {
  const responseStatus = transportResponseStatus(error);
  const hasData = typeof error === 'object' && error !== null && 'data' in error;
  const data = hasData ? (error as {data?: unknown}).data : undefined;
  if (typeof data === 'object' && data !== null) {
    const value = data as {
      type?: unknown;
      title?: unknown;
      status?: unknown;
      detail?: unknown;
      errorCode?: unknown;
      correlationId?: unknown;
    };
    const errorCode = isOperationsProblemCode(value.errorCode)
      ? value.errorCode
      : isCatalogInventoryProblemCode(value.errorCode)
        ? value.errorCode
        : 'PLATFORM_COMMON_RESULT_UNKNOWN';
    const feedback = isOperationsProblemCode(errorCode)
      ? operationsProblemFeedback(errorCode)
      : isCatalogInventoryProblemCode(errorCode)
        ? {
            title: '商品与库存操作失败',
            detail:
              typeof value.detail === 'string' && value.detail ? value.detail : '请检查当前商品与库存资料后重试。',
          }
        : operationsProblemFeedback('PLATFORM_COMMON_RESULT_UNKNOWN');
    return {
      ...feedback,
      type: typeof value.type === 'string' ? value.type : 'about:blank',
      status: typeof value.status === 'number' ? value.status : (responseStatus ?? 0),
      errorCode,
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : '',
      contractTitle: typeof value.title === 'string' ? value.title : undefined,
      contractDetail: typeof value.detail === 'string' ? value.detail : undefined,
    };
  }
  if (responseStatus !== undefined || (hasData && (data === null || typeof data === 'string'))) {
    return {
      ...operationsProblemFeedback('PLATFORM_COMMON_RESULT_UNKNOWN'),
      type: 'about:blank',
      status: responseStatus ?? 0,
      errorCode: 'PLATFORM_COMMON_RESULT_UNKNOWN',
      correlationId: '',
    };
  }
  return {
    ...operationsProblemFeedback('NETWORK_ERROR'),
    type: 'about:blank',
    status: 0,
    errorCode: 'NETWORK_ERROR',
    correlationId: '',
  };
}

function transportResponseStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = error as {status?: unknown; originalStatus?: unknown};
  if (typeof value.originalStatus === 'number') return value.originalStatus;
  return typeof value.status === 'number' ? value.status : undefined;
}

function isCatalogInventoryProblemCode(value: unknown): value is CatalogInventoryProblemCode {
  return typeof value === 'string' && (CATALOG_INVENTORY_PROBLEM_CODES as readonly string[]).includes(value);
}
