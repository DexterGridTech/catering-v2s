export function assertNonEmptyString(value: unknown, scope: string, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[${scope}] ${label} must be non-empty`);
  }
}
