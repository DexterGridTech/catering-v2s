import type {CatalogDictionaryEntryReadback} from '../../../app/api/generated/catalog-inventory-edge';

export type CatalogDictionaryQuickManageCandidate = {
  entryRef: string;
  code: string;
  name: string;
};

/**
 * A command can be committed even when a client-side readback is malformed.
 * Keep that boundary explicit so a post-200 shape defect is never reported as
 * a network failure and never writes an incomplete candidate into the draft.
 */
export function catalogDictionaryQuickManageCandidateFromReadback(
  response: CatalogDictionaryEntryReadback | undefined,
): CatalogDictionaryQuickManageCandidate | undefined {
  const result = response?.result;
  if (!result || typeof result.entryRef !== 'string' || !result.entryRef.trim()) return undefined;
  if (typeof result.code !== 'string' || !result.code.trim()) return undefined;
  if (typeof result.name !== 'string' || !result.name.trim()) return undefined;
  return {entryRef: result.entryRef, code: result.code, name: result.name};
}
