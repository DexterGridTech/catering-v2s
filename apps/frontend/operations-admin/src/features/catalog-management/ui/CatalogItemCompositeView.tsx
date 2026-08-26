import type {CatalogDetail} from '../model/catalogModel';
import {CompositeGroupsReadOnly} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemCompositeView({detail}: {detail: NonNullable<CatalogDetail>}) {
  return (
    <CatalogFactSectionView section="composite-content">
      <CompositeGroupsReadOnly values={detail.compositeGroups} />
    </CatalogFactSectionView>
  );
}
