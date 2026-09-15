import {
  type FaceOperationContracts,
  type FaceOperationRequest,
  type FaceExecutor,
  createPlatformAdminClient,
  type EdgeProblemCode,
} from './generated/platform-edge';
import {
  abortPlatformRequests,
  platformApi,
  platformContentTabRefreshSignal,
  platformRefreshSignal,
  registerPlatformUnauthorizedRecovery,
} from './PlatformApi';
import {platformStore} from '../state/PlatformStore';
import {platformProblemFeedback, isPlatformProblemCode, type ProblemFeedback} from './platformProblemFeedback';
import {readExtensionFilterInvalidFields, type ExtensionFilterInvalidField} from '@catering-v2s/admin-ui-foundation';

export type PlatformApiProblem = ProblemFeedback & {
  type: string;
  status: number;
  errorCode: EdgeProblemCode | 'NETWORK_ERROR';
  correlationId: string;
  currentDefinitionRevision?: number;
  invalidFields?: ExtensionFilterInvalidField[];
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
  get title() {
    return this.problem.title;
  }
  get detail() {
    return this.problem.detail;
  }
  get errorCode() {
    return this.problem.errorCode;
  }
}
type WireInitiateOptions = {subscribe?: boolean; track?: boolean};
type PendingWireRequest = {unwrap: () => Promise<unknown>; unsubscribe?: () => void; reset?: () => void};
/**
 * The generated client is the only feature-facing HTTP surface. Operation ids,
 * paths, methods, request bodies, query fields and required headers all remain
 * closed over the generated contract.
 */
const execute: FaceExecutor = async <I extends keyof FaceOperationContracts>(
  request: FaceOperationRequest<I>,
): Promise<FaceOperationContracts[I]['response']> => {
  const endpoint = platformApi.endpoints[request.operationId] as unknown as {
    initiate: (arg: FaceOperationRequest<I>, options?: WireInitiateOptions) => unknown;
  };
  const pending = platformStore.dispatch(
    endpoint.initiate(request, request.method.toUpperCase() === 'GET' ? {subscribe: false} : {track: false}) as never,
  ) as PendingWireRequest;
  try {
    const response = (await pending.unwrap()) as FaceOperationContracts[I]['response'];
    if (request.method.toUpperCase() !== 'GET') platformRefreshSignal.publish();
    return response;
  } catch (error) {
    throw new PlatformApiFailure(problem(error));
  } finally {
    pending.unsubscribe?.();
    pending.reset?.();
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

/** Refreshes active page queries without remounting their filters or pagination state. */
export function refreshPlatformCurrentPage() {
  platformStore.dispatch(platformApi.util.invalidateTags([{type: 'wire', id: 'LIST'}]));
  platformContentTabRefreshSignal.publish();
}

export function registerPlatformSessionRecovery(recovery: () => void | Promise<void>) {
  return registerPlatformUnauthorizedRecovery(recovery);
}

/** The app shell observes render failures through the transport boundary. */
export {recordPlatformRenderError} from './PlatformApi';

export {platformContentTabRefreshSignal, platformRefreshSignal};
/** Feature-facing generated RTK hooks stay behind the app transport boundary. */
export const platformRtk = platformApi;

export const platformClient = createPlatformAdminClient(execute);

function problem(error: unknown): PlatformApiProblem {
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
      details?: unknown;
    };
    const errorCode = isPlatformProblemCode(value.errorCode) ? value.errorCode : 'PLATFORM_COMMON_RESULT_UNKNOWN';
    const feedback = platformProblemFeedback(errorCode);
    return {
      ...feedback,
      type: typeof value.type === 'string' ? value.type : 'about:blank',
      status: typeof value.status === 'number' ? value.status : (responseStatus ?? 0),
      errorCode,
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : '',
      currentDefinitionRevision: readCurrentDefinitionRevision(value.details),
      invalidFields:
        errorCode === 'EXTENSION_FILTER_INVALID' ? readExtensionFilterInvalidFields(value.details) : undefined,
      contractTitle: typeof value.title === 'string' ? value.title : undefined,
      contractDetail: typeof value.detail === 'string' ? value.detail : undefined,
    };
  }
  if (responseStatus !== undefined || (hasData && (data === null || typeof data === 'string'))) {
    return {
      ...platformProblemFeedback('PLATFORM_COMMON_RESULT_UNKNOWN'),
      type: 'about:blank',
      status: responseStatus ?? 0,
      errorCode: 'PLATFORM_COMMON_RESULT_UNKNOWN',
      correlationId: '',
    };
  }
  return {
    ...platformProblemFeedback('NETWORK_ERROR'),
    type: 'about:blank',
    status: 0,
    errorCode: 'NETWORK_ERROR',
    correlationId: '',
  };
}

function readCurrentDefinitionRevision(details: unknown): number | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const revision = (details as {currentDefinitionRevision?: unknown}).currentDefinitionRevision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
}

function transportResponseStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = error as {status?: unknown; originalStatus?: unknown};
  if (typeof value.originalStatus === 'number') return value.originalStatus;
  return typeof value.status === 'number' ? value.status : undefined;
}
