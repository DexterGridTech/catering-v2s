import {describe, expect, it} from 'vitest';
import {businessChannelBindingReadOnlyMessage} from './BusinessChannelBindingDrawer';

describe('business-channel binding closed-code recovery', () => {
  it('distinguishes an unknown closed value from a terminal channel', () => {
    expect(businessChannelBindingReadOnlyMessage(false, true, true, 'ENABLED')).toContain('无法识别');
    expect(businessChannelBindingReadOnlyMessage(true, true, true, 'VOIDED')).toContain('作废');
    expect(businessChannelBindingReadOnlyMessage(true, true, true, 'ENABLED')).toBeUndefined();
  });
});
