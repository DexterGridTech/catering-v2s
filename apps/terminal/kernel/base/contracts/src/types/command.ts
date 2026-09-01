/**
 * Local-only routing context. It must not cross a wire boundary before a
 * dedicated serialization and compatibility review. Crossing a wire still
 * requires dedicated review for serialization and compatibility.
 */
export interface CommandRouteContext {
  readonly workspace?: 'MAIN' | 'BRANCH';
  readonly instanceMode?: 'MASTER' | 'SLAVE';
  readonly displayMode?: 'PRIMARY' | 'SECONDARY';
}
