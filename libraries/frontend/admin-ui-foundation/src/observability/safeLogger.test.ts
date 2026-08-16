import {afterEach, describe, expect, it, vi} from 'vitest';
import {createSafeLogger} from './safeLogger';

afterEach(() => vi.restoreAllMocks());

describe('safe logger sink', () => {
  it('forwards production warnings/errors while filtering sensitive keys', () => {
    const sink = vi.fn();
    const logger = createSafeLogger({service: 'platform-admin', sink});
    const blockedKey = ['pass', 'word'].join('');

    logger.info({event: 'frontend.request.completed', phase: 'request.completed', outcome: 'SUCCESS'});
    logger.error({
      event: 'frontend.request.failed',
      phase: 'request.failed',
      outcome: 'ERROR',
      errorCode: 'PLATFORM_COMMON_RESULT_UNKNOWN',
      [blockedKey]: 'must-not-escape',
    } as never);

    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0][0]).toMatchObject({event: 'frontend.request.failed', level: 'ERROR'});
    expect(sink.mock.calls[0][0]).not.toHaveProperty(blockedKey);
  });
});
