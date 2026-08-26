import type {CatalogDetail} from '../model/catalogModel';
import {AttributeAssignmentsReadOnly} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemAttributesView({detail}: {detail: NonNullable<CatalogDetail>}) {
  return (
    <CatalogFactSectionView section="attributes">
      <AttributeAssignmentsReadOnly values={detail.item.attributeAssignments} />
    </CatalogFactSectionView>
  );
}
