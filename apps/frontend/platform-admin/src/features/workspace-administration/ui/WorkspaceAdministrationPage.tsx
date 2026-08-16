import {Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography} from 'antd';
import {contextScopedQueryArgs, testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';

const workspaceOverviewPage = adminCatalog.platformPages.find(
  page => page.pageDesignKey === platformPageDesignKeys.PlatformWorkspaceOverview,
);
if (!workspaceOverviewPage) throw new Error('Missing generated workspace overview page');
const workspaceOverviewPageTitle = workspaceOverviewPage.title;
const unavailableSource = (status?: 'AVAILABLE' | 'UNAVAILABLE') => status === 'UNAVAILABLE';
const sourceUnavailable = (onRetry: () => void, testIdValue: string) => (
  <Alert
    type="warning"
    showIcon
    title="资料暂时无法获取"
    description={
      <Button type="link" onClick={onRetry} {...testId(testIdValue)}>
        重试
      </Button>
    }
  />
);

/**
 * IA02 read-only selected-workspace overview.
 * Management actions intentionally live on the separate management page.
 */
export function WorkspaceAdministrationPage() {
  return (
    <WorkspaceScope>
      {groupWorkspaceKey => <WorkspaceOverviewForSelection groupWorkspaceKey={groupWorkspaceKey} />}
    </WorkspaceScope>
  );
}

function WorkspaceOverviewForSelection({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const context = useMemo(() => contextScopedQueryArgs({}, {groupWorkspaceKey}), [groupWorkspaceKey]);
  const request = useMemo(
    () => platformAdminRtkRequest.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: context.groupWorkspaceKey}, {}),
    [context],
  );
  const {data, error, isLoading, refetch} = platformRtk.useGetPlatformGroupWorkspaceDetailQuery(request);
  const problem = error ? platformProblemOf(error) : undefined;
  const pageDescription = (
    <Typography.Paragraph aria-label={workspaceOverviewPageTitle} type="secondary" style={{margin: 0}}>
      阅读当前已选择集团空间的业务概况。此页不提供创建、编辑、启停或更换集团空间的入口。
    </Typography.Paragraph>
  );
  if (isLoading && !data)
    return (
      <Card title={workspaceOverviewPageTitle}>
        {pageDescription}
        <Spin />
      </Card>
    );
  if (problem)
    return (
      <Card
        title={workspaceOverviewPageTitle}
        extra={
          <Button onClick={() => void refetch()} {...testId('workspace-overview-retry')}>
            重试
          </Button>
        }
      >
        {pageDescription}
        <Alert type="error" showIcon title="资料暂时无法获取" description={problem.detail} />
      </Card>
    );
  if (!data)
    return (
      <Card title={workspaceOverviewPageTitle}>
        {pageDescription}
        <Alert type="info" title="暂无可读取的集团空间资料" />
      </Card>
    );
  return (
    <Card title={workspaceOverviewPageTitle}>
      {pageDescription}
      <Space orientation="vertical" size="large" style={{width: '100%'}}>
        <section>
          <Typography.Title level={5}>空间概览</Typography.Title>
          {unavailableSource(data.workspaceSourceStatus) ? (
            sourceUnavailable(() => void refetch(), 'workspace-overview-workspace-retry')
          ) : (
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {key: 'name', label: '集团空间名称', children: data.name},
                {key: 'key', label: '集团空间编码', children: data.groupWorkspaceKey},
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag color={data.status === 'ENABLED' ? 'success' : 'default'}>
                      {data.status === 'ENABLED' ? '已启用' : '已停用'}
                    </Tag>
                  ),
                },
                {key: 'updated', label: '最近更新', children: new Date(data.updatedAt).toLocaleString('zh-CN')},
              ]}
            />
          )}
        </section>
        <section>
          <Typography.Title level={5}>初始化情况</Typography.Title>
          {unavailableSource(data.initializationSourceStatus) ? (
            sourceUnavailable(() => void refetch(), 'workspace-overview-initialization-retry')
          ) : (
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'initialization',
                  label: '初始化状态',
                  children: data.commercialGroup?.initialized ? '已初始化' : '尚未初始化',
                },
                {key: 'groupName', label: '集团名称', children: data.commercialGroup?.root?.groupName ?? '—'},
              ]}
            />
          )}
        </section>
        <section>
          <Typography.Title level={5}>账号访问</Typography.Title>
          {unavailableSource(data.accountAccessSourceStatus) ? (
            sourceUnavailable(() => void refetch(), 'workspace-overview-account-access-retry')
          ) : (
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {key: 'accounts', label: '账号数量', children: data.accountCount ?? '暂时无法获取'},
                {key: 'roles', label: '角色数量', children: data.roleCount ?? '暂时无法获取'},
              ]}
            />
          )}
        </section>
      </Space>
    </Card>
  );
}
