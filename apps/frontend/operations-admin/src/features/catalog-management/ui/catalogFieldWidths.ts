/**
 * The four field-width grades defined by the catalog workbench interaction
 * standard.  A component chooses a grade from the meaning of the field, not
 * from the accidental length of its current option labels.
 */
export const catalogFieldWidths = {
  compact: 160,
  regular: 320,
  long: 560,
  full: '100%',
} as const;

export function catalogFieldWidth(grade: keyof typeof catalogFieldWidths) {
  return {width: catalogFieldWidths[grade], maxWidth: '100%'};
}
