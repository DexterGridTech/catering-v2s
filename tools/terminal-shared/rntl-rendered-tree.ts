export type RenderedTestInstance = Readonly<{
  readonly type: unknown;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly (RenderedTestInstance | string)[];
}>;

type RenderResultContainer = Readonly<{
  readonly container: Readonly<{readonly children: readonly unknown[]}>;
}>;

/**
 * Structural component tests sometimes need to inspect host props that have no
 * accessibility query. Traverse only RNTL v14's documented render container;
 * interaction and user-facing assertions should use RNTL queries instead.
 */
export const queryRenderedTree = (
  result: RenderResultContainer,
  predicate: (instance: RenderedTestInstance) => boolean,
): RenderedTestInstance[] => {
  const matches: RenderedTestInstance[] = [];
  const visit = (instance: RenderedTestInstance): void => {
    if (predicate(instance)) matches.push(instance);
    for (const child of instance.children) {
      if (typeof child !== 'string') visit(child as RenderedTestInstance);
    }
  };
  for (const child of result.container.children) {
    if (typeof child !== 'string') visit(child as RenderedTestInstance);
  }
  return matches;
};

export const getRenderedNode = (
  result: RenderResultContainer,
  predicate: (instance: RenderedTestInstance) => boolean,
): RenderedTestInstance => {
  const [match] = queryRenderedTree(result, predicate);
  if (match === undefined) throw new Error('Expected rendered host node was not found');
  return match;
};

export const queryRenderedByProps = (
  result: RenderResultContainer,
  expected: Readonly<Record<string, unknown>>,
): RenderedTestInstance[] =>
  queryRenderedTree(result, node => Object.entries(expected).every(([key, value]) => node.props[key] === value));

export const getRenderedByProps = (
  result: RenderResultContainer,
  expected: Readonly<Record<string, unknown>>,
): RenderedTestInstance => {
  const [match] = queryRenderedByProps(result, expected);
  if (match === undefined)
    throw new Error(`Expected rendered node with props ${JSON.stringify(expected)} was not found`);
  return match;
};

export const queryRenderedByType = (result: RenderResultContainer, type: unknown): RenderedTestInstance[] =>
  queryRenderedTree(result, node => node.type === type);

export const getRenderedByType = (result: RenderResultContainer, type: unknown): RenderedTestInstance =>
  getRenderedNode(result, node => node.type === type);

export const getRenderedDescendantByProps = (
  root: RenderedTestInstance,
  expected: Readonly<Record<string, unknown>>,
): RenderedTestInstance =>
  getRenderedDescendant(root, node => Object.entries(expected).every(([key, value]) => node.props[key] === value));

export const queryRenderedSubtree = (
  root: RenderedTestInstance,
  predicate: (instance: RenderedTestInstance) => boolean,
): RenderedTestInstance[] => {
  const matches: RenderedTestInstance[] = [];
  const visit = (instance: RenderedTestInstance): void => {
    if (predicate(instance)) matches.push(instance);
    for (const child of instance.children) {
      if (typeof child !== 'string') visit(child as RenderedTestInstance);
    }
  };
  visit(root);
  return matches;
};

export const getRenderedDescendant = (
  root: RenderedTestInstance,
  predicate: (instance: RenderedTestInstance) => boolean,
): RenderedTestInstance => {
  const [match] = queryRenderedSubtree(root, predicate);
  if (match === undefined) throw new Error('Expected rendered descendant was not found');
  return match;
};
