import type {CatalogDetail} from '../model/catalogModel';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {SkuMatrixReadOnly} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemSkuSpecificationsView({
  detail,
  manifest,
}: {
  detail: NonNullable<CatalogDetail>;
  manifest?: CatalogManifest;
}) {
  return (
    <CatalogFactSectionView section="sku-specifications-pricing">
      <SkuMatrixReadOnly
        manifest={manifest}
        dimensions={detail.item.skuVariantDimensions}
        skus={detail.item.skus}
        summary={detail.item.skuSummary}
        priceGranularity={detail.item.priceGranularity}
        standardSalePrice={detail.item.standardSalePrice}
        canWriteCatalog={false}
        itemStatus={detail.item.lifecycle.status}
      />
    </CatalogFactSectionView>
  );
}
