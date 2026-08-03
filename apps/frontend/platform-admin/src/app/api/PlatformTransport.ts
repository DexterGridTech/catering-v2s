import {
  type FaceOperationContracts,
  type FaceOperationRequest,
  type FaceExecutor,
  createPlatformAdminClient,
  type EdgeProblemCode,
} from './generated/platform-edge';
import {abortPlatformRequests, platformApi, platformRefreshSignal, registerPlatformUnauthorizedRecovery} from './PlatformApi';
import {platformStore} from '../state/PlatformStore';
import {platformProblemFeedback, isPlatformProblemCode, type ProblemFeedback} from './platformProblemFeedback';

export type PlatformApiProblem = ProblemFeedback & {
  type: string;
  status: number;
  errorCode: EdgeProblemCode | 'NETWORK_ERROR';
  correlationId: string;
  /** Contract fields are retained for diagnostics, never rendered by UI. */
  contractTitle?: string;
  contractDetail?: string;
};
/** Every platform transport failure is an Error so boundaries and recovery UI retain a real cause. */
export class PlatformApiFailure extends Error {
  constructor(public readonly problem: PlatformApiProblem) {
    super(problem.detail);
    this.name = 'PlatformApiFailure';
  }
  get title() { return this.problem.title; }
  get detail() { return this.problem.detail; }
  get errorCode() { return this.problem.errorCode; }
}
/**
 * The generated client is the only feature-facing HTTP surface. Operation ids,
 * paths, methods, request bodies, query fields and required headers all remain
 * closed over the generated contract.
 */
const execute: FaceExecutor = async <I extends keyof FaceOperationContracts>(
  request: FaceOperationRequest<I>,
): Promise<FaceOperationContracts[I]['response']> => {
  const endpoint = platformApi.endpoints[request.operationId] as unknown as {
    initiate: (arg: FaceOperationRequest<I>) => unknown;
  };
  const pending = platformStore.dispatch(endpoint.initiate(request) as never) as {unwrap: () => Promise<unknown>};
  try {
    const response = await pending.unwrap() as FaceOperationContracts[I]['response'];
    if (request.method.toUpperCase() !== 'GET') platformRefreshSignal.publish();
    return response;
  } catch (error) {
    throw new PlatformApiFailure(problem(error));
  }
};

export function platformProblemOf(error: unknown): PlatformApiProblem {
  return error instanceof PlatformApiFailure ? error.problem : problem(error);
}

/** App shell cleanup stays on the transport boundary; callers cannot reach raw RTK internals. */
export function clearPlatformTransportState() {
  abortPlatformRequests();
  platformStore.dispatch(platformApi.util.resetApiState());
}

export function registerPlatformSessionRecovery(recovery: () => void | Promise<void>) {
  return registerPlatformUnauthorizedRecovery(recovery);
}

export {platformRefreshSignal};
/** Feature-facing generated RTK hooks stay behind the app transport boundary. */
export const platformRtk = platformApi;

export const platformClient = createPlatformAdminClient(execute);

function problem(error: unknown): PlatformApiProblem {
  const data = typeof error === 'object' && error !== null && 'data' in error ? (error as {data?: unknown}).data : undefined;
  if (typeof data === 'object' && data !== null) {
    const value = data as {type?: unknown; title?: unknown; status?: unknown; detail?: unknown; errorCode?: unknown; correlationId?: unknown};
    const errorCode = isPlatformProblemCode(value.errorCode) ? value.errorCode : 'PLATFORM_COMMON_RESULT_UNKNOWN';
    const feedback = platformProblemFeedback(errorCode);
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
  return {...platformProblemFeedback('NETWORK_ERROR'), type: 'about:blank', status: 0, errorCode: 'NETWORK_ERROR', correlationId: ''};
}
