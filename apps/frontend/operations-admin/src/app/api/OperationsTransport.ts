import {
  type FaceOperationContracts as OperationsFaceOperationContracts,
  type FaceOperationRequest as OperationsFaceOperationRequest,
  type FaceExecutor as OperationsFaceExecutor,
  createOperationsAdminClient,
  type EdgeProblemCode as OperationsEdgeProblemCode,
} from './generated/operations-edge';
import {
  type FaceOperationContracts as PublicFaceOperationContracts,
  type FaceOperationRequest as PublicFaceOperationRequest,
  type FaceExecutor as PublicFaceExecutor,
  createPublicClient,
  type EdgeProblemCode as PublicEdgeProblemCode,
} from './generated/public-edge';
import {isOperationsProblemCode, operationsProblemFeedback, type ProblemFeedback} from './operationsProblemFeedback';
import {abortOperationsRequests, operationsApi, operationsRefreshSignal, registerOperationsUnauthorizedRecovery} from './OperationsApi';
import {operationsStore} from '../state/OperationsStore';

export type ApiProblem = ProblemFeedback & {
  type: string;
  title: string;
  status: number;
  errorCode: OperationsEdgeProblemCode | PublicEdgeProblemCode | 'NETWORK_ERROR';
  correlationId: string;
  /** Contract fields are retained for diagnostics, never rendered by UI. */
  contractTitle?: string;
  contractDetail?: string;
};
export class ApiFailure extends Error { constructor(public readonly problem: ApiProblem) { super(problem.detail); } }

async function dispatchWire<Response>(
  operationId: string,
  request: object,
): Promise<Response> {
  const endpoint = (operationsApi.endpoints as Record<string, unknown>)[operationId] as {
    initiate: (arg: object) => unknown;
  };
  const pending = operationsStore.dispatch(endpoint.initiate(request) as never) as {unwrap: () => Promise<unknown>};
  try {
    const response = await pending.unwrap() as Response;
    if ('method' in request && typeof request.method === 'string' && request.method.toUpperCase() !== 'GET') operationsRefreshSignal.publish();
    return response;
  } catch (error) {
    throw new ApiFailure(problem(error));
  }
}

const executeOperations: OperationsFaceExecutor = async <I extends keyof OperationsFaceOperationContracts>(
  request: OperationsFaceOperationRequest<I>,
): Promise<OperationsFaceOperationContracts[I]['response']> => dispatchWire(request.operationId, request);

const executePublic: PublicFaceExecutor = async <I extends keyof PublicFaceOperationContracts>(
  request: PublicFaceOperationRequest<I>,
): Promise<PublicFaceOperationContracts[I]['response']> => dispatchWire(request.operationId, request);

export const operationsClient = createOperationsAdminClient(executeOperations);
export const publicClient = createPublicClient(executePublic);

/** Generated RTK hook failures retain the same user-facing problem normalization as client calls. */
export function operationsProblemOf(error: unknown): ApiProblem {
  return error instanceof ApiFailure ? error.problem : problem(error);
}

export function clearOperationsTransportState() {
  abortOperationsRequests();
  operationsStore.dispatch(operationsApi.util.resetApiState());
}

export function registerOperationsSessionRecovery(recovery: () => void | Promise<void>) {
  return registerOperationsUnauthorizedRecovery(recovery);
}

export {operationsRefreshSignal};
/** Feature-facing generated RTK hooks stay behind the app transport boundary. */
export const operationsRtk = operationsApi;

function problem(error: unknown): ApiProblem {
  const data = typeof error === 'object' && error !== null && 'data' in error ? (error as {data?: unknown}).data : undefined;
  if (typeof data === 'object' && data !== null) {
    const value = data as {type?: unknown; title?: unknown; status?: unknown; detail?: unknown; errorCode?: unknown; correlationId?: unknown};
    const errorCode = isOperationsProblemCode(value.errorCode)
      ? value.errorCode
      : 'PLATFORM_COMMON_RESULT_UNKNOWN';
    const feedback = operationsProblemFeedback(errorCode);
    return {
      ...feedback,
      type: typeof value.type === 'string' ? value.type : 'about:blank',
      status: typeof value.status === 'number' ? value.status : 0,
      errorCode,
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : '',
      contractTitle: typeof value.title === 'string' ? value.title : undefined,
      contractDetail: typeof value.detail === 'string' ? value.detail : undefined,
    };
  }
  return {...operationsProblemFeedback('NETWORK_ERROR'), type: 'about:blank', status: 0, errorCode: 'NETWORK_ERROR', correlationId: ''};
}
