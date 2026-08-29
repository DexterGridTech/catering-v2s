import {describe, expect, it} from 'vitest';
import {
  accessKindLabels,
  bindingStatusLabels,
  businessChannelCodeLabels,
  dineInFormLabels,
  lifecycleStatusLabels,
  operatorKindLabels,
  orderKindLabels,
  ownerNodeTypeLabels,
} from './businessChannelCodeLabels';

describe('business-channel code labels', () => {
  it('covers every generated business-channel enum member exactly once', () => {
    expect(Object.keys(accessKindLabels).sort()).toEqual(['EXTERNAL', 'INTERNAL']);
    expect(Object.keys(operatorKindLabels).sort()).toEqual(['PROJECT', 'STORE']);
    expect(Object.keys(orderKindLabels).sort()).toEqual(['DINE_IN', 'GROUP_BUY', 'TAKEAWAY']);
    expect(Object.keys(dineInFormLabels).sort()).toEqual(['KIOSK', 'POS', 'QR']);
    expect(Object.keys(lifecycleStatusLabels).sort()).toEqual(['DISABLED', 'ENABLED', 'VOIDED']);
    expect(Object.keys(ownerNodeTypeLabels).sort()).toEqual(['PROJECT', 'STORE']);
    expect(Object.keys(bindingStatusLabels).sort()).toEqual(['BOUND', 'NOT_REQUIRED', 'UNBOUND']);
  });

  it('keeps business wording in the shared grouped export', () => {
    expect(businessChannelCodeLabels.status.VOIDED).toBe('标记删除');
    expect(businessChannelCodeLabels.dineInForm.QR).toBe('扫码');
  });
});
