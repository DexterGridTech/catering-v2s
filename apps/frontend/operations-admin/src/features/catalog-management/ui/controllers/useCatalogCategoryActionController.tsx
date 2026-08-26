import {Form, Modal, type FormInstance} from 'antd';
import {createContentIdempotencyKey} from '@catering-v2s/admin-ui-foundation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {operationsRtk} from '../../../../app/api/OperationsTransport';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryRtkRequest} from '../../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../../app/routing/model';
import type {CatalogNavigation} from '../../model/catalogModel';
import {catalogUiProblemFeedback} from '../../model/catalogUiProblemFeedback';
import type {
  CatalogCategoryAction,
  CatalogWorkspaceTask,
  CatalogWorkspaceTaskAction,
} from '../../model/catalogWorkspaceTask';
import {useCatalogCategoryCandidates} from '../useCatalogCategoryCandidates';

export type CatalogCategoryTask = {
  mode: CatalogCategoryAction;
  node?: CatalogNavigation['tree'][number];
};

type CategoryFormValues = {code?: string; name?: string; parentCategoryRef?: string | null};
type CategoryCandidates = ReturnType<typeof useCatalogCategoryCandidates>;

type Input = {
  workspaceTask: CatalogWorkspaceTask;
  dispatchWorkspaceTask: Dispatch<CatalogWorkspaceTaskAction>;
  queryContext: OperationsPageProps['queryContext'];
  headers?: Record<string, string>;
  scopeReady: boolean;
  brandRef?: string;
  navigation?: CatalogNavigation;
};

function categoryPathLabels(navigation: CatalogNavigation | undefined, categoryRef: string | null | undefined): string[] {
  if (!navigation || !categoryRef) return [];
  const byRef = new Map(navigation.tree.map(node => [String(node.categoryRef), node]));
  const labels: string[] = [];
  let current = byRef.get(categoryRef);
  while (current) {
    labels.unshift(current.name);
    current = current.parentCategoryRef ? byRef.get(String(current.parentCategoryRef)) : undefined;
  }
  return labels;
}

export type CatalogCategoryActionController = {
  action: CatalogCategoryTask | undefined;
  form: FormInstance<CategoryFormValues>;
  problem?: string;
  createCandidates: CategoryCandidates;
  reparentCandidates: CategoryCandidates;
  submitting: boolean;
  rememberTrigger: (event: ReactMouseEvent<HTMLElement>) => void;
  close: () => void;
  submit: () => Promise<void>;
};

/**
 * Owns the category-only draft, mutations, candidate trees and focus return.
 * The workspace merely routes a CATEGORY_ATOM task into this controller.
 */
export function useCatalogCategoryActionController({
  workspaceTask,
  dispatchWorkspaceTask,
  queryContext,
  headers,
  scopeReady,
  brandRef,
  navigation,
}: Input): CatalogCategoryActionController {
  const action = useMemo<CatalogCategoryTask | undefined>(
    () =>
      workspaceTask.kind === 'CATEGORY_ATOM'
        ? {mode: workspaceTask.action, node: workspaceTask.node as CatalogCategoryTask['node']}
        : undefined,
    [workspaceTask],
  );
  const [problem, setProblem] = useState<string>();
  const [form] = Form.useForm<CategoryFormValues>();
  const triggerRef = useRef<HTMLElement | null>(null);
  const [createCategory, createCategoryState] = operationsRtk.useCreateOperationsCatalogCategoryMutation();
  const [updateCategory, updateCategoryState] = operationsRtk.useUpdateOperationsCatalogCategoryMutation();
  const [moveCategory, moveCategoryState] = operationsRtk.useMoveOperationsCatalogCategoryMutation();
  const [deleteCategory, deleteCategoryState] = operationsRtk.useDeleteOperationsCatalogCategoryMutation();
  const selectedParentRef =
    action?.mode === 'REPARENT'
      ? action.node?.parentCategoryRef
      : action?.mode === 'CREATE'
        ? action.node?.categoryRef
        : undefined;
  const selectedParentPathLabels = useMemo(
    () => categoryPathLabels(navigation, selectedParentRef ? String(selectedParentRef) : undefined),
    [navigation, selectedParentRef],
  );
  const createCandidates = useCatalogCategoryCandidates({
    open: scopeReady && action?.mode === 'CREATE',
    scopeRef: queryContext.scopeRef,
    brandRef,
    usage: 'CATEGORY_CREATE',
    selected: {
      categoryRef: action?.mode === 'CREATE' ? action.node?.categoryRef : undefined,
      pathLabels: action?.mode === 'CREATE' ? selectedParentPathLabels : [],
    },
  });
  const reparentCandidates = useCatalogCategoryCandidates({
    open: scopeReady && action?.mode === 'REPARENT',
    scopeRef: queryContext.scopeRef,
    brandRef,
    usage: 'CATEGORY_REPARENT',
    currentCategoryRef: action?.mode === 'REPARENT' ? action.node?.categoryRef : undefined,
    selected: {
      categoryRef: action?.mode === 'REPARENT' ? action.node?.parentCategoryRef : undefined,
      pathLabels: action?.mode === 'REPARENT' ? selectedParentPathLabels : [],
    },
  });
  const submitting =
    createCategoryState.isLoading ||
    updateCategoryState.isLoading ||
    moveCategoryState.isLoading ||
    deleteCategoryState.isLoading;

  useEffect(() => {
    if (!action) return;
    form.setFieldsValue({
      name: action.node?.name,
      parentCategoryRef:
        action.mode === 'REPARENT'
          ? (action.node?.parentCategoryRef ?? null)
          : action.mode === 'CREATE'
            ? (action.node?.categoryRef ?? null)
            : undefined,
    });
  }, [action, form]);

  const finish = useCallback(() => {
    dispatchWorkspaceTask({type: 'CLOSE'});
    setProblem(undefined);
    form.resetFields();
  }, [dispatchWorkspaceTask, form]);

  const rememberTrigger = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button') : null;
    triggerRef.current = target ?? event.currentTarget;
  }, []);

  useEffect(() => {
    if (action) {
      if (!triggerRef.current && document.activeElement instanceof HTMLElement)
        triggerRef.current = document.activeElement;
      return;
    }
    if (!triggerRef.current) return;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger.isConnected) trigger.focus();
  }, [action]);

  const close = useCallback(() => {
    if (!form.isFieldsTouched()) {
      finish();
      return;
    }
    Modal.confirm({
      title: '放弃分类修改？',
      content: '未保存的分类修改将丢失。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk: finish,
    });
  }, [finish, form]);

  const submit = useCallback(async () => {
    if (!action) return;
    try {
      const values = await form.validateFields();
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const node = action.node;
      const categoryRef = node?.categoryRef;
      if (action.mode === 'CREATE') {
        const body = {
          dataNodeRef,
          code: values.code?.trim() ?? '',
          name: values.name?.trim() ?? '',
          parentCategoryRef: values.parentCategoryRef ? wireUuid(values.parentCategoryRef) : null,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogCategory,
          body,
        );
        await createCategory(
          catalogInventoryRtkRequest.createOperationsCatalogCategory(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (!categoryRef || !node) {
        throw new Error('CATEGORY_REF_MISSING');
      } else if (action.mode === 'RENAME') {
        const body = {dataNodeRef, categoryRef, expectedVersion: node.version, name: values.name?.trim() ?? ''};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogCategory,
          body,
        );
        await updateCategory(
          catalogInventoryRtkRequest.updateOperationsCatalogCategory(
            {categoryRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (action.mode === 'REPARENT' || action.mode === 'MOVE_UP' || action.mode === 'MOVE_DOWN') {
        const moveAction: 'REPARENT' | 'UP' | 'DOWN' =
          action.mode === 'REPARENT' ? 'REPARENT' : action.mode === 'MOVE_UP' ? 'UP' : 'DOWN';
        const body = {
          dataNodeRef,
          categoryRef,
          expectedVersion: node.version,
          action: moveAction,
          ...(moveAction === 'REPARENT'
            ? {parentCategoryRef: values.parentCategoryRef ? wireUuid(values.parentCategoryRef) : null}
            : {}),
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.moveOperationsCatalogCategory,
          body,
        );
        await moveCategory(
          catalogInventoryRtkRequest.moveOperationsCatalogCategory(
            {categoryRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else {
        const body = {dataNodeRef, categoryRef, expectedVersion: node.version};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.deleteOperationsCatalogCategory,
          body,
        );
        await deleteCategory(
          catalogInventoryRtkRequest.deleteOperationsCatalogCategory(
            {categoryRef},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      }
      finish();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(catalogUiProblemFeedback(error, '分类操作未完成，请重试。').message);
    }
  }, [action, createCategory, deleteCategory, finish, form, headers, moveCategory, queryContext, updateCategory]);

  return {action, form, problem, createCandidates, reparentCandidates, submitting, rememberTrigger, close, submit};
}
