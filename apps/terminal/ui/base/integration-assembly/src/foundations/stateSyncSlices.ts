export type StateSyncSlice = Readonly<{
  readonly name: string;
  readonly syncIntent: 'master-to-slave' | 'slave-to-master' | 'isolated';
}>;

export type TopologyStateSyncSlice = Readonly<{
  readonly name: string;
  readonly syncIntent: 'master-to-slave' | 'slave-to-master';
}>;

/** Filters only the explicitly supplied slice declarations; it does not scan, sort or deduplicate. */
export const selectStateSyncSlices = (slices: readonly StateSyncSlice[]): readonly TopologyStateSyncSlice[] =>
  Object.freeze(
    slices
      .filter((slice): slice is TopologyStateSyncSlice => slice.syncIntent !== 'isolated')
      .map(slice => Object.freeze({name: slice.name, syncIntent: slice.syncIntent})),
  );
