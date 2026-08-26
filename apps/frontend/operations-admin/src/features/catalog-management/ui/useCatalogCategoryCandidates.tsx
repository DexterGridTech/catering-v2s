import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import type {
  CatalogCategoryCandidatePage,
  CatalogCategoryCandidateQuery,
} from '../../../app/api/generated/catalog-inventory-edge';

export type CatalogCategoryCandidateUsage = 'ITEM_ASSIGNMENT' | 'CATEGORY_CREATE' | 'CATEGORY_REPARENT';

type Candidate = CatalogCategoryCandidatePage['data']['items'][number];
export type CatalogCategorySelectorNode = {
  title: ReactNode;
  value: string;
  key: string;
  disabled?: boolean;
  selectable?: boolean;
  isLeaf?: boolean;
  children?: CatalogCategorySelectorNode[];
};

type CandidatePage = {
  items: Candidate[];
  nextCursor?: string;
};
type SearchTreeEntry = {name: string; candidate?: Candidate};

type Props = {
  open: boolean;
  scopeRef?: string;
  brandRef?: string;
  usage: CatalogCategoryCandidateUsage;
  currentCategoryRef?: string;
  /**
   * A persisted category must stay readable even while its ancestor page has
   * not been expanded.  This is an owner-backed display fact, never a UUID
   * fallback or a second candidate lifecycle.
   */
  selected?: {categoryRef?: string | null; pathLabels?: readonly string[]};
};

const ROOT_KEY = '';
const LOAD_MORE_PREFIX = 'category-candidates-load-more:';

function categoryTitle(candidate: Candidate): ReactNode {
  return (
    <span style={{display: 'inline-flex', gap: 8, alignItems: 'baseline', minWidth: 0}}>
      <span>{candidate.name}</span>
      {candidate.disabledReason ? <span style={{color: '#8c8c8c'}}>{candidate.disabledReason}</span> : null}
    </span>
  );
}

function treeContains(nodes: readonly CatalogCategorySelectorNode[], value: string): boolean {
  return nodes.some(node => node.value === value || treeContains(node.children ?? [], value));
}

export function withSelectedCategoryPath(
  base: readonly CatalogCategorySelectorNode[],
  selected?: {categoryRef?: string | null; pathLabels?: readonly string[]},
): CatalogCategorySelectorNode[] {
  const selectedRef = selected?.categoryRef ?? undefined;
  const labels = selected?.pathLabels?.filter(Boolean) ?? [];
  if (!selectedRef || labels.length === 0 || treeContains(base, selectedRef)) return [...base];
  return [
    {
      title: labels.join(' / '),
      value: selectedRef,
      key: selectedRef,
      isLeaf: true,
    },
    ...base,
  ];
}

export function useCatalogCategoryCandidates({open, scopeRef, brandRef, usage, currentCategoryRef, selected}: Props) {
  const [childrenByParent, setChildrenByParent] = useState<Record<string, Candidate[]>>({});
  const [loadedParents, setLoadedParents] = useState<ReadonlySet<string>>(new Set());
  const [loadingParents, setLoadingParents] = useState<ReadonlySet<string>>(new Set());
  const [nextCursorByParent, setNextCursorByParent] = useState<Record<string, string | undefined>>({});
  const [searchValue, setSearchValue] = useState('');
  const [error, setError] = useState<unknown>();
  const [fetchCategoryCandidates] = operationsRtk.useLazyGetOperationsCatalogCategoryCandidatesQuery();
  const searchCandidates = useCursorCandidates<Candidate>({
    queryText: searchValue,
    resetKey: `${open}|${scopeRef ?? ''}|${brandRef ?? ''}|${usage}|${currentCategoryRef ?? ''}`,
    pageSize: 100,
    keyOf: candidate => candidate.categoryRef,
  });

  const readPage = useCallback(
    async (
      query: Pick<CatalogCategoryCandidateQuery, 'parentCategoryRef' | 'keyword'>,
      cursor?: string,
    ): Promise<CandidatePage> => {
      const response = await fetchCategoryCandidates(
        catalogInventoryRtkRequest.getOperationsCatalogCategoryCandidates(
          {},
          {
            query: {
              dataNodeRef: wireUuid(scopeRef ?? ''),
              usage,
              ...(currentCategoryRef ? {currentCategoryRef: wireUuid(currentCategoryRef)} : {}),
              pageSize: 100,
              ...query,
              ...(cursor ? {cursor} : {}),
            },
            headers: brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined,
          },
        ),
      ).unwrap();
      return {
        items: response.data.items,
        nextCursor: response.data.nextCursor ?? undefined,
      };
    },
    [brandRef, currentCategoryRef, fetchCategoryCandidates, scopeRef, usage],
  );

  const loadChildren = useCallback(
    async (parentCategoryRef?: string | null, cursor?: string) => {
      if (!open || !scopeRef) return;
      const parentKey = parentCategoryRef ?? ROOT_KEY;
      if ((cursor === undefined && loadedParents.has(parentKey)) || loadingParents.has(parentKey)) return;
      setLoadingParents(current => new Set(current).add(parentKey));
      setError(undefined);
      try {
        const page = await readPage(
          {...(parentCategoryRef ? {parentCategoryRef: wireUuid(parentCategoryRef)} : {})},
          cursor,
        );
        setChildrenByParent(current => {
          const previous = current[parentKey] ?? [];
          const byRef = new Map(previous.map(item => [item.categoryRef, item]));
          page.items.forEach(item => byRef.set(item.categoryRef, item));
          return {...current, [parentKey]: [...byRef.values()]};
        });
        setNextCursorByParent(current => ({...current, [parentKey]: page.nextCursor}));
        setLoadedParents(current => new Set(current).add(parentKey));
      } catch (loadError) {
        setError(loadError);
      } finally {
        setLoadingParents(current => {
          const next = new Set(current);
          next.delete(parentKey);
          return next;
        });
      }
    },
    [loadedParents, loadingParents, open, readPage, scopeRef],
  );

  useEffect(() => {
    setChildrenByParent({});
    setLoadedParents(new Set());
    setLoadingParents(new Set());
    setNextCursorByParent({});
    setSearchValue('');
    setError(undefined);
  }, [brandRef, currentCategoryRef, open, scopeRef, usage]);

  const searchRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogCategoryCandidates(
        {},
        {
          query: {
            dataNodeRef: wireUuid(scopeRef ?? ''),
            usage,
            ...(currentCategoryRef ? {currentCategoryRef: wireUuid(currentCategoryRef)} : {}),
            pageSize: searchCandidates.pageSize,
            ...(searchCandidates.debouncedQueryText ? {keyword: searchCandidates.debouncedQueryText} : {}),
            ...(searchCandidates.cursor ? {cursor: searchCandidates.cursor} : {}),
          },
          headers: brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined,
        },
      ),
    [
      brandRef,
      currentCategoryRef,
      scopeRef,
      searchCandidates.cursor,
      searchCandidates.debouncedQueryText,
      searchCandidates.pageSize,
      usage,
    ],
  );
  const searchQuery = operationsRtk.useGetOperationsCatalogCategoryCandidatesQuery(searchRequest, {
    skip: !open || !scopeRef || !searchCandidates.debouncedQueryText,
  });
  const searchPage = searchQuery.currentData?.data;
  const acceptSearchPage = searchCandidates.acceptPage;
  useEffect(() => {
    if (!searchPage) return;
    acceptSearchPage(searchPage.items, {
      pageSize: searchCandidates.pageSize,
      total: searchPage.total,
      nextCursor: searchPage.nextCursor,
    });
  }, [acceptSearchPage, searchCandidates.pageSize, searchPage]);

  useEffect(() => {
    if (open && scopeRef) void loadChildren();
  }, [loadChildren, open, scopeRef]);

  const buildTree = useCallback(
    (parentCategoryRef: string | null): CatalogCategorySelectorNode[] => {
      const parentKey = parentCategoryRef ?? ROOT_KEY;
      const nodes: CatalogCategorySelectorNode[] = (childrenByParent[parentKey] ?? []).map(candidate => {
        const children = childrenByParent[candidate.categoryRef];
        return {
          title: categoryTitle(candidate),
          value: String(candidate.categoryRef),
          key: String(candidate.categoryRef),
          disabled: !candidate.selectable,
          isLeaf: !candidate.hasChildren,
          ...(children ? {children: buildTree(String(candidate.categoryRef))} : {}),
        };
      });
      if (nextCursorByParent[parentKey]) {
        nodes.push({
          title: <span style={{color: '#1677ff'}}>加载更多分类</span>,
          value: `${LOAD_MORE_PREFIX}${parentKey}`,
          key: `${LOAD_MORE_PREFIX}${parentKey}`,
          selectable: false,
          // This is an expansion-only affordance.  It must remain enabled so
          // TreeSelect can invoke loadData for the next page, while
          // selectable:false keeps it out of the category value domain.
          isLeaf: false,
        });
      }
      return nodes;
    },
    [childrenByParent, nextCursorByParent],
  );

  const treeData = useMemo(
    () => withSelectedCategoryPath(buildTree(null), selected),
    [buildTree, selected],
  );
  const searchTreeData = useMemo(() => {
    if (!searchValue.trim()) return treeData;
    const byRef = new Map<string, SearchTreeEntry>();
    for (const candidate of searchCandidates.items) {
      for (const segment of candidate.path) {
        if (!byRef.has(segment.categoryRef)) byRef.set(segment.categoryRef, {name: segment.name});
      }
      byRef.set(candidate.categoryRef, {name: candidate.name, candidate});
    }
    const children = new Map<string, string[]>();
    for (const candidate of searchCandidates.items) {
      const pathRefs = candidate.path.map(segment => segment.categoryRef);
      // The owner contract returns the complete path, including the matched
      // category itself. Appending the candidate again would make the node
      // its own child and recurse forever while rendering the search tree.
      const refs = pathRefs;
      refs.forEach((ref, index) => {
        const parent = index === 0 ? ROOT_KEY : refs[index - 1];
        const siblings = children.get(parent) ?? [];
        if (!siblings.includes(ref)) siblings.push(ref);
        children.set(parent, siblings);
      });
    }
    const buildSearchTree = (parentRef: string): CatalogCategorySelectorNode[] => {
      const nodes: CatalogCategorySelectorNode[] = [];
      for (const ref of children.get(parentRef) ?? []) {
        const entry = byRef.get(ref);
        if (!entry) continue;
        const childNodes = buildSearchTree(ref);
        nodes.push({
          title: entry.candidate ? (
            categoryTitle(entry.candidate)
          ) : (
            <span>{entry.name}</span>
          ),
          value: ref,
          key: ref,
          selectable: Boolean(entry.candidate?.selectable),
          disabled: entry.candidate ? !entry.candidate.selectable : true,
          isLeaf: childNodes.length === 0 && !entry.candidate?.hasChildren,
          ...(childNodes.length ? {children: childNodes} : {}),
        });
      }
      if (parentRef === ROOT_KEY && searchCandidates.nextCursor) {
        nodes.push({
          title: <span style={{color: '#1677ff'}}>加载更多分类</span>,
          value: `${LOAD_MORE_PREFIX}search`,
          key: `${LOAD_MORE_PREFIX}search`,
          selectable: false,
          // See the normal-tree pagination node above: search pagination is
          // expanded, never selected, and therefore must not be disabled.
          isLeaf: false,
        });
      }
      return nodes;
    };
    return buildSearchTree(ROOT_KEY);
  }, [searchCandidates.items, searchCandidates.nextCursor, searchValue, treeData]);

  const onSearch = useCallback((value: string) => setSearchValue(value), []);
  const loading = loadingParents.size > 0;
  const problem =
    error || searchQuery.error
      ? catalogUiProblemFeedback(error ?? searchQuery.error, '商品分类暂时无法读取，请稍后重试。').message
      : undefined;
  const loadSelectedFallback = useCallback(
    async (node: {value?: string | number}): Promise<void> => {
      const value = typeof node.value === 'string' ? node.value : '';
      if (value === `${LOAD_MORE_PREFIX}search`) {
        await searchCandidates.loadNext(searchQuery.isFetching);
        return;
      }
      if (value.startsWith(LOAD_MORE_PREFIX)) {
        const parentKey = value.slice(LOAD_MORE_PREFIX.length);
        await loadChildren(parentKey || undefined, nextCursorByParent[parentKey]);
        return;
      }
      await loadChildren(value || undefined);
    },
    [loadChildren, nextCursorByParent, searchCandidates, searchQuery.isFetching],
  );

  return {
    treeData: searchValue.trim() ? searchTreeData : treeData,
    loadData: loadSelectedFallback,
    loading: loading || searchQuery.isLoading || searchQuery.isFetching,
    problem,
    searchValue,
    onSearch,
  };
}
