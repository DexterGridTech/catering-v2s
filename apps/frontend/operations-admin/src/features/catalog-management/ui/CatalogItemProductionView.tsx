import {Space} from 'antd';
import type {CatalogDetail} from '../model/catalogModel';
import {PreparationProfileReadOnly, PreparationVariationSummary} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemProductionView({
  detail,
  onNavigateTab,
}: {
  detail: NonNullable<CatalogDetail>;
  onNavigateTab: (tabKey: string) => void;
}) {
  const selectedTag = detail.productionTags.find(tag => tag.tagRef === detail.item.productionTagRef);
  const tag = selectedTag ? {...selectedTag, owner: selectedTag.owner || 'catalog'} : undefined;
  return (
    <CatalogFactSectionView section="production-prompts">
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <PreparationProfileReadOnly profile={detail.item.preparationProfile} tag={tag} />
        <PreparationVariationSummary
          skus={detail.item.skus}
          orderOptions={detail.item.orderOptionConfigs}
          shapeKey={detail.item.shapeKey}
          onNavigateToOptions={() => onNavigateTab('order-options')}
        />
      </Space>
    </CatalogFactSectionView>
  );
}
