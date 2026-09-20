export function readCurrentDefinitionRevision(details: unknown): number | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const revision = (details as {currentDefinitionRevision?: unknown}).currentDefinitionRevision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
}

export function transportResponseStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = error as {status?: unknown; originalStatus?: unknown};
  if (typeof value.originalStatus === 'number') return value.originalStatus;
  return typeof value.status === 'number' ? value.status : undefined;
}
