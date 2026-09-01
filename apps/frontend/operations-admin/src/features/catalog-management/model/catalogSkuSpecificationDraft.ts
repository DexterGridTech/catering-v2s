import {catalogLifecycleStatus} from './catalogModel';
import type {CatalogCandidateRow} from './catalogFieldRuntime';
import {draftUuid, type SkuDimensionDraft, type SkuDimensionValueDraft} from './catalogItemEditorDraftAdapters';

type DraftRowIdFactory = (prefix: string) => string;

function orderedRefs(values: readonly string[]) {
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const ref = String(value);
    if (ref && !seen.has(ref)) {
      seen.add(ref);
      result.push(ref);
    }
    return result;
  }, []);
}

function candidateRowsByRef(rows: readonly CatalogCandidateRow[]) {
  const result = new Map<string, CatalogCandidateRow>();
  rows.forEach(row => {
    const ref = typeof row.entryRef === 'string' ? row.entryRef : '';
    if (ref && !result.has(ref)) result.set(ref, row);
  });
  return result;
}

function textField(row: CatalogCandidateRow | undefined, field: 'code' | 'name') {
  return typeof row?.[field] === 'string' ? row[field] : undefined;
}

/**
 * Reconciles the one library selection with the editor's ordered dimensions.
 * Business identity is the dictionary entry ref; local editor ids survive
 * reordering so the table and any focus target remain stable.
 */
export function reconcileSkuDimensionsFromSelection(
  current: readonly SkuDimensionDraft[],
  nextAttributeRefs: readonly string[],
  rows: readonly CatalogCandidateRow[],
  createDraftRowId: DraftRowIdFactory,
): SkuDimensionDraft[] {
  const rowsByRef = candidateRowsByRef(rows);
  const currentByRef = new Map<string, SkuDimensionDraft>();
  current.forEach(dimension => {
    const ref = String(dimension.attributeRef ?? '');
    if (ref && !currentByRef.has(ref)) currentByRef.set(ref, dimension);
  });

  return orderedRefs(nextAttributeRefs).map(attributeRef => {
    const existing = currentByRef.get(attributeRef);
    const row = rowsByRef.get(attributeRef);
    return {
      ...(existing ?? {
        editorId: createDraftRowId('dimension'),
        attributeRef: draftUuid(attributeRef),
        attributeCode: '',
        attributeName: '',
        values: [],
      }),
      attributeRef: existing?.attributeRef ?? draftUuid(attributeRef),
      attributeCode: textField(row, 'code') ?? existing?.attributeCode ?? '',
      attributeName: textField(row, 'name') ?? existing?.attributeName ?? '',
      values: existing?.values ?? [],
    };
  });
}

/**
 * Reconciles one dimension's value multi-select. Lifecycle is read from the
 * dictionary candidate; there is intentionally no editor-side status control.
 */
export function reconcileSkuDimensionValuesFromSelection(
  current: readonly SkuDimensionValueDraft[],
  nextValueRefs: readonly string[],
  rows: readonly CatalogCandidateRow[],
  createDraftRowId: DraftRowIdFactory,
): SkuDimensionValueDraft[] {
  const rowsByRef = candidateRowsByRef(rows);
  const currentByRef = new Map<string, SkuDimensionValueDraft>();
  current.forEach(value => {
    const ref = String(value.valueRef ?? '');
    if (ref && !currentByRef.has(ref)) currentByRef.set(ref, value);
  });

  return orderedRefs(nextValueRefs).map((valueRef, index) => {
    const existing = currentByRef.get(valueRef);
    const row = rowsByRef.get(valueRef);
    const hasCandidateStatus = row && Object.prototype.hasOwnProperty.call(row, 'status');
    const status = hasCandidateStatus ? catalogLifecycleStatus(row.status) : (existing?.status ?? 'ENABLED');
    return {
      ...(existing ?? {
        editorId: createDraftRowId('dimension-value'),
        valueRef: draftUuid(valueRef),
        valueCode: '',
        valueLabel: '',
        displayOrder: index,
        status,
      }),
      valueRef: existing?.valueRef ?? draftUuid(valueRef),
      valueCode: textField(row, 'code') ?? existing?.valueCode ?? '',
      valueLabel: textField(row, 'name') ?? existing?.valueLabel ?? '',
      displayOrder: index,
      status,
    };
  });
}
