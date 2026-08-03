import {afterEach, describe, expect, it, vi} from 'vitest';
import {createObservedBaseQuery} from './observedBaseQuery';
import {createSafeLogger} from './safeLogger';

const api = () => ({signal: new AbortController().signal, abort: vi.fn()}) as never;

afterEach(() => vi.unstubAllGlobals());

describe('createObservedBaseQuery', () => {
  it('keeps a public-operation 401 in the feature while logging its security classification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({errorCode: 'WORKSPACE_IAM_INVALID_CREDENTIALS'}), {
      status: 401,
      headers: {'Content-Type': 'application/json'},
    })));
    const logger = createSafeLogger();
    const onUnauthorized = vi.fn();

    await createObservedBaseQuery({baseUrl: 'http://example.test/', logger, onUnauthorized})({url: 'api/operations/login', requiresSession: false} as never, api(), {});

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(logger.snapshot()).toContainEqual(expect.objectContaining({
      event: 'frontend.request.failed', status: 401, errorCode: 'WORKSPACE_IAM_INVALID_CREDENTIALS', requiresSession: false,
    }));
  });

  it('still recovers the app session after an authenticated-operation 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({errorCode: 'PLATFORM_COMMON_AUTHENTICATION_REQUIRED'}), {
      status: 401,
      headers: {'Content-Type': 'application/json'},
    })));
    const onUnauthorized = vi.fn();

    await createObservedBaseQuery({baseUrl: 'http://example.test/', logger: createSafeLogger(), onUnauthorized})({url: 'api/platform/session', requiresSession: true} as never, api(), {});

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
