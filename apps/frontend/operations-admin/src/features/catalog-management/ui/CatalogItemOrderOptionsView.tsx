import type {CatalogDetail} from '../model/catalogModel';
import {OrderOptionConfigurationsReadOnly} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemOrderOptionsView({detail}: {detail: NonNullable<CatalogDetail>}) {
  return (
    <CatalogFactSectionView section="order-options">
      <OrderOptionConfigurationsReadOnly values={detail.item.orderOptionConfigs} />
    </CatalogFactSectionView>
  );
}
