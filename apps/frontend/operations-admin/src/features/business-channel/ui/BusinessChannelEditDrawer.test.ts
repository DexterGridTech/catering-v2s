import {describe, expect, it} from 'vitest';
import {canSubmitBusinessChannelEdit} from './BusinessChannelEditDrawer';

describe('business-channel edit availability', () => {
  it('fails closed for absent, terminal, and unknown channel states', () => {
    expect(canSubmitBusinessChannelEdit()).toBe(false);
    expect(canSubmitBusinessChannelEdit({status: 'VOIDED'} as never)).toBe(false);
    expect(canSubmitBusinessChannelEdit({status: 'MYSTERY'} as never)).toBe(false);
    expect(canSubmitBusinessChannelEdit({status: 'ENABLED'} as never)).toBe(true);
    expect(canSubmitBusinessChannelEdit({status: 'DISABLED'} as never)).toBe(true);
  });
});
