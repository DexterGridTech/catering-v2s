import type {
  CatalogOrderOptionDefinitionCreateRequest,
  CatalogOrderOptionDefinitionList,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';

type OrderOptionDefinitionValue = CatalogOrderOptionDefinitionList['data']['definitions'][number]['values'][number];

export type OrderOptionDefinitionFormValue = {
  valueRef?: string;
  code: string;
  name: string;
  materials: Array<{materialItemRef?: string}>;
};

export function orderOptionMaterialRefs(
  materials: readonly OrderOptionDefinitionFormValue['materials'][number][] | undefined,
): string[] {
  return (materials ?? []).flatMap(material => (material.materialItemRef ? [material.materialItemRef] : []));
}

export function orderOptionMaterialsFromRefs(
  materialRefs: readonly string[] | undefined,
): OrderOptionDefinitionFormValue['materials'] {
  return (materialRefs ?? []).map(materialItemRef => ({materialItemRef}));
}

/** Keeps every library material row across edit hydration and the save boundary. */
export function hydrateOrderOptionDefinitionValues(
  values: readonly OrderOptionDefinitionValue[],
): OrderOptionDefinitionFormValue[] {
  return values.map(value => ({
    valueRef: value.valueRef,
    code: value.code,
    name: value.name,
    materials: value.materials.map(material => ({materialItemRef: material.materialItemRef})),
  }));
}

export function serializeOrderOptionDefinitionValues(
  values: readonly OrderOptionDefinitionFormValue[],
): CatalogOrderOptionDefinitionCreateRequest['values'] {
  return values.map((value, index) => ({
    valueRef: value.valueRef ? wireUuid(value.valueRef) : null,
    code: value.code.trim(),
    name: value.name.trim(),
    displayOrder: index + 1,
    materials: (value.materials ?? []).flatMap(material => {
      const materialItemRef = material.materialItemRef?.trim();
      return materialItemRef ? [{materialItemRef: wireUuid(materialItemRef)}] : [];
    }),
  }));
}
