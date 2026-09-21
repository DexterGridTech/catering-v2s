import {Alert, Button, Card, Flex, Input, InputNumber, Modal, Radio, Select, Space, Typography} from 'antd';
import type {UIEvent} from 'react';
import {useEffect, useMemo, useState} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogOrderOptionConfig, CatalogProductionTagOwner, CatalogSkuRow} from '../model/catalogModel';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {
  clonePreparationProfile,
  skuPreparationOverrideForMode,
  type CatalogEditorDraftSlice,
  type CatalogItemProductionDraft,
  type PreparationProfileDraft,
} from '../model/catalogItemEditorDraftAdapters';
import {EmptySection, PreparationProfileReadOnly, PreparationVariationSummary} from './CatalogItemReadOnlyPresenters';

export type ProductionTagOption = {
  tagRef: string;
  code: string;
  name: string;
  owner: CatalogProductionTagOwner;
  status?: string;
};

export function PreparationProfileEditor({
  profile,
  selectedTagRef,
  selectedTag,
  tagOptions = [],
  tagsLoading = false,
  showProductionTag = true,
  heading = '商品默认制作信息',
  description = '这些信息会作为商品通常采用的制作内容。',
  onTagsSearch = () => undefined,
  onTagsPopupScroll = () => undefined,
  onOpenProductionTags,
  onTagsChange,
  onChange,
  onDirty,
}: {
  profile: PreparationProfileDraft | null;
  selectedTagRef?: string;
  selectedTag?: ProductionTagOption;
  tagOptions?: Array<{label: string; value: string; disabled?: boolean}>;
  tagsLoading?: boolean;
  /** Only the product-level editor may select a production tag. */
  showProductionTag?: boolean;
  heading?: string;
  description?: string;
  onTagsSearch?: (value: string) => void;
  onTagsPopupScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onOpenProductionTags?: () => void;
  onTagsChange?: (next: string | undefined) => void;
  onChange: (next: PreparationProfileDraft | null) => void;
  onDirty: () => void;
}) {
  const current: PreparationProfileDraft = profile ?? {
    productionDisplayName: null,
    estimatedPreparationSeconds: null,
    preparationNotes: null,
  };
  const update = (patch: Partial<PreparationProfileDraft>) => {
    onChange({...current, ...patch});
    onDirty();
  };
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemPreparationEditor)}
    >
      <Typography.Title level={5} style={{margin: 0}}>
        {heading}
      </Typography.Title>
      <Typography.Text type="secondary">{description}</Typography.Text>
      {showProductionTag ? (
        <div>
          <Flex align="center" gap="small" wrap style={{width: '100%'}}>
            <Typography.Text strong>生产标签</Typography.Text>
            {onOpenProductionTags && (
              <Button
                size="small"
                onClick={onOpenProductionTags}
                style={{marginInlineStart: 'auto'}}
                {...testId(catalogTestIds.static.itemProductionTagManage)}
              >
                维护生产标签
              </Button>
            )}
          </Flex>
          <Select
            allowClear
            value={selectedTagRef}
            options={tagOptions}
            optionRender={option => (
              <span {...testId(catalogTestIdControls.edit.productionTagOption(String(option.value)))}>
                {option.label}
              </span>
            )}
            loading={tagsLoading}
            showSearch
            filterOption={false}
            placeholder="选择生产标签"
            onSearch={onTagsSearch}
            onChange={onTagsChange}
            onPopupScroll={onTagsPopupScroll}
            style={{width: '100%', marginTop: 6}}
            {...testId(catalogTestIds.static.itemProductionTags)}
          />
          {selectedTag?.status === 'DISABLED' && (
            <Typography.Text type="warning" style={{display: 'block', marginTop: 4}}>
              已停用的标签会保留在当前设置中，但不能用于新选择。
            </Typography.Text>
          )}
        </div>
      ) : null}
      <div>
        <Typography.Text strong>制作单显示名称</Typography.Text>
        <Input
          style={{width: '100%', marginTop: 6}}
          maxLength={120}
          showCount
          value={current.productionDisplayName ?? ''}
          placeholder="例如：大杯热拿铁"
          onChange={event => update({productionDisplayName: event.target.value || null})}
          {...testId(catalogTestIds.static.itemProductionName)}
        />
      </div>
      <div>
        <Typography.Text strong>预计制作时长（秒）</Typography.Text>
        <Typography.Text type="secondary" style={{display: 'block', marginTop: 2}}>
          填写零或正整数。
        </Typography.Text>
        <InputNumber
          style={{width: 160, marginTop: 6}}
          min={0}
          precision={0}
          value={current.estimatedPreparationSeconds ?? undefined}
          placeholder="例如：180"
          onChange={value => update({estimatedPreparationSeconds: value ?? null})}
          {...testId(catalogTestIds.static.itemProductionSeconds)}
        />
      </div>
      <div>
        <Typography.Text strong>制作说明</Typography.Text>
        <Input.TextArea
          style={{width: '100%', marginTop: 6}}
          autoSize={{minRows: 3, maxRows: 8}}
          maxLength={1000}
          showCount
          value={current.preparationNotes ?? ''}
          placeholder="留空表示未维护"
          onChange={event => update({preparationNotes: event.target.value || null})}
          {...testId(catalogTestIds.static.itemProductionNotes)}
        />
      </div>
    </Space>
  );
}

export function CatalogItemProductionEditor({
  canEdit,
  productionDraft,
  knownTags,
  scopeRef,
  brandRef,
  onOpenProductionTags,
  onDirty,
  readOnlyProfile,
  skus,
  orderOptions,
  shapeKey,
  onNavigateToOptions,
}: {
  canEdit: boolean;
  productionDraft: CatalogEditorDraftSlice<CatalogItemProductionDraft>;
  knownTags: ProductionTagOption[];
  scopeRef?: string;
  brandRef?: string;
  onOpenProductionTags?: () => void;
  onDirty: () => void;
  readOnlyProfile: PreparationProfileDraft | null;
  skus: CatalogSkuRow[];
  orderOptions: CatalogOrderOptionConfig[];
  shapeKey: string;
  onNavigateToOptions: () => void;
}) {
  const {preparationProfileDraft: profile, selectedProductionTagRef: selectedTagRef} = productionDraft.values;
  const [queryText, setQueryText] = useState('');
  const candidates = useCursorCandidates<ProductionTagOption>({
    queryText,
    resetKey: `${scopeRef ?? ''}|${brandRef ?? ''}`,
    pageSize: 50,
    keyOf: tag => tag.tagRef,
  });
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsProductionTags(
        {},
        {
          query: {
            dataNodeRef: wireUuid(scopeRef ?? ''),
            usage: 'BINDABLE_CANDIDATE',
            ...(candidates.debouncedQueryText ? {query: candidates.debouncedQueryText} : {}),
            ...(candidates.cursor ? {cursor: candidates.cursor} : {}),
            pageSize: candidates.pageSize,
          },
          headers,
        },
      ),
    [candidates.cursor, candidates.debouncedQueryText, candidates.pageSize, headers, scopeRef],
  );
  const tagQuery = operationsRtk.useGetOperationsProductionTagsQuery(request, {skip: !canEdit || !scopeRef});
  const tagPage = tagQuery.currentData?.data;
  const acceptPage = candidates.acceptPage;
  const pageSize = candidates.pageSize;
  useEffect(() => {
    if (!tagPage) return;
    acceptPage(
      tagPage.entries.map(entry => ({
        tagRef: entry.tagRef,
        code: entry.code,
        name: entry.name,
        owner: 'catalog',
        status: entry.status,
      })),
      {
        pageSize,
        total: tagPage.total,
        nextCursor: tagPage.cursor,
      },
    );
  }, [acceptPage, pageSize, tagPage]);
  const tagMap = new Map<string, ProductionTagOption>(
    [...knownTags, ...candidates.items].map(tag => [tag.tagRef, tag]),
  );
  const selectedTag = selectedTagRef
    ? (tagMap.get(selectedTagRef) ?? {
        tagRef: selectedTagRef,
        code: '',
        name: '已维护的生产标签',
        owner: 'catalog',
        status: 'DISABLED',
      })
    : undefined;
  const tagOptions = Array.from(tagMap.values()).map(tag => ({
    label: tag.name || tag.code || '已维护的生产标签',
    value: tag.tagRef,
    disabled: tag.status !== undefined && tag.status !== 'ENABLED',
  }));
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}}>
      {canEdit ? (
        <PreparationProfileEditor
          profile={profile}
          selectedTagRef={selectedTagRef}
          selectedTag={selectedTag}
          tagOptions={tagOptions}
          tagsLoading={tagQuery.isLoading || tagQuery.isFetching}
          onTagsSearch={setQueryText}
          onTagsPopupScroll={event => candidates.onPopupScroll(event, tagQuery.isFetching)}
          onOpenProductionTags={onOpenProductionTags}
          onTagsChange={next => productionDraft.onChange({selectedProductionTagRef: next})}
          onChange={next => productionDraft.onChange({preparationProfileDraft: next})}
          onDirty={onDirty}
        />
      ) : (
        <PreparationProfileReadOnly profile={readOnlyProfile} tag={selectedTag} />
      )}
      <PreparationVariationSummary
        skus={skus}
        orderOptions={orderOptions}
        shapeKey={shapeKey}
        onNavigateToOptions={onNavigateToOptions}
      />
    </Space>
  );
}

function emptyPreparationProfile(): PreparationProfileDraft {
  return {productionDisplayName: null, estimatedPreparationSeconds: null, preparationNotes: null};
}

/** A SKU may replace the complete profile, but never select a production tag. */
export function SkuPreparationEditorModal({
  open,
  sku,
  itemDefaultPreparation,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  sku?: CatalogSkuRow;
  itemDefaultPreparation: PreparationProfileDraft | null;
  onCancel: () => void;
  onConfirm: (value: CatalogSkuRow['preparationOverride']) => void;
}) {
  const [mode, setMode] = useState<'INHERIT_ITEM' | 'OVERRIDE'>('INHERIT_ITEM');
  const [profile, setProfile] = useState<PreparationProfileDraft>(emptyPreparationProfile);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    if (!open || !sku) return;
    setMode(sku.preparationOverride.mode);
    setProfile(clonePreparationProfile(sku.preparationOverride.profile) ?? emptyPreparationProfile());
    setProblem(undefined);
  }, [open, sku]);
  return (
    <Modal
      open={open}
      title={<span>维护制作信息 · {sku?.skuName || '当前规格'}</span>}
      onCancel={onCancel}
      onOk={() => {
        if (mode === 'INHERIT_ITEM') {
          onConfirm(skuPreparationOverrideForMode('INHERIT_ITEM', null));
          return;
        }
        if (profile.estimatedPreparationSeconds !== null && profile.estimatedPreparationSeconds < 0) {
          setProblem('预计制作时长请填写零或正整数。');
          return;
        }
        onConfirm(skuPreparationOverrideForMode('OVERRIDE', profile));
      }}
      okText="确定"
      cancelText="取消"
      destroyOnHidden
      {...testId(catalogTestIds.static.skuPreparationModal)}
    >
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {problem && <Alert type="error" showIcon title={problem} role="alert" />}
        <Radio.Group
          value={mode}
          onChange={event => {
            setMode(event.target.value);
            setProblem(undefined);
          }}
          options={[
            {label: '使用商品默认', value: 'INHERIT_ITEM'},
            {label: '单独设置', value: 'OVERRIDE'},
          ]}
          {...testId(catalogTestIds.static.skuPreparationMode)}
        />
        {mode === 'INHERIT_ITEM' ? (
          <>
            <Typography.Text type="secondary">使用商品默认时，会随商品的默认制作信息一起变化。</Typography.Text>
            <Card size="small" title="当前商品默认">
              {itemDefaultPreparation ? (
                <PreparationProfileReadOnly profile={itemDefaultPreparation} />
              ) : (
                <EmptySection text="当前商品尚未设置默认制作信息" />
              )}
            </Card>
          </>
        ) : (
          <>
            <Typography.Text type="secondary">单独设置时，将使用本规格自己的一整套制作信息。</Typography.Text>
            <PreparationProfileEditor
              profile={profile}
              showProductionTag={false}
              heading="本规格制作信息"
              description="本规格的制作信息不会随商品默认自动变化。"
              onChange={next => setProfile(next ?? emptyPreparationProfile())}
              onDirty={() => setProblem(undefined)}
            />
            <Button
              type="link"
              onClick={() => {
                setMode('INHERIT_ITEM');
                setProfile(emptyPreparationProfile());
              }}
              {...testId(catalogTestIds.static.skuPreparationClear)}
            >
              清除单独设置并恢复商品默认
            </Button>
          </>
        )}
        <Typography.Text type="secondary">返回商品页面后仍需点击保存才会生效。</Typography.Text>
      </Space>
    </Modal>
  );
}
