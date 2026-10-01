import {describe, expect, it, vi} from 'vitest';

vi.mock('@catering-v2s/kernel-base-contracts', async () => {
  const actual = await vi.importActual<typeof import('@catering-v2s/kernel-base-contracts')>(
    '@catering-v2s/kernel-base-contracts',
  );
  return {
    ...actual,
    topologyTransportConfig: Object.freeze({
      ...actual.topologyTransportConfig,
      compressionThresholdBytes: Number.MAX_SAFE_INTEGER,
      reassemblyMaxBytes: 64,
    }),
  };
});

import {createTopologyStateTransferPlan} from '../src';

describe('topology transfer encoded bound', () => {
  it('rejects over-bound encoding before allocating frames', () => {
    const createWireId = vi.fn(() => 'must-not-be-allocated');
    const createTransferId = vi.fn(() => 'must-not-be-allocated');
    const result = createTopologyStateTransferPlan({
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 7,
      value: {payload: 'x'.repeat(128)},
      createWireId,
      createTransferId,
    });

    expect(result).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});
    if (result.status === 'failed') {
      expect(result.encodedBytes).toBeGreaterThan(64);
      expect(result.canonicalBytes).toBeGreaterThan(0);
    }
    expect(createWireId).not.toHaveBeenCalled();
    expect(createTransferId).not.toHaveBeenCalled();
  });
});
