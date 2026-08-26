/**
 * A catalog code identifies a fact for transport and administration; it is not
 * a display name in an operator selection or reference task. Historical drafts
 * can carry a code in a former `*Name` slot, so expose that as a recoverable
 * read failure rather than silently presenting a code as the name.
 */
export function catalogBusinessName(name: string | null | undefined, code: string | null | undefined, unavailable: string) {
  const normalizedName = name?.trim();
  const normalizedCode = code?.trim();
  if (!normalizedName || (normalizedCode && normalizedName === normalizedCode)) return unavailable;
  return normalizedName;
}
