import {describe, expect, it} from 'vitest';
import {
  collaborationAttributePresentation,
  collaborationAttributeValueLabel,
  collaborationCodeLabels,
} from './collaborationCodeLabels';

describe('collaborationCodeLabels', () => {
  it('keeps one pure vocabulary for both admin faces', () => {
    expect(Object.keys(collaborationCodeLabels.capabilityClass).sort()).toEqual([
      'DINE_IN',
      'GROUP_BUY',
      'INVENTORY_SYNC',
      'MASTER_DATA_SYNC',
      'MEMBER_BENEFIT',
      'ORDER_SYNC',
      'TAKEAWAY',
      'TAKEAWAY_DELIVERY',
    ]);
    expect(collaborationCodeLabels.organizationNodeType.STORE).toBe('门店');
    expect(collaborationCodeLabels.attributeOptionSource.endpoint).toBe('接口');
  });

  it('keeps presentation and unknown-code fallback stable', () => {
    expect(collaborationAttributePresentation.groupBuyMappingDirection.label).toBe('团购商品映射方向');
    expect(collaborationAttributeValueLabel('groupBuyMappingDirection', 'INTERNAL_TO_EXTERNAL')).toBe('内部映射到外部');
    expect(collaborationAttributeValueLabel('groupBuyMappingDirection', 'FUTURE_VALUE')).toBe('当前值无法识别');
    expect(collaborationAttributeValueLabel('unknown', 'value')).toBeUndefined();
  });
});
