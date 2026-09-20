import {Alert, Button, Descriptions, Drawer, Skeleton, Space, Tag} from 'antd';
import {useEffect, useRef} from 'react';
import {
  adminWideDrawerSurfaceProps,
  NameCodeText,
  StatusChangeConfirm,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import type {CatalogItemDrawerProps} from '../model/catalogItemSurfaceTypes';
import {catalogTestIds} from '../catalogTestIds';
import {useCatalogItemEditorWorkspaceState} from './useCatalogItemEditorWorkspaceState';
import {CatalogItemEditorTabs} from './CatalogItemEditorTabs';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';
import {CatalogDictionaryDrawer} from './CatalogDictionaryDrawer';

/**
 * The actual first-level editing surface.  It owns the visible drawer
 * lifecycle, left section anchors and fixed whole-item save footer; section
 * fields and owner candidates stay in their fact-family presenters.
 */
export function CatalogItemEditorWorkspace(props: CatalogItemDrawerProps) {
  const state = useCatalogItemEditorWorkspaceState(props);
  const {detail, manifest} = state;
  const contentRegionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const contentRegion = contentRegionRef.current;
    if (!contentRegion) return;
    contentRegion.scrollTop = state.contentScrollTop;
  }, [state.activeTab, state.contentScrollTop]);
  return (
    <Drawer
      title={
        detail ? (
          <Space>
            <NameCodeText name={detail.item.name} code={detail.item.code} />
            <span>· 编辑商品</span>
            <Tag>{catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)}</Tag>
            <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={detail.item.lifecycle.status} />
          </Space>
        ) : (
          '编辑商品'
        )
      }
      open={Boolean(props.itemCode)}
      onClose={state.requestClose}
      afterOpenChange={state.afterOpenChange}
      destroyOnHidden={false}
      maskClosable={!state.lifecycleSubmitting}
      keyboard={!state.lifecycleSubmitting}
      footer={
        detail ? (
          <Space style={{display: 'flex', justifyContent: 'flex-end'}}>
            <Button onClick={state.requestClose}>取消</Button>
            <Button
              type="primary"
              loading={state.lifecycleSubmitting}
              onClick={() => void state.submit()}
              {...testId(catalogTestIds.static.itemSave)}
            >
              保存商品
            </Button>
          </Space>
        ) : null
      }
      {...adminWideDrawerSurfaceProps}
      {...testId(catalogTestIds.surface.itemEditDrawer)}
      styles={{body: {overflow: 'hidden', padding: '0 24px'}}}
    >
      <div
        ref={contentRegionRef}
        onScroll={event => state.setContentScrollTop(event.currentTarget.scrollTop)}
        style={{height: '100%', overflowY: 'auto', padding: '24px 0'}}
      >
        {state.detailQuery.isLoading && <Skeleton active {...testId(catalogTestIds.static.itemDetailLoading)} />}
        {(state.problem || state.detailQuery.error || state.mediaProblem) && (
          <div
            ref={state.problemRef}
            tabIndex={-1}
            style={{marginBottom: 16}}
            {...testId(catalogTestIds.static.itemProblem)}
          >
            <Alert
              type="error"
              showIcon
              title="商品操作未完成"
              description={state.problem ?? state.mediaProblem ?? '商品内容暂时无法加载，请重新加载。'}
              action={
                state.detailQuery.error ? (
                  <Button
                    size="small"
                    onClick={() => void state.detailQuery.refetch()}
                    {...testId(catalogTestIds.static.itemProblemRetry)}
                  >
                    重新加载
                  </Button>
                ) : state.releaseCloseFailed ? (
                  <Button
                    size="small"
                    loading={state.releasingBeforeClose}
                    onClick={() => void state.closeAfterStagedRelease()}
                    {...testId(catalogTestIds.static.itemReleaseCloseRetry)}
                  >
                    重试关闭
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
        {detail?.item.source === 'AUTO_SYNC' && (
          <Space direction="vertical" size={8} style={{display: 'flex'}}>
            <Alert
              type="info"
              showIcon
              title="自动同步商品"
              description={`带锁字段（${state.autoSyncLockedFieldLabels || '来源声明字段'}）由上游维护；未被锁定的本地补充字段仍可编辑。`}
              {...testId(catalogTestIds.static.itemSourceAutoSync)}
            />
            <Descriptions
              size="small"
              bordered
              column={3}
              items={[{key: 'source-status', label: '来源状态', children: '由外部系统维护'}]}
              {...testId(catalogTestIds.static.itemSourceAutoSyncFacts)}
            />
          </Space>
        )}
        {detail && state.sectionProps && (
          <div {...testId(catalogTestIds.static.itemTabs)}>
            <CatalogItemEditorTabs
              detail={detail}
              activeTab={state.activeTab}
              sectionState={state.sectionState}
              sectionProps={state.sectionProps}
              onActiveTabChange={state.setActiveTab}
            />
          </div>
        )}
      </div>
      <CatalogDictionaryDrawer
        open={state.configurationTask.kind === 'CONFIG'}
        initialKind={state.configurationTask.kind === 'CONFIG' ? state.configurationTask.library : undefined}
        parentEntryRef={state.configurationTask.kind === 'CONFIG' ? state.configurationTask.parentEntryRef : undefined}
        queryContext={props.queryContext}
        brandRef={props.brandRef}
        canWrite={props.canWriteCatalog}
        presentation="EDITOR_CHILD"
        onClose={state.closeConfiguration}
        onAfterClose={state.afterConfigurationClose}
      />
      {state.pendingVoidSku && (
        <StatusChangeConfirm
          open
          title={
            <span>
              作废规格“
              <NameCodeText name={state.pendingVoidSku.skuName} code={state.pendingVoidSku.skuCode} />
              ”？
            </span>
          }
          actionLabel="作废"
          dangerous={Boolean(state.pendingVoidSku)}
          submitting={Boolean(state.voidingSkuRef)}
          problem={state.problem}
          onCancel={() => state.setPendingVoidSku(undefined)}
          onConfirm={() => void state.confirmVoidSku()}
          confirmTestId="catalog-sku-void-confirm"
          cancelTestId="catalog-sku-void-cancel"
          modalTestId="catalog-sku-void-modal"
        >
          作废后该规格不再占用商品编码；此操作不可逆，商品其他事实不会被清空。
        </StatusChangeConfirm>
      )}
    </Drawer>
  );
}

export type {CatalogItemDrawerProps};
