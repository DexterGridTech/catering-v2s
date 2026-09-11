import {describe, expect, it} from 'vitest';
import {businessChannelTemplateTestIds} from './businessChannelTemplateTestIds';

describe('business-channel template automation identities', () => {
  it('keeps fixed identities unique and store identities business-keyed', () => {
    const fixedValues = Object.values(businessChannelTemplateTestIds).flatMap(value =>
      typeof value === 'string' ? [value] : [],
    );
    expect(new Set(fixedValues).size).toBe(fixedValues.length);
    expect(businessChannelTemplateTestIds.visibleStorePickerModal).toBe(
      'business-channel-template-visible-store-picker-modal',
    );
    expect(businessChannelTemplateTestIds.visibleStorePickerSearch).toBe(
      'business-channel-template-visible-store-picker-search',
    );
    expect(businessChannelTemplateTestIds.visibleStorePickerOption('store-a')).toBe(
      'business-channel-template-visible-store-picker-option-store-a',
    );
    expect(businessChannelTemplateTestIds.visibleStorePickerCancel).toBe(
      'business-channel-template-visible-store-picker-cancel',
    );
    expect(businessChannelTemplateTestIds.visibleStorePickerConfirm).toBe(
      'business-channel-template-visible-store-picker-confirm',
    );
    expect(businessChannelTemplateTestIds.visibleStoreRemove('store-a')).toBe(
      'business-channel-template-visible-store-remove-store-a',
    );
    expect(businessChannelTemplateTestIds.visibleStoreVoidedTag('store-a')).toBe(
      'business-channel-template-visible-store-voided-store-a',
    );
  });
});
