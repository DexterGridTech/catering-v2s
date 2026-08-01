export type ContextScopedQueryContext = {
  groupWorkspaceKey: string;
  expectedContextVersion?: number;
  identityKey?: string;
  scopeRef?: string;
};

type ContextScopedQueryResult<T extends Record<string, unknown>, C extends ContextScopedQueryContext> = T
  & Pick<C, 'groupWorkspaceKey'>
  & (C extends {expectedContextVersion: number} ? Pick<C, 'expectedContextVersion'> : {})
  & (C extends {identityKey: string} ? Pick<C, 'identityKey'> : {})
  & (C extends {scopeRef: string} ? Pick<C, 'scopeRef'> : {});

/**
 * Adds only the already-approved context fields to a generated query arg.
 * Feature-specific filters, page keys and owner scope semantics stay in the
 * caller; undefined optional fields are omitted to preserve the wire shape.
 */
export function contextScopedQueryArgs<T extends Record<string, unknown>, C extends ContextScopedQueryContext>(
  queryArgs: T,
  context: C,
): ContextScopedQueryResult<T, C> {
  const result: Record<string, unknown> = {...queryArgs, groupWorkspaceKey: context.groupWorkspaceKey};
  if (context.expectedContextVersion !== undefined) result.expectedContextVersion = context.expectedContextVersion;
  if (context.identityKey !== undefined) result.identityKey = context.identityKey;
  if (context.scopeRef !== undefined) result.scopeRef = context.scopeRef;
  return result as ContextScopedQueryResult<T, C>;
}
