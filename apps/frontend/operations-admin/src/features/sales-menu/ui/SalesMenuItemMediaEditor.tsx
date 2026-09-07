import {Alert, Radio, Space, Typography} from 'antd';
import {
  AdminImageCollectionEditor,
  type AdminImageCollectionItem,
  type AdminImageCollectionStatus,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {operationsLogger, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type SalesMenuDisplayMedia,
  type SalesMenuDraftItemView,
  type Uuid,
} from '../../../app/api/generated/operations-edge';
import {AssetPreview} from '../../../app/components/AssetPreview';
import type {OperationsPageContext} from '../../../app/routing/model';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {commandErrorMessage, type SalesMenuCommands} from './salesMenuUiShared';

const MEDIA_LIMITS = {maxImageCount: 6, maxImageBytes: 2 * 1024 * 1024} as const;

type SalesMenuMediaItem = AdminImageCollectionItem & {
  assetRef?: Uuid;
  bindGrant?: string;
  version?: number;
  staged: boolean;
  error?: string;
};

function mediaItemsFromReadModel(media: SalesMenuDisplayMedia): SalesMenuMediaItem[] {
  return media.assetRefs.map(assetRef => ({
    id: String(assetRef),
    identity: String(assetRef),
    assetRef,
    fileName: '菜单图片',
    status: 'READY',
    hasPreview: true,
    staged: false,
  }));
}

export function SalesMenuMediaEditor({
  item,
  menuRef,
  open,
  media,
  queryContext,
  commands,
  onChange,
  onPendingChange,
  onRegisterRelease,
}: {
  item: SalesMenuDraftItemView;
  menuRef: Uuid;
  open: boolean;
  media: SalesMenuDisplayMedia;
  queryContext: OperationsPageContext;
  commands: SalesMenuCommands;
  onChange: (next: SalesMenuDisplayMedia, bindGrants: Record<string, string>) => void;
  onPendingChange: (pending: boolean) => void;
  onRegisterRelease: (release?: () => Promise<boolean>) => void;
}) {
  const [items, setItems] = useState<SalesMenuMediaItem[]>(() => mediaItemsFromReadModel(media));
  const [bindGrants, setBindGrants] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const mediaMode = media.mode;
  const lastSessionKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    operationsLogger.info({
      event: 'sales-menu.media.editor',
      phase: 'MEDIA_MODE',
      outcome: mediaMode,
      operationId: 'sales-menu-item-media',
    });
  }, [mediaMode]);

  useEffect(() => {
    const sessionKey = `${item.salesItemRef}:${open ? 'open' : 'closed'}`;
    if (lastSessionKey.current === sessionKey) return;
    lastSessionKey.current = sessionKey;
    setItems(mediaItemsFromReadModel(item.displayMedia));
    setBindGrants({});
    setProblem(undefined);
  }, [item, open]);

  const publishChange = useCallback(
    (nextItems: SalesMenuMediaItem[], nextGrants: Record<string, string>, mode = mediaMode) => {
      setItems(nextItems);
      setBindGrants(nextGrants);
      const assetRefs = nextItems.flatMap(next => (next.assetRef ? [next.assetRef] : []));
      onChange({mode, assetRefs, primaryAssetRef: assetRefs[0] ?? null}, nextGrants);
    },
    [mediaMode, onChange],
  );

  const releaseStagedMedia = useCallback(async (): Promise<boolean> => {
    if (items.some(asset => asset.status === 'UPLOADING')) {
      setProblem('图片仍在上传或处理中，请完成或重试后再关闭。');
      return false;
    }
    const staged = items.filter(asset => asset.staged && asset.assetRef && asset.version !== undefined);
    if (staged.length === 0) return true;
    const outcomes = await Promise.all(
      staged.map(async asset => {
        try {
          await commands.release(
            {
              groupWorkspaceKey: queryContext.groupWorkspaceKey,
              storeRef: queryContext.scopeRef as Uuid,
              salesMenuRef: menuRef,
              salesItemRef: item.salesItemRef,
              assetRef: asset.assetRef as Uuid,
            },
            {expectedAssetVersion: asset.version as number},
          );
          return {asset, released: true};
        } catch (error) {
          setProblem(commandErrorMessage(error, '图片资产释放未完成，请重试关闭。'));
          return {asset, released: false};
        }
      }),
    );
    const releasedIds = new Set(outcomes.filter(outcome => outcome.released).map(outcome => outcome.asset.id));
    if (releasedIds.size > 0) {
      const nextItems = items.filter(asset => !releasedIds.has(asset.id));
      const nextGrants = Object.fromEntries(
        Object.entries(bindGrants).filter(([assetRef]) =>
          nextItems.some(asset => asset.assetRef && String(asset.assetRef) === assetRef && asset.staged),
        ),
      );
      publishChange(nextItems, nextGrants);
    }
    return outcomes.every(outcome => outcome.released);
  }, [bindGrants, commands, item.salesItemRef, items, menuRef, publishChange, queryContext]);

  useEffect(() => {
    onRegisterRelease(releaseStagedMedia);
    return () => onRegisterRelease(undefined);
  }, [onRegisterRelease, releaseStagedMedia]);

  const stageMedia = useCallback(
    async (file: File, existingId?: string) => {
      setProblem(undefined);
      if (file.size > MEDIA_LIMITS.maxImageBytes) {
        operationsLogger.warn({
          event: 'sales-menu.media.stage',
          phase: 'VALIDATION',
          outcome: 'REJECTED_SIZE',
          operationId: OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
        });
        setProblem('单张图片不能超过 2MB。');
        return;
      }
      if (!existingId && items.length >= MEDIA_LIMITS.maxImageCount) {
        operationsLogger.warn({
          event: 'sales-menu.media.stage',
          phase: 'VALIDATION',
          outcome: 'REJECTED_COUNT_LIMIT',
          operationId: OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
        });
        setProblem('最多维护 6 张图片（1 张主图 + 5 张附图）。');
        return;
      }
      const id = existingId ?? `pending-${file.name}-${Date.now()}`;
      const placeholder: SalesMenuMediaItem = {
        id,
        identity: existingId ?? id,
        assetRef: existingId ? items.find(current => current.id === existingId)?.assetRef : undefined,
        version: existingId ? items.find(current => current.id === existingId)?.version : undefined,
        bindGrant: existingId ? items.find(current => current.id === existingId)?.bindGrant : undefined,
        fileName: file.name,
        status: 'UPLOADING',
        file,
        hasPreview: true,
        staged: true,
      };
      const before = items;
      const optimistic = existingId
        ? before.map(current => (current.id === existingId ? placeholder : current))
        : [...before, placeholder];
      setItems(optimistic);
      onPendingChange(true);
      operationsLogger.info({
        event: 'sales-menu.media.stage',
        phase: 'MEDIA_STAGE',
        outcome: 'STARTED',
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
      });
      try {
        const response = await commands.stage(
          {
            groupWorkspaceKey: queryContext.groupWorkspaceKey,
            storeRef: queryContext.scopeRef as Uuid,
            salesMenuRef: menuRef,
            salesItemRef: item.salesItemRef,
          },
          file,
          item.version,
        );
        const nextItem: SalesMenuMediaItem = {
          ...placeholder,
          id: String(response.assetRef),
          identity: String(response.assetRef),
          assetRef: response.assetRef,
          version: response.version,
          status: 'READY',
          hasPreview: true,
          staged: true,
          bindGrant: response.bindGrant,
          error: undefined,
        };
        const previousStaged =
          existingId && placeholder.assetRef && placeholder.version !== undefined && placeholder.staged
            ? placeholder
            : undefined;
        if (previousStaged) {
          try {
            await commands.release(
              {
                groupWorkspaceKey: queryContext.groupWorkspaceKey,
                storeRef: queryContext.scopeRef as Uuid,
                salesMenuRef: menuRef,
                salesItemRef: item.salesItemRef,
                assetRef: previousStaged.assetRef as Uuid,
              },
              {expectedAssetVersion: previousStaged.version as number},
            );
          } catch (error) {
            let replacementReleased = false;
            try {
              await commands.release(
                {
                  groupWorkspaceKey: queryContext.groupWorkspaceKey,
                  storeRef: queryContext.scopeRef as Uuid,
                  salesMenuRef: menuRef,
                  salesItemRef: item.salesItemRef,
                  assetRef: response.assetRef,
                },
                {expectedAssetVersion: response.version},
              );
              replacementReleased = true;
            } catch {
              // Keep the original failure visible; the next user action must
              // still be able to retry the authoritative release.
            }
            setItems(current => {
              const restored = current.map(currentItem => (currentItem.id === id ? previousStaged : currentItem));
              return replacementReleased ? restored : [...restored, nextItem];
            });
            if (!replacementReleased) {
              setBindGrants(current => ({...current, [String(response.assetRef)]: response.bindGrant}));
            }
            setProblem(commandErrorMessage(error, '替换前的暂存图片释放未完成，请重试。'));
            return;
          }
        }
        const nextItems = optimistic.map(current => (current.id === id ? nextItem : current));
        const nextGrants = {...bindGrants, [String(response.assetRef)]: response.bindGrant};
        if (existingId && placeholder.assetRef) delete nextGrants[String(placeholder.assetRef)];
        publishChange(nextItems, nextGrants);
        operationsLogger.info({
          event: 'sales-menu.media.stage',
          phase: 'MEDIA_STAGE',
          outcome: 'SUCCEEDED',
          operationId: OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
        });
      } catch (error) {
        const failed = optimistic.map(current =>
          current.id === id
            ? {...current, status: 'FAILED' as AdminImageCollectionStatus, error: '上传失败，请重试。'}
            : current,
        );
        setItems(failed);
        setProblem(commandErrorMessage(error, '图片上传失败，请重试。'));
        operationsLogger.warn({
          event: 'sales-menu.media.stage',
          phase: 'MEDIA_STAGE',
          outcome: 'FAILED',
          operationId: OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
          errorCode: String(operationsProblemOf(error).errorCode),
        });
      } finally {
        onPendingChange(false);
        operationsLogger.info({
          event: 'sales-menu.media.stage',
          phase: 'MEDIA_STAGE',
          outcome: 'FINISHED',
          operationId: OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
        });
      }
    },
    [bindGrants, commands, item, items, menuRef, onPendingChange, publishChange, queryContext],
  );

  const removeMedia = useCallback(
    async (id: string, index: number) => {
      if (index === 0 && items.length > 1) return;
      const removed = items.find(current => current.id === id);
      if (removed?.staged && removed.assetRef && removed.version !== undefined) {
        try {
          await commands.release(
            {
              groupWorkspaceKey: queryContext.groupWorkspaceKey,
              storeRef: queryContext.scopeRef as Uuid,
              salesMenuRef: menuRef,
              salesItemRef: item.salesItemRef,
              assetRef: removed.assetRef,
            },
            {expectedAssetVersion: removed.version},
          );
        } catch (error) {
          setProblem(commandErrorMessage(error, '图片资产释放未完成，请重试。'));
          return;
        }
      }
      const nextItems = items.filter(current => current.id !== id);
      const nextGrants = {...bindGrants};
      if (removed?.assetRef) delete nextGrants[String(removed.assetRef)];
      publishChange(nextItems, nextGrants);
    },
    [bindGrants, commands, item.salesItemRef, items, menuRef, publishChange, queryContext],
  );

  const moveMedia = useCallback(
    (id: string, offset: -1 | 1) => {
      const index = items.findIndex(current => current.id === id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
      const nextItems = [...items];
      const [moved] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, moved);
      publishChange(nextItems, bindGrants);
    },
    [bindGrants, items, publishChange],
  );

  const setPrimary = useCallback(
    (id: string) => {
      const index = items.findIndex(current => current.id === id);
      if (index <= 0) return;
      const nextItems = [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
      publishChange(nextItems, bindGrants);
    },
    [bindGrants, items, publishChange],
  );

  return (
    <Space direction="vertical" size={10} style={{display: 'flex'}}>
      <Radio.Group
        value={mediaMode}
        onChange={event => {
          const nextMode = event.target.value as SalesMenuDisplayMedia['mode'];
          publishChange(nextMode === 'CUSTOM' ? items : [], bindGrants, nextMode);
        }}
        {...testId(salesMenuTestIds.itemMediaMode)}
      >
        <Radio value="INHERIT_CATALOG" {...testId(salesMenuTestIds.itemMediaChoice('INHERIT_CATALOG'))}>
          沿用商品图片
        </Radio>
        <Radio value="CUSTOM" {...testId(salesMenuTestIds.itemMediaChoice('CUSTOM'))}>
          单独设置
        </Radio>
      </Radio.Group>
      {mediaMode === 'INHERIT_CATALOG' ? (
        <Space direction="vertical" size={8}>
          <AssetPreview
            assetRef={item.catalogPrimaryImageAssetRef ?? undefined}
            alt={`${item.displayName}商品主图`}
            width={96}
            height={72}
          />
          <Typography.Text type="secondary">预览使用商品当前主图；菜单不会复制出另一份图片。</Typography.Text>
        </Space>
      ) : (
        <>
          {problem && <Alert type="error" showIcon title={problem} />}
          <AdminImageCollectionEditor
            items={items}
            limits={MEDIA_LIMITS}
            labels={{
              title: '展示图片',
              formatLimits: count => `${count}/6（1 张主图 + 5 张附图） · 单张上限 2MB`,
              loading: '媒体规则加载中',
              atLimit: '已达图片上限',
              upload: '上传图片',
              empty: '未配置图片',
              pendingPreview: asset => (
                <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
                  <Typography.Text type="secondary">
                    {asset.status === 'FAILED' ? '图片上传失败' : '待上传'}
                  </Typography.Text>
                </span>
              ),
              renderPreview: (asset, index, previewId) => (
                <AssetPreview
                  assetRef={asset.assetRef}
                  localFile={asset.file}
                  alt={`${index === 0 ? '主图' : `附图 ${index}`}预览`}
                  width={96}
                  height={72}
                  testId={previewId}
                />
              ),
              renderStatus: asset =>
                asset.status === 'UPLOADING'
                  ? '上传中/处理中'
                  : asset.status === 'FAILED'
                    ? (asset.error ?? '上传失败')
                    : asset.staged
                      ? '待保存'
                      : '可用',
              positionLabel: index => (index === 0 ? '★ 主图' : `附图 ${index}`),
              replace: '替换',
              retry: '重试',
              moveUp: '上移',
              moveDown: '下移',
              setPrimary: '设为主图',
              remove: '移除',
            }}
            testIds={{
              root: salesMenuTestIds.itemMediaEditor,
              upload: salesMenuTestIds.itemMediaUpload,
              list: salesMenuTestIds.itemMediaList,
              item: salesMenuTestIds.itemMedia,
            }}
            onStageMedia={stageMedia}
            onRemoveMedia={removeMedia}
            onMoveMedia={moveMedia}
            onSetPrimaryMedia={setPrimary}
          />
        </>
      )}
    </Space>
  );
}
