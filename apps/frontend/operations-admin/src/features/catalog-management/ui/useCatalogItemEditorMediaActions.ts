import {useCallback} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {useCatalogItemEditorSession} from '../model/useCatalogItemEditorSession';
import type {MediaDraft, SkuRowDraft} from '../model/catalogItemEditorDraftAdapters';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';

type Session = ReturnType<typeof useCatalogItemEditorSession>;

type Props = {
  itemCode?: string;
  mediaLimits: Session['mediaLimits'];
  mediaDraft: MediaDraft[];
  skuStagedMedia: MediaDraft[];
  skusDraft: SkuRowDraft[];
  setMediaDraft: Dispatch<SetStateAction<MediaDraft[]>>;
  setSkuStagedMedia: Dispatch<SetStateAction<MediaDraft[]>>;
  setSkusDraft: Dispatch<SetStateAction<SkuRowDraft[]>>;
  stageStagedAsset: Session['stageStagedAsset'];
  releaseStagedAsset: Session['releaseStagedAsset'];
  setDirty: (dirty: boolean) => void;
  setProblem: (problem?: string) => void;
};

/**
 * Owns only item/SKU staged-media transitions. The item draft stays in the
 * session hook; this adapter never reads or changes unrelated fact families.
 */
export function useCatalogItemEditorMediaActions({
  itemCode,
  mediaLimits,
  mediaDraft,
  skuStagedMedia,
  skusDraft,
  setMediaDraft,
  setSkuStagedMedia,
  setSkusDraft,
  stageStagedAsset,
  releaseStagedAsset,
  setDirty,
  setProblem,
}: Props) {
  const stageMedia = useCallback(
    async (file: File, existingId?: string) => {
      if (!mediaLimits) {
        setProblem('媒体规则尚未加载，请稍后重试。');
        return;
      }
      if (!existingId && mediaDraft.length >= mediaLimits.maxImageCount) {
        setProblem(
          `最多维护 ${mediaLimits.maxImageCount} 张图片（1 张主图 + ${Math.max(mediaLimits.maxImageCount - 1, 0)} 张附图）。`,
        );
        return;
      }
      if (file.size > mediaLimits.maxImageBytes) {
        setProblem(`单张图片不能超过 ${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB。`);
        return;
      }
      const id = existingId ?? globalThis.crypto.randomUUID();
      setProblem(undefined);
      const previous = existingId ? mediaDraft.find(asset => asset.id === existingId) : undefined;
      setMediaDraft(current =>
        existingId
          ? current.map(asset =>
              asset.id === existingId
                ? {
                    ...asset,
                    assetRef: undefined,
                    version: undefined,
                    file,
                    fileName: file.name,
                    mediaType: file.type || 'application/octet-stream',
                    status: 'UPLOADING',
                    error: undefined,
                    staged: true,
                    previous: previous
                      ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged}
                      : undefined,
                  }
                : asset,
            )
          : [
              ...current,
              {
                id,
                file,
                fileName: file.name,
                mediaType: file.type || 'application/octet-stream',
                status: 'UPLOADING',
                staged: true,
              },
            ],
      );
      let stagedMedia: MediaDraft | undefined;
      try {
        const readback = await stageStagedAsset({file, correlationId: itemCode});
        stagedMedia = {
          id,
          assetRef: readback.assetRef,
          bindGrant: readback.bindGrant,
          file,
          fileName: file.name,
          mediaType: readback.mediaType,
          status: 'READY',
          version: readback.version,
          staged: true,
        };
        const previousAsset = previous
          ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged}
          : undefined;
        if (previousAsset?.staged && previousAsset.assetRef && previousAsset.version !== undefined) {
          const released = await releaseStagedAsset({
            ...previousAsset,
            id: `${id}-previous`,
            fileName: previousAsset.assetRef,
            mediaType: file.type,
            status: 'READY',
          });
          if (!released) throw new Error('CATALOG_PREVIOUS_STAGED_ASSET_RELEASE_FAILED');
        }
        setMediaDraft(current =>
          current.map(asset => (asset.id === id ? {...asset, ...stagedMedia, previous: undefined} : asset)),
        );
        setDirty(true);
      } catch (error) {
        if (stagedMedia) await releaseStagedAsset(stagedMedia);
        const previousAsset = previous
          ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged}
          : undefined;
        setMediaDraft(current =>
          current.map(asset =>
            asset.id === id
              ? {
                  ...asset,
                  assetRef: previousAsset?.assetRef,
                  version: previousAsset?.version,
                  staged: previousAsset?.staged ?? true,
                  previous: undefined,
                  status: 'FAILED',
                  error: catalogUiProblemFeedback(error, '上传失败，请重试。').message,
                }
              : asset,
          ),
        );
        setProblem(catalogUiProblemFeedback(error, '图片上传失败，请重试。').message);
      }
    },
    [itemCode, mediaDraft, mediaLimits, releaseStagedAsset, setDirty, setMediaDraft, setProblem, stageStagedAsset],
  );

  const removeMedia = useCallback(
    async (id: string, index: number) => {
      if (index === 0 && mediaDraft.length > 1) {
        setProblem('仍有其他图片时，请先指定新的主图。');
        return;
      }
      const asset = mediaDraft.find(entry => entry.id === id);
      if (!asset) return;
      if (!(await releaseStagedAsset(asset))) {
        setProblem('图片资产释放未完成，请重试。');
        return;
      }
      setMediaDraft(current => current.filter(entry => entry.id !== id));
      setProblem(undefined);
      setDirty(true);
    },
    [mediaDraft, releaseStagedAsset, setDirty, setMediaDraft, setProblem],
  );

  const moveMedia = useCallback(
    (id: string, offset: -1 | 1) => {
      setMediaDraft(current => {
        const index = current.findIndex(asset => asset.id === id);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
      setDirty(true);
    },
    [setDirty, setMediaDraft],
  );

  const setPrimaryMedia = useCallback(
    (id: string) => {
      setMediaDraft(current => {
        const index = current.findIndex(asset => asset.id === id);
        if (index <= 0) return current;
        const next = [...current];
        const [primary] = next.splice(index, 1);
        next.unshift(primary);
        return next;
      });
      setDirty(true);
    },
    [setDirty, setMediaDraft],
  );

  const stageSkuMedia = useCallback(
    async (file: File, skuEditorId: string, replaceAssetRef?: string, retryId?: string) => {
      if (!mediaLimits) {
        setProblem('媒体规则尚未加载，请稍后重试。');
        return;
      }
      const skuIndex = skusDraft.findIndex(sku => sku.editorId === skuEditorId);
      if (skuIndex < 0) {
        setProblem('规格资料已变化，请重新打开后再上传图片。');
        return;
      }
      const currentSkuMediaCount = skusDraft[skuIndex]?.mediaRefs.length ?? 0;
      if (!replaceAssetRef && !retryId && currentSkuMediaCount >= mediaLimits.maxImageCount) {
        setProblem(`每个规格最多维护 ${mediaLimits.maxImageCount} 张图片。`);
        return;
      }
      if (file.size > mediaLimits.maxImageBytes) {
        setProblem(`单张图片不能超过 ${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB。`);
        return;
      }
      const retry = retryId ? skuStagedMedia.find(asset => asset.id === retryId) : undefined;
      const previousStaged = replaceAssetRef
        ? skuStagedMedia.find(asset => asset.assetRef === replaceAssetRef)
        : undefined;
      const previous =
        retry?.previous ??
        (replaceAssetRef
          ? {assetRef: replaceAssetRef, version: previousStaged?.version, staged: previousStaged?.staged ?? false}
          : undefined);
      const id = retryId ?? globalThis.crypto.randomUUID();
      const pending: MediaDraft = {
        id,
        skuEditorId,
        file,
        fileName: file.name,
        mediaType: file.type || 'application/octet-stream',
        status: 'UPLOADING',
        staged: true,
        previous,
      };
      setProblem(undefined);
      setSkuStagedMedia(current =>
        retryId ? current.map(asset => (asset.id === retryId ? pending : asset)) : [...current, pending],
      );
      let stagedMedia: MediaDraft | undefined;
      try {
        const readback = await stageStagedAsset({file, correlationId: itemCode});
        stagedMedia = {
          ...pending,
          assetRef: readback.assetRef,
          bindGrant: readback.bindGrant,
          mediaType: readback.mediaType,
          status: 'READY',
          version: readback.version,
        };
        if (previousStaged && !(await releaseStagedAsset(previousStaged)))
          throw new Error('CATALOG_PREVIOUS_STAGED_ASSET_RELEASE_FAILED');
        setSkusDraft(current =>
          current.map(sku =>
            sku.editorId !== skuEditorId
              ? sku
              : {
                  ...sku,
                  mediaRefs: replaceAssetRef
                    ? sku.mediaRefs.map(assetRef => (assetRef === replaceAssetRef ? readback.assetRef : assetRef))
                    : [...sku.mediaRefs, readback.assetRef],
                },
          ),
        );
        setSkuStagedMedia(current => [
          ...current.filter(asset => asset.id !== id && asset.assetRef !== previous?.assetRef),
          stagedMedia!,
        ]);
        setDirty(true);
      } catch (error) {
        if (stagedMedia) await releaseStagedAsset(stagedMedia);
        setSkuStagedMedia(current =>
          current.map(asset =>
            asset.id === id
              ? {
                  ...asset,
                  assetRef: undefined,
                  status: 'FAILED',
                  error: catalogUiProblemFeedback(error, '规格图片上传失败，请重试。').message,
                }
              : asset,
          ),
        );
        setProblem(catalogUiProblemFeedback(error, '规格图片上传失败，请重试。').message);
      }
    },
    [
      itemCode,
      mediaLimits,
      releaseStagedAsset,
      setDirty,
      setProblem,
      setSkuStagedMedia,
      setSkusDraft,
      skuStagedMedia,
      skusDraft,
      stageStagedAsset,
    ],
  );

  const removeSkuMedia = useCallback(
    async (skuEditorId: string, assetRef: string) => {
      const staged = skuStagedMedia.find(asset => asset.assetRef === assetRef);
      if (staged && !(await releaseStagedAsset(staged))) {
        setProblem('规格图片资产释放未完成，请重试。');
        return;
      }
      setSkusDraft(current =>
        current.map(sku =>
          sku.editorId === skuEditorId ? {...sku, mediaRefs: sku.mediaRefs.filter(entry => entry !== assetRef)} : sku,
        ),
      );
      setSkuStagedMedia(current => current.filter(asset => asset.assetRef !== assetRef));
      setDirty(true);
    },
    [releaseStagedAsset, setDirty, setProblem, setSkuStagedMedia, setSkusDraft, skuStagedMedia],
  );

  const removeSkuStagedMedia = useCallback(
    (id: string) => setSkuStagedMedia(current => current.filter(asset => asset.id !== id)),
    [setSkuStagedMedia],
  );

  return {stageMedia, removeMedia, moveMedia, setPrimaryMedia, stageSkuMedia, removeSkuMedia, removeSkuStagedMedia};
}
