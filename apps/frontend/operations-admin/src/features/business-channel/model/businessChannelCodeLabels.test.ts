import {describe, expect, it} from 'vitest';
import {
  accessKindLabels,
  businessChannelTemplateStoreVisibilitySummary,
  bindingStatusLabels,
  businessChannelCodeLabels,
  dineInFormLabels,
  lifecycleStatusLabels,
  operatorKindLabels,
  organizationStoreStatusLabels,
  orderKindLabels,
  ownerNodeTypeLabels,
  storeVisibilityScopeLabels,
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
    expect(Object.keys(storeVisibilityScopeLabels).sort()).toEqual(['ALL_PROJECT_STORES', 'SELECTED_PROJECT_STORES']);
    expect(Object.keys(organizationStoreStatusLabels).sort()).toEqual(['DISABLED', 'ENABLED', 'VOIDED']);
  });

  it('keeps business wording in the shared grouped export', () => {
    expect(businessChannelCodeLabels.status.VOIDED).toBe('标记删除');
    expect(businessChannelCodeLabels.dineInForm.QR).toBe('扫码');
  });

  it('keeps the template scope summary independent from store status facts', () => {
    const base = {
      operatorKind: 'STORE',
      visibleStoreCount: 0,
      storeVisibilityScope: 'SELECTED_PROJECT_STORES',
    } as const;
    expect(businessChannelTemplateStoreVisibilitySummary(base as never)).toBe('当前项目部分门店可见（0 家）');
    expect(
      businessChannelTemplateStoreVisibilitySummary({...base, storeVisibilityScope: 'ALL_PROJECT_STORES'} as never),
    ).toBe('当前项目全部门店可见');
    expect(
      businessChannelTemplateStoreVisibilitySummary({
        ...base,
        operatorKind: 'PROJECT',
        storeVisibilityScope: null,
      } as never),
    ).toBe('不适用');
  });
});
