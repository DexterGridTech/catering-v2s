type ClassNameValue = string | false | null | undefined;

/**
 * Local class-name composition for primitive recipes. It intentionally handles
 * only static class tokens and conditional strings; it is not a vendor copy.
 */
export const cn = (...values: readonly ClassNameValue[]): string =>
  values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
