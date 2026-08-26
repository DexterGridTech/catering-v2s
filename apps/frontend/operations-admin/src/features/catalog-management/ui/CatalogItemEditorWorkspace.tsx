import {Alert, Button, Descriptions, Drawer, Modal, Skeleton, Space, Tag} from 'antd';
import {useEffect, useRef} from 'react';
import {adminWideDrawerSurfaceProps, NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import {catalogEditorTabLabel} from '../model/catalogTabLabels';
import type {CatalogItemDrawerProps} from '../model/catalogItemSurfaceTypes';
import {CatalogAssetPreview} from './CatalogAssetPreview';
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
            {state.detailImageRefs[0] && (
              <CatalogAssetPreview
                assetRef={state.detailImageRefs[0]}
                alt={`${detail.item.name}主图`}
                width={40}
                height={40}
                preview={false}
                testId={catalogTestIds.static.itemDrawerThumbnail}
              />
            )}
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
      <Modal
        open={Boolean(state.restoreCandidate || state.restoreProblem)}
        title={
          state.restoreStatus === 'RECOVERABLE'
            ? `检测到${detail?.item.name ?? '该商品'}的未保存内容`
            : state.restoreStatus === 'STALE_SERVER_VERSION'
              ? '发现较早的编辑内容'
              : '上次编辑内容无法恢复'
        }
        onCancel={state.requestClose}
        closable
        maskClosable={false}
        keyboard
        footer={
          state.restoreStatus === 'RECOVERABLE' ? (
            <Space>
              <Button onClick={state.discardRestore} {...testId(catalogTestIds.control.dirtyDiscard)}>
                放弃未保存内容
              </Button>
              <Button onClick={state.requestClose}>关闭</Button>
              <Button type="primary" onClick={state.restoreDraft} {...testId(catalogTestIds.control.dirtyRestore)}>
                恢复编辑
              </Button>
            </Space>
          ) : state.restoreStatus === 'STALE_SERVER_VERSION' ? (
            <Space>
              <Button onClick={state.discardRestore} {...testId(catalogTestIds.control.dirtyDiscard)}>
                放弃旧草稿
              </Button>
              <Button type="primary" onClick={state.dismissRestore} {...testId(catalogTestIds.control.dirtyContinue)}>
                查看最新内容
              </Button>
            </Space>
          ) : (
            <Button type="primary" onClick={state.discardRestore} {...testId(catalogTestIds.control.dirtyDiscard)}>
              放弃并继续
            </Button>
          )
        }
        {...testId(catalogTestIds.static.itemDraftRestorePrompt)}
      >
        {state.restoreStatus === 'RECOVERABLE' ? (
          <p>
            上次停留在“
            {catalogEditorTabLabel(state.restoreCandidate?.sectionState?.activeSection ?? 'basic')}
            ”，恢复后可继续完成该区段。
          </p>
        ) : state.restoreStatus === 'STALE_SERVER_VERSION' ? (
          <p>
            商品资料已有更新，旧编辑内容已保留但不能直接覆盖当前资料。你可以查看最新内容，或放弃这份旧草稿后重新编辑。
          </p>
        ) : (
          <p>{state.restoreProblem}</p>
        )}
      </Modal>
      <CatalogDictionaryDrawer
        open={state.configurationTask.kind === 'CONFIG'}
        initialKind={state.configurationTask.kind === 'CONFIG' ? state.configurationTask.library : undefined}
        queryContext={props.queryContext}
        brandRef={props.brandRef}
        canWrite={props.canWriteCatalog}
        presentation="EDITOR_CHILD"
        onClose={state.closeConfiguration}
        onAfterClose={state.afterConfigurationClose}
      />
    </Drawer>
  );
}

export type {CatalogItemDrawerProps};
