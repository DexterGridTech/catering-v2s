import {
  type FaceOperationContracts as OperationsFaceOperationContracts,
  type FaceOperationRequest as OperationsFaceOperationRequest,
  type FaceExecutor as OperationsFaceExecutor,
  createOperationsAdminClient,
  EDGE_PROBLEM_CODES as OPERATIONS_EDGE_PROBLEM_CODES,
  type EdgeProblemCode as OperationsEdgeProblemCode,
} from './generated/operations-edge';
import {
  type FaceOperationContracts as PublicFaceOperationContracts,
  type FaceOperationRequest as PublicFaceOperationRequest,
  type FaceExecutor as PublicFaceExecutor,
  createPublicClient,
  EDGE_PROBLEM_CODES as PUBLIC_EDGE_PROBLEM_CODES,
  type EdgeProblemCode as PublicEdgeProblemCode,
} from './generated/public-edge';
import {abortOperationsRequests, operationsApi, operationsRefreshSignal, registerOperationsUnauthorizedRecovery} from './OperationsApi';
import {operationsStore} from '../state/OperationsStore';

export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  errorCode: OperationsEdgeProblemCode | PublicEdgeProblemCode | 'NETWORK_ERROR';
  correlationId: string;
};
export class ApiFailure extends Error { constructor(public readonly problem: ApiProblem) { super(problem.detail); } }
const operationsProblemCodes = new Set<string>(OPERATIONS_EDGE_PROBLEM_CODES);
const publicProblemCodes = new Set<string>(PUBLIC_EDGE_PROBLEM_CODES);

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
    const value = data as {status?: unknown; errorCode?: unknown; correlationId?: unknown};
    const candidate = value.errorCode;
    const errorCode = typeof candidate === 'string'
      && (operationsProblemCodes.has(candidate) || publicProblemCodes.has(candidate))
      ? candidate as OperationsEdgeProblemCode | PublicEdgeProblemCode
      : 'NETWORK_ERROR';
    return {
      type: 'about:blank',
      title: '请求失败',
      status: typeof value.status === 'number' ? value.status : 0,
      detail: '请求未完成，请根据错误码检查后重试。',
      errorCode,
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : '',
    };
  }
  return {type: 'about:blank', title: '请求失败', status: 0, detail: '无法连接运营服务。', errorCode: 'NETWORK_ERROR', correlationId: ''};
}
