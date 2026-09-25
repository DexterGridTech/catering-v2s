import {randomUUID} from 'node:crypto';

const defaultCookieFromHeaders = headers =>
  headers.get('set-cookie')?.split(',').map(value => value.split(';', 1)[0].trim()).filter(Boolean).join('; ') || null;

const problemCodeOf = json => json?.errorCode ?? json?.code ?? json?.error?.code ?? null;

const safeStageFailureCode = (error, fallback) => {
  const candidate = error?.code ?? error?.message;
  return typeof candidate === 'string' && /^[A-Z0-9_:-]{1,160}$/.test(candidate)
    ? candidate
    : fallback;
};

/**
 * Shared transport boundary for formal seed executors.
 *
 * The owner-specific executors still own fixture selection, business phases and
 * failure policy.  This client owns only the repeated HTTP facts: generated
 * route materialization, diagnostic/idempotency headers, timeout, response
 * decoding, safe call records and the common accepted-status boundary.
 */
export function createSeedHttpClient({
  baseUrl,
  resolveOperation,
  materializeOperationPath,
  buildDiagnosticHeaders,
  manifest,
  credentials,
  calls,
  correlationPrefix = 'seed',
  timeoutMs = 15_000,
  idempotencyKeyFor = null,
  cookieFromHeaders = defaultCookieFromHeaders,
  failureFactory = code => new Error(code),
  onFailure = null,
  onPhase = null,
  decorateCall = null,
}) {
  if (typeof baseUrl !== 'string' || !baseUrl) throw new Error('SEED_HTTP_BASE_URL_REQUIRED');
  if (typeof resolveOperation !== 'function' || typeof materializeOperationPath !== 'function') {
    throw new Error('SEED_HTTP_OPERATION_RESOLVER_REQUIRED');
  }
  if (!Array.isArray(calls)) throw new Error('SEED_HTTP_CALLS_REQUIRED');
  if (typeof buildDiagnosticHeaders !== 'function') throw new Error('SEED_HTTP_DIAGNOSTIC_HEADERS_REQUIRED');

  const failure = (code, details = {}) => {
    onFailure?.(code, details);
    const error = failureFactory(code, details);
    if (!(error instanceof Error)) throw new Error(code);
    throw error;
  };

  const request = async (stage, operationId, pathParametersOrOptions = {}, maybeOptions) => {
    const options = maybeOptions === undefined
      ? pathParametersOrOptions
      : {...maybeOptions, pathParameters: pathParametersOrOptions};
    const {
      pathParameters = {},
      queryParameters = {},
      cookie = null,
      brandRef = null,
      body,
      form,
      headers: additionalHeaders = {},
      expected = [200],
      idempotency = undefined,
      idempotencyKey = undefined,
      expectedProblemCode = null,
    } = options;
    let requestBody = body;
    let operation;
    let pathname;
    let correlationId;
    let requestHeaders;
    let key;
    let payload;
    try {
      operation = resolveOperation(operationId);
      pathname = materializeOperationPath(operation, {pathParameters, queryParameters});
      correlationId = `${correlationPrefix}-${randomUUID()}`;
      requestHeaders = {
        Accept: 'application/json',
        ...buildDiagnosticHeaders({
          manifest,
          credentials,
          operationId: operation.operationId ?? operationId,
          routeTemplate: operation.path,
          correlationId,
        }),
        ...additionalHeaders,
      };
      if (cookie) requestHeaders.Cookie = cookie;
      if (brandRef) requestHeaders['X-Workspace-Brand-Ref'] = brandRef;

      const requestIsIdempotent = idempotency ?? operation.method !== 'GET';
      key = idempotencyKey ?? (requestIsIdempotent && idempotencyKeyFor ? idempotencyKeyFor(stage, operation) : null);
      if (key) requestHeaders['Idempotency-Key'] = key;
      if (requestBody?.idempotencyKey === '$header' && key) requestBody = {...requestBody, idempotencyKey: key};

      if (form !== undefined) payload = form;
      else if (requestBody !== undefined) {
        requestHeaders['Content-Type'] = 'application/json';
        payload = JSON.stringify(requestBody);
      }
    } catch (error) {
      const code = safeStageFailureCode(error, `${stage}_PREPARE_FAILED`);
      onPhase?.(stage, 'FAIL', {operationId, httpStatus: 0, failureCode: code});
      failure(code, {cause: error});
    }

    const startedAt = Date.now();
    let response;
    try {
      response = await fetch(`${String(baseUrl).replace(/\/$/, '')}${pathname}`, {
        method: operation.method,
        headers: requestHeaders,
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const code = `${stage}_NETWORK`;
      const call = {
        stageId: stage,
        operationId: operation.operationId ?? operationId,
        method: operation.method,
        routeTemplate: operation.path,
        status: 0,
        durationMs: Date.now() - startedAt,
        outcome: 'FAILED',
      };
      calls.push({...call, ...(decorateCall?.(call, {operation, stage, operationId}) ?? {})});
      onPhase?.(stage, 'FAIL', {operationId: operation.operationId ?? operationId, httpStatus: 0});
      failure(code, {cause: error});
    }

    let text;
    try {
      text = await response.text();
    } catch (error) {
      const code = `${stage}_RESPONSE_BODY_READ_FAILED`;
      onPhase?.(stage, 'FAIL', {operationId: operation.operationId ?? operationId, httpStatus: response.status, failureCode: code});
      failure(code, {cause: error, response});
    }
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* status remains authoritative */ }
    const requestId = response.headers.get('x-request-id');
    const responseCorrelationId = response.headers.get('x-correlation-id') ?? correlationId;
    const problemCode = problemCodeOf(json);
    const accepted = expected.includes(response.status);
    const outcome = accepted
      ? (expectedProblemCode ? 'EXPECTED_BUSINESS_REJECTION' : 'SUCCEEDED')
      : 'FAILED';
    const call = {
      stageId: stage,
      operationId: operation.operationId ?? operationId,
      method: operation.method,
      routeTemplate: operation.path,
      status: response.status,
      durationMs: Date.now() - startedAt,
      outcome,
      correlationId: responseCorrelationId,
      requestId,
    };
    calls.push({...call, ...(decorateCall?.(call, {operation, stage, operationId}) ?? {})});

    if (accepted && expectedProblemCode && problemCode !== expectedProblemCode) {
      const code = `${stage}_PROBLEM_${problemCode ?? 'UNCLASSIFIED'}`;
      onPhase?.(stage, 'FAIL', {
        operationId: operation.operationId ?? operationId,
        httpStatus: response.status,
        requestId,
        problemCode: problemCode ?? 'UNCLASSIFIED',
      });
      failure(code, {json, response});
    }

    onPhase?.(stage, accepted ? 'PASS' : 'FAIL', {
      operationId: operation.operationId ?? operationId,
      httpStatus: response.status,
      requestId,
      ...(accepted && expectedProblemCode ? {expectedProblemCode} : accepted ? {} : {problemCode: problemCode ?? 'UNCLASSIFIED'}),
    });
    if (!accepted) {
      const code = `${stage}_HTTP_${response.status}_${problemCode ?? 'UNCLASSIFIED'}`;
      failure(code, {json, response});
    }

    return {
      json,
      status: response.status,
      requestId,
      correlationId: responseCorrelationId,
      problemCode,
      cookie: cookieFromHeaders(response.headers),
    };
  };

  return Object.freeze({request});
}
