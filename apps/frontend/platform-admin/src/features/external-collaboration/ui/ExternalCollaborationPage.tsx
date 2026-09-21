import {ApartmentOutlined, ReloadOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Empty, Input, Spin, Tree} from 'antd';
import type {DataNode} from 'antd/es/tree';
import {LifecycleStatusTag, NameCodeText, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import type {ExternalCollaborationTree} from '../../../app/api/generated/platform-edge';
import {platformProblemOf, platformRtk} from '../../../app/api/PlatformTransport';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {ExternalSystemDetail} from './ExternalSystemDetail';
import {ProviderProfileDetail} from './ProviderProfileDetail';

type SelectedNode = {kind: 'system'; code: string} | {kind: 'provider'; code: string} | undefined;

function treeData(value: ExternalCollaborationTree | undefined, query: string): DataNode[] {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  const matches = (name: string, code: string) =>
    !normalized ||
    name.toLocaleLowerCase('zh-CN').includes(normalized) ||
    code.toLocaleLowerCase('zh-CN').includes(normalized);
  return (value?.externalSystems ?? []).flatMap(system => {
    const providers = (value?.providerProfiles ?? [])
      .filter(provider => provider.externalSystemCode === system.externalSystemCode)
      .filter(provider => matches(provider.displayName, provider.providerCode))
      .map(provider => ({
        key: `provider:${provider.providerCode}`,
        title: (
          <span>
            <NameCodeText name={provider.displayName} code={provider.providerCode} />{' '}
            <LifecycleStatusTag status={provider.enablementStatus} />
          </span>
        ),
      }));
    if (!matches(system.displayName, system.externalSystemCode) && providers.length === 0) return [];
    return [
      {
        key: `system:${system.externalSystemCode}`,
        title: (
          <span>
            <NameCodeText name={system.displayName} code={system.externalSystemCode} />{' '}
            <LifecycleStatusTag status={system.enablementStatus} />
          </span>
        ),
        children: providers,
      },
    ];
  });
}

function ExternalCollaborationForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedNode>();
  const locked = useOverlayLock();
  const request = useMemo(
    () => platformAdminRtkRequest.getPlatformExternalCollaborationTree({groupWorkspaceKey}, {}),
    [groupWorkspaceKey],
  );
  const query = platformRtk.useGetPlatformExternalCollaborationTreeQuery(request);
  const nodes = useMemo(() => treeData(query.currentData, search), [query.currentData, search]);
  const retry = () => void query.refetch();
  return (
    <div className="platform-master-detail-page" {...testId('platform-external-collaboration-page')}>
      {query.error ? (
        <Alert
          type="error"
          showIcon
          title="外部系统接入配置读取失败"
          description={platformProblemOf(query.error).detail}
          action={
            <Button icon={<ReloadOutlined />} onClick={retry}>
              重试
            </Button>
          }
          {...testId('platform-external-collaboration-error')}
        />
      ) : query.isFetching && !query.currentData ? (
        <Spin {...testId('platform-external-collaboration-loading')} />
      ) : (
        <div className="platform-master-detail-layout">
          <Card
            className="platform-master-detail-panel platform-master-detail-tree-panel"
            classNames={{body: 'platform-master-detail-tree-panel-body'}}
            size="small"
            title="外部系统"
          >
            <Input.Search
              allowClear
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="搜索外部系统或接入档案"
              {...testId('platform-external-collaboration-filter')}
            />
            <div className="platform-master-detail-tree-scroll">
              {nodes.length ? (
                <Tree
                  showLine
                  treeData={nodes}
                  selectedKeys={selected ? [`${selected.kind}:${selected.code}`] : []}
                  onSelect={keys => {
                    const value = String(keys[0] ?? '');
                    const [kind, code] = value.split(':');
                    if ((kind === 'system' || kind === 'provider') && code) setSelected({kind, code});
                  }}
                  {...testId('platform-external-collaboration-tree')}
                />
              ) : (
                <Empty description="暂无外部系统" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
          <div className="platform-master-detail-detail-host">
            {!selected && (
              <Card
                className="platform-master-detail-panel platform-master-detail-detail-panel platform-master-detail-detail-content"
                classNames={{body: 'platform-master-detail-detail-panel-body'}}
                size="small"
                title="外部系统详情"
              >
                <Empty
                  image={<ApartmentOutlined style={{fontSize: 42}} />}
                  description="请选择一个外部系统或接入档案"
                  {...testId('platform-external-collaboration-empty')}
                />
              </Card>
            )}
            {selected?.kind === 'system' && (
              <ExternalSystemDetail groupWorkspaceKey={groupWorkspaceKey} externalSystemCode={selected.code} />
            )}
            {selected?.kind === 'provider' && (
              <ProviderProfileDetail groupWorkspaceKey={groupWorkspaceKey} providerCode={selected.code} />
            )}
          </div>
        </div>
      )}
      <span hidden>{String(locked)}</span>
    </div>
  );
}

export function ExternalCollaborationPage() {
  return (
    <WorkspaceScope>
      {groupWorkspaceKey => <ExternalCollaborationForWorkspace groupWorkspaceKey={groupWorkspaceKey} />}
    </WorkspaceScope>
  );
}
