type ClassNameValue = string | false | null | undefined

/**
 * Small dependency-free copy-in of the RNR NativeWind `cn` seam. The current
 * toolkit only needs static class tokens and conditional strings, so it keeps
 * the seam without importing clsx, tailwind-merge, or an RNR runtime package.
 */
export const cn = (...values: readonly ClassNameValue[]): string =>
  values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ')
