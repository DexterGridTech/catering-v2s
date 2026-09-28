export function assertNonEmptyString(value: unknown, scope: string, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const prefix = scope.length === 0 ? '' : `[${scope}] `;
    throw new Error(`${prefix}${label} must be non-empty`);
  }
}
