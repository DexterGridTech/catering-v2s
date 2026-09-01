import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  TreeSelect,
  Typography,
  Upload,
} from 'antd';
import type {FormInstance} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo, type ReactNode} from 'react';
import type {CatalogUnitList} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogDetail} from '../model/catalogModel';
import {catalogCentsToYuan, catalogYuanToCents, type CatalogMediaLimits} from '../model/catalogModel';
import type {CatalogEditorDraftSlice, CatalogItemBasicDraft, MediaDraft} from '../model/catalogItemEditorDraftAdapters';
import type {CatalogFieldRuntimeContext} from '../model/catalogFieldRuntime';
import {catalogJoinedField, type CatalogDescriptorManifest} from '../model/catalogDescriptorManifest';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {CatalogAssetPreview} from './CatalogAssetPreview';
import {CatalogDescriptorPicker} from './CatalogDescriptorPicker';
import {EmptySection} from './CatalogItemReadOnlyPresenters';
import {catalogFieldWidth} from './catalogFieldWidths';
import {useCatalogCategoryCandidates} from './useCatalogCategoryCandidates';

type CatalogUnitOption = CatalogUnitList['data']['units'][number];
type BasicFormValues = {displayName: string; shortName?: string};

function unitLabel(unit?: {name: string; code: string} | null) {
  return unit?.name || '未设置';
}

/** Owns the visual asset list; staging and release stay in the editor session. */
export function CatalogAssetEditor({
  mediaDraft,
  mediaLimits,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onSetPrimaryMedia,
}: {
  mediaDraft: MediaDraft[];
  mediaLimits?: CatalogMediaLimits;
  onStageMedia: (file: File, existingId?: string) => Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onSetPrimaryMedia: (id: string) => void;
}) {
  const disabled = !mediaLimits || mediaDraft.length >= (mediaLimits?.maxImageCount ?? 0);
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId(catalogTestIds.static.itemMediaEditor)}>
      <Space style={{width: '100%', justifyContent: 'space-between'}}>
        <Typography.Text strong>商品图片</Typography.Text>
        <Typography.Text type="secondary">
          {mediaLimits
            ? `${mediaDraft.length}/${mediaLimits.maxImageCount}（1 张主图 + ${Math.max(mediaLimits.maxImageCount - 1, 0)} 张附图） · 单张上限 ${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB`
            : '媒体规则加载中'}
        </Typography.Text>
      </Space>
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={file => {
          void onStageMedia(file as File);
          return Upload.LIST_IGNORE;
        }}
        disabled={disabled}
        {...testId(catalogTestIds.static.itemMediaUpload)}
      >
        <Button disabled={disabled}>{!mediaLimits ? '媒体规则加载中' : disabled ? '已达图片上限' : '上传图片'}</Button>
      </Upload>
      <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId(catalogTestIds.static.itemMediaList)}>
        {mediaDraft.length === 0 && <EmptySection text="未配置图片" />}
        {mediaDraft.map((asset, index) => {
          const businessIdentity = asset.assetRef || asset.id;
          return (
            <Space
              key={asset.id}
              align="start"
              style={{display: 'flex', border: '1px solid #f0f0f0', padding: 8, borderRadius: 6}}
              {...testId(catalogTestIdControls.edit.media(businessIdentity, 'row'))}
            >
              {asset.assetRef || (asset.staged && asset.file) ? (
                <CatalogAssetPreview
                  assetRef={asset.assetRef}
                  localFile={asset.staged ? asset.file : undefined}
                  alt={`${index === 0 ? '主图' : `附图 ${index}`}预览`}
                  width={96}
                  height={72}
                  testId={catalogTestIdControls.edit.media(businessIdentity, 'preview')}
                />
              ) : (
                <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
                  <Typography.Text type="secondary">待上传</Typography.Text>
                </span>
              )}
              <Space direction="vertical" size={2} style={{minWidth: 220}}>
                <Typography.Text strong>{index === 0 ? '★ 主图' : `附图 ${index}`}</Typography.Text>
                <Typography.Text ellipsis={{tooltip: asset.fileName}}>{asset.fileName}</Typography.Text>
                <Typography.Text
                  type={asset.status === 'FAILED' ? 'danger' : asset.status === 'UPLOADING' ? 'warning' : 'secondary'}
                  {...testId(catalogTestIdControls.edit.media(businessIdentity, 'status'))}
                >
                  {asset.status === 'UPLOADING'
                    ? '上传中/处理中'
                    : asset.status === 'FAILED'
                      ? (asset.error ?? '上传失败')
                      : asset.staged
                        ? '待保存'
                        : asset.assetRef
                          ? '可用'
                          : '待上传'}
                </Typography.Text>
              </Space>
              <Space wrap>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={file => {
                    void onStageMedia(file as File, asset.id);
                    return Upload.LIST_IGNORE;
                  }}
                  disabled={asset.status === 'UPLOADING'}
                >
                  <Button
                    size="small"
                    disabled={asset.status === 'UPLOADING'}
                    {...testId(catalogTestIdControls.edit.media(businessIdentity, 'replace'))}
                  >
                    替换
                  </Button>
                </Upload>
                {asset.status === 'FAILED' && asset.file && (
                  <Button
                    size="small"
                    onClick={() => void onStageMedia(asset.file as File, asset.id)}
                    {...testId(catalogTestIdControls.edit.media(businessIdentity, 'retry'))}
                  >
                    重试
                  </Button>
                )}
                {index > 0 && (
                  <Button
                    size="small"
                    onClick={() => onMoveMedia(asset.id, -1)}
                    {...testId(catalogTestIdControls.edit.media(businessIdentity, 'move-up'))}
                  >
                    上移
                  </Button>
                )}
                {index < mediaDraft.length - 1 && (
                  <Button
                    size="small"
                    onClick={() => onMoveMedia(asset.id, 1)}
                    {...testId(catalogTestIdControls.edit.media(businessIdentity, 'move-down'))}
                  >
                    下移
                  </Button>
                )}
                {index > 0 && (
                  <Button
                    size="small"
                    onClick={() => onSetPrimaryMedia(asset.id)}
                    {...testId(catalogTestIdControls.edit.media(businessIdentity, 'set-primary'))}
                  >
                    设为主图
                  </Button>
                )}
                <Button
                  size="small"
                  danger
                  disabled={index === 0 && mediaDraft.length > 1}
                  onClick={() => void onRemoveMedia(asset.id, index)}
                  {...testId(catalogTestIdControls.edit.media(businessIdentity, 'remove'))}
                >
                  移除
                </Button>
              </Space>
            </Space>
          );
        })}
      </Space>
    </Space>
  );
}

export function CatalogCategoryDescriptorField({
  manifest,
  shapeKey,
  value,
  selectedPathLabels = [],
  denied,
  scopeRef,
  brandRef,
  onChange,
  onDirty,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  value?: string;
  selectedPathLabels?: string[];
  denied: boolean;
  scopeRef?: string;
  brandRef?: string;
  onChange: (next: string | undefined) => void;
  onDirty: () => void;
}) {
  const field = useMemo(
    () => catalogJoinedField(manifest as CatalogDescriptorManifest | undefined, shapeKey, 'categoryRef'),
    [manifest, shapeKey],
  );
  const candidates = useCatalogCategoryCandidates({
    open: true,
    scopeRef,
    brandRef,
    usage: 'ITEM_ASSIGNMENT',
    selected: {categoryRef: value, pathLabels: selectedPathLabels},
  });
  if (!field)
    return (
      <Alert type="error" showIcon title="分类信息暂不可用" {...testId(catalogTestIds.static.itemCategoryFieldError)} />
    );
  return (
    <div>
      <Typography.Text strong>分类</Typography.Text>
      <TreeSelect
        allowClear
        showSearch
        filterTreeNode={false}
        searchValue={candidates.searchValue}
        onSearch={candidates.onSearch}
        value={value}
        treeData={candidates.treeData}
        loadData={candidates.loadData}
        loading={candidates.loading}
        disabled={denied || Boolean(candidates.problem)}
        onChange={next => {
          onChange(typeof next === 'string' && next ? next : undefined);
          onDirty();
        }}
        placeholder="请选择分类；也可以暂不分类"
        style={catalogFieldWidth('full')}
        {...testId(catalogTestIds.static.itemCategoryField)}
      />
      <Typography.Text type="secondary" style={{fontSize: 12}}>
        {candidates.problem ?? '选择商品所属分类，也可以暂不分类。'}
      </Typography.Text>
    </div>
  );
}

/** Owns item-level basic facts; it does not accept an opaque children fragment. */
export function CatalogItemBasicEditor({
  detail,
  manifest,
  form,
  mediaDraft,
  mediaLimits,
  unitOptions,
  unitsLoading,
  scopeRef,
  brandRef,
  basicDraft,
  denied,
  fieldLabel,
  lockedFact,
  locked,
  referencePickerContexts,
  categorySummary,
  onOpenTagDictionary,
  onDirty,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onSetPrimaryMedia,
}: {
  detail: CatalogDetail;
  manifest?: CatalogManifest;
  form: FormInstance<BasicFormValues>;
  mediaDraft: MediaDraft[];
  mediaLimits?: CatalogMediaLimits;
  unitOptions: CatalogUnitOption[];
  unitsLoading: boolean;
  scopeRef?: string;
  brandRef?: string;
  basicDraft: CatalogEditorDraftSlice<CatalogItemBasicDraft>;
  denied: (fieldKey: string) => boolean;
  fieldLabel: (fieldKey: string) => ReactNode;
  lockedFact: (fieldKey: string, value: ReactNode) => ReactNode;
  locked: (fieldKey: string) => ReactNode;
  referencePickerContexts: Record<'TAG', CatalogFieldRuntimeContext>;
  categorySummary: ReactNode;
  onOpenTagDictionary: () => void;
  onDirty: () => void;
  onStageMedia: (file: File, existingId?: string) => Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onSetPrimaryMedia: (id: string) => void;
}) {
  const {
    categoryRefDraft: categoryRef,
    selectedTagRefs,
    selectedSalesUnitRef,
    selectedBaseMeasureUnitRef,
    standardSalePriceDraft: standardSalePrice,
  } = basicDraft.values;
  return (
    <Space direction="vertical" size={16} style={{display: 'flex', width: '100%', maxWidth: 720, margin: '0 auto'}}>
      <Form form={form} layout="vertical" onValuesChange={onDirty}>
        <Alert type="info" showIcon title="商品编码与商品形态创建后不可修改" style={{marginBottom: 16}} />
        <Card size="small" title="基本信息">
          <Row gutter={[16, 0]} align="top">
            <Col xs={24} md={12}>
              {denied('name') ? (
                lockedFact('name', detail.item.name)
              ) : (
                <Form.Item
                  label={fieldLabel('name')}
                  name="displayName"
                  rules={[{required: true, message: '请输入商品名称'}]}
                >
                  <Input style={catalogFieldWidth('regular')} {...testId(catalogTestIds.static.itemEditName)} />
                </Form.Item>
              )}
            </Col>
            <Col xs={24} md={12}>
              {denied('shortName') ? (
                lockedFact('shortName', detail.item.shortName || '未设置')
              ) : (
                <Form.Item label={fieldLabel('shortName')} name="shortName">
                  <Input
                    placeholder="用于列表或小票的短展示名"
                    style={catalogFieldWidth('regular')}
                    {...testId(catalogTestIds.static.itemEditShortName)}
                  />
                </Form.Item>
              )}
            </Col>
            <Col span={24}>
              {denied('categoryRef') ? (
                lockedFact('categoryRef', categorySummary)
              ) : (
                <CatalogCategoryDescriptorField
                  manifest={manifest}
                  shapeKey={detail.item.shapeKey}
                  value={categoryRef}
                  selectedPathLabels={detail.item.categoryPath.map(node => node.name)}
                  denied={false}
                  scopeRef={scopeRef}
                  brandRef={brandRef}
                  onChange={next => basicDraft.onChange({categoryRefDraft: next})}
                  onDirty={onDirty}
                />
              )}
            </Col>
            <Col span={24}>
              {denied('tagRefs') ? (
                lockedFact('tagRefs', selectedTagRefs.length ? `已设置 ${selectedTagRefs.length} 个商品标签` : '未设置')
              ) : (
                <CatalogDescriptorPicker
                  manifest={manifest}
                  shapeKey={detail.item.shapeKey}
                  fieldKey="tagRefs"
                  value={selectedTagRefs}
                  context={referencePickerContexts.TAG}
                  actions={
                    <Button size="small" onClick={onOpenTagDictionary} {...testId(catalogTestIds.static.itemTagManage)}>
                      维护商品标签
                    </Button>
                  }
                  actionsPlacement="after-label"
                  actionsAlign="end"
                  testIdValue={catalogTestIds.static.itemTagRefs}
                  width="100%"
                  onChange={next =>
                    basicDraft.onChange({selectedTagRefs: Array.isArray(next) ? next : next ? [next] : []})
                  }
                />
              )}
            </Col>
          </Row>
        </Card>
        <Card size="small" title="销售与计量">
          <Row gutter={[16, 0]} align="top">
            <Col xs={24} sm={8}>
              {denied('salesUnitRef') ? (
                lockedFact(
                  'salesUnitRef',
                  selectedSalesUnitRef
                    ? (unitOptions.find(unit => unit.unitRef === selectedSalesUnitRef)?.name ?? '已设置')
                    : '未设置',
                )
              ) : (
                <Form.Item label={fieldLabel('salesUnitRef')} extra="商品销售单位只能选择一个；原料可以留空。">
                  <Select
                    style={catalogFieldWidth('compact')}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    value={selectedSalesUnitRef}
                    loading={unitsLoading}
                    options={unitOptions.map(unit => ({value: unit.unitRef, label: unitLabel(unit)}))}
                    onChange={next => basicDraft.onChange({selectedSalesUnitRef: next})}
                    {...testId(catalogTestIds.static.itemSalesUnit)}
                  />
                </Form.Item>
              )}
            </Col>
            <Col xs={24} sm={8}>
              {denied('baseMeasureUnitRef') ? (
                lockedFact(
                  'baseMeasureUnitRef',
                  selectedBaseMeasureUnitRef
                    ? (unitOptions.find(unit => unit.unitRef === selectedBaseMeasureUnitRef)?.name ?? '已设置')
                    : '未设置',
                )
              ) : (
                <Form.Item
                  label={fieldLabel('baseMeasureUnitRef')}
                  extra="用于记录库存扣减数量；配置配方或库存时必须填写。"
                >
                  <Select
                    style={catalogFieldWidth('compact')}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    value={selectedBaseMeasureUnitRef}
                    loading={unitsLoading}
                    options={unitOptions.map(unit => ({value: unit.unitRef, label: unitLabel(unit)}))}
                    onChange={next => basicDraft.onChange({selectedBaseMeasureUnitRef: next})}
                    {...testId(catalogTestIds.static.itemBaseMeasureUnit)}
                  />
                </Form.Item>
              )}
            </Col>
            <Col xs={24} sm={8}>
              {detail.item.priceGranularity === 'ITEM' ? (
                denied('standardSalePrice') ? (
                  lockedFact(
                    'standardSalePrice',
                    standardSalePrice === null ? '—' : `¥${(standardSalePrice / 100).toFixed(2)}`,
                  )
                ) : (
                  <Form.Item label={fieldLabel('standardSalePrice')}>
                    <InputNumber
                      min={0}
                      precision={2}
                      step={0.01}
                      suffix="元"
                      value={catalogCentsToYuan(standardSalePrice)}
                      onChange={value => basicDraft.onChange({standardSalePriceDraft: catalogYuanToCents(value)})}
                      style={catalogFieldWidth('compact')}
                      {...testId(catalogTestIds.static.itemEditStandardPrice)}
                    />
                  </Form.Item>
                )
              ) : (
                <Form.Item label={fieldLabel('standardSalePrice')}>
                  <Typography.Text type="secondary">标准价在规格矩阵中维护。</Typography.Text>
                </Form.Item>
              )}
            </Col>
          </Row>
        </Card>
      </Form>
      {denied('images') ? (
        locked('images')
      ) : (
        <CatalogAssetEditor
          mediaDraft={mediaDraft}
          mediaLimits={mediaLimits}
          onStageMedia={onStageMedia}
          onRemoveMedia={onRemoveMedia}
          onMoveMedia={onMoveMedia}
          onSetPrimaryMedia={onSetPrimaryMedia}
        />
      )}
    </Space>
  );
}
