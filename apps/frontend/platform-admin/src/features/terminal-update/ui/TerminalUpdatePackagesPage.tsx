import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {Alert, Button, Card, Descriptions, Drawer, Form, Select, Space, Upload, message} from 'antd';
import {InboxOutlined, ReloadOutlined} from '@ant-design/icons';
import {useEffect, useMemo, useState} from 'react';
import {createContentIdempotencyKey, digestFileContent, formatCanonicalDateTime, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformClient, platformProblemOf, platformRtk} from '../../../app/api/PlatformTransport';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {PLATFORM_ADMIN_OPERATION_IDS, type TerminalUpdateArtifactSummary, type TerminalUpdateStageResult} from '../../../app/api/generated/platform-edge';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import {terminalUpdateTestIds} from '../../../app/automation/terminalUpdateTestIds';
import {wireUuid} from '../../../app/api/wireUuid';

const pageTitle = adminCatalog.platformPages.find(page => page.pageDesignKey === platformPageDesignKeys.PlatformTerminalUpdatePackages)?.title;
if (!pageTitle) throw new Error('Missing terminal update package catalog page');

type Artifact = TerminalUpdateArtifactSummary;
type FormValues = {kind: 'FULL' | 'HOT'; minimumFullArtifactRef?: string};
type PendingStageRelease = {groupWorkspaceKey: string; stage: TerminalUpdateStageResult};
type PendingStage = PendingStageRelease & {file: File};

export function TerminalUpdatePackagesPage() {
  return <WorkspaceScope>{groupWorkspaceKey => <PackagesForWorkspace groupWorkspaceKey={groupWorkspaceKey} />}</WorkspaceScope>;
}

function PackagesForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [cursor, setCursor] = useState<string>();
  const [kind, setKind] = useState<'FULL' | 'HOT'>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Artifact>();
  const [pendingStage, setPendingStage] = useState<PendingStage>();
  const [pendingStageRelease, setPendingStageRelease] = useState<PendingStageRelease>();
  const [form] = Form.useForm<FormValues>();
  useOverlayLock(uploadOpen || Boolean(detail));
  const currentPendingStage = pendingStage?.groupWorkspaceKey === groupWorkspaceKey && pendingStage.file === file
    ? pendingStage
    : undefined;
  useEffect(() => {
    if (!pendingStage || pendingStage.groupWorkspaceKey === groupWorkspaceKey) return;
    setPendingStage(undefined);
    void platformClient.releasePlatformTerminalUpdateArtifactStage(
      {groupWorkspaceKey: pendingStage.groupWorkspaceKey, stageRef: pendingStage.stage.stageRef},
      {headers: {'X-Asset-Bind-Grant': pendingStage.stage.stageBindGrant}},
    ).catch(cause => {
      setPendingStageRelease({groupWorkspaceKey: pendingStage.groupWorkspaceKey, stage: pendingStage.stage});
      setProblem(`临时上传资源释放失败：${platformProblemOf(cause).detail || '请重试释放'}`);
    });
  }, [groupWorkspaceKey, pendingStage]);
  const request = useMemo(() => platformAdminRtkRequest.getPlatformTerminalUpdateArtifactPage(
    {groupWorkspaceKey}, {query: {kind, cursor, limit: 50}},
  ), [cursor, groupWorkspaceKey, kind]);
  const {data, error, isFetching, refetch} = platformRtk.useGetPlatformTerminalUpdateArtifactPageQuery(request);
  const fullRequest = useMemo(() => platformAdminRtkRequest.getPlatformTerminalUpdateArtifactPage(
    {groupWorkspaceKey}, {query: {kind: 'FULL', limit: 50}},
  ), [groupWorkspaceKey]);
  const {data: fullData} = platformRtk.useGetPlatformTerminalUpdateArtifactPageQuery(fullRequest);
  const columns: ProColumns<Artifact>[] = [
    {title: '类型', dataIndex: 'kind', width: 90, valueType: 'select', valueEnum: {FULL: 'FULL 完整更新', HOT: 'HOT 热更新'}, fieldProps: testId(terminalUpdateTestIds.artifactFilterKind)},
    {title: '应用', dataIndex: 'applicationId', search: false},
    {title: '原生版本', dataIndex: 'nativeBuildNumber', width: 110, search: false},
    {title: 'APK 版本', dataIndex: 'apkVersion', search: false, render: (_, row) => <a onClick={() => setDetail(row)}>{row.apkVersion}</a>},
    {title: 'JS 版本', dataIndex: 'jsVersion', search: false},
    {title: 'Runtime', dataIndex: 'runtimeVersion', search: false},
    {title: '创建时间', dataIndex: 'createdAtEpochMillis', search: false, render: (_, row) => formatCanonicalDateTime(row.createdAtEpochMillis)},
  ];
  const releaseStage = async (stage: PendingStage): Promise<void> => {
    try {
      await platformClient.releasePlatformTerminalUpdateArtifactStage({groupWorkspaceKey: stage.groupWorkspaceKey, stageRef: stage.stage.stageRef}, {
        headers: {'X-Asset-Bind-Grant': stage.stage.stageBindGrant},
      });
    } catch (cause) {
      setPendingStageRelease({groupWorkspaceKey: stage.groupWorkspaceKey, stage: stage.stage});
      setProblem(`临时上传资源释放失败：${platformProblemOf(cause).detail || '请重试释放'}`);
    }
  };
  const closeUpload = () => {
    if (pendingStage) void releaseStage(pendingStage);
    setPendingStage(undefined);
    setUploadOpen(false); setFile(undefined); setProblem(undefined); form.resetFields();
  };
  const parse = async () => {
    if (!file || saving) return;
    setSaving(true); setProblem(undefined);
    try {
      const sha256 = await digestFileContent(file);
      const stageKey = await createContentIdempotencyKey(PLATFORM_ADMIN_OPERATION_IDS.stagePlatformTerminalUpdateArtifact, {
        usage: 'TERMINAL_UPDATE_ARTIFACT', fileName: file.name, size: file.size, contentDigest: sha256,
      });
      const stage = await platformClient.stagePlatformTerminalUpdateArtifact({groupWorkspaceKey}, {
        body: {usage: 'TERMINAL_UPDATE_ARTIFACT', file, sha256}, headers: {'Idempotency-Key': stageKey},
      });
      setPendingStage({groupWorkspaceKey, stage, file});
    } catch (cause) {
      setProblem(platformProblemOf(cause).detail || '更新包解析失败');
    } finally { setSaving(false); }
  };
  const save = async (values: FormValues) => {
    const staged = pendingStage;
    if (!file || !staged || staged.file !== file || staged.groupWorkspaceKey !== groupWorkspaceKey || saving) return;
    setSaving(true); setProblem(undefined);
    try {
      const body = {stageRef: staged.stage.stageRef, stageBindGrant: staged.stage.stageBindGrant, kind: values.kind,
        ...(values.kind === 'HOT' && values.minimumFullArtifactRef ? {minimumFullArtifactRef: wireUuid(values.minimumFullArtifactRef)} : {})};
      const registerKey = await createContentIdempotencyKey(PLATFORM_ADMIN_OPERATION_IDS.registerPlatformTerminalUpdateArtifact, body);
      const saved = await platformClient.registerPlatformTerminalUpdateArtifact({groupWorkspaceKey}, {
        body, headers: {'Idempotency-Key': registerKey},
      });
      setPendingStage(undefined);
      setPendingStageRelease(undefined);
      setDetail(saved);
      setUploadOpen(false); setFile(undefined); setProblem(undefined); form.resetFields();
      void refetch();
      message.success('更新包已保存');
    } catch (cause) {
      setProblem(platformProblemOf(cause).detail || '更新包处理失败');
      setPendingStage(undefined);
      await releaseStage(staged);
    } finally { setSaving(false); }
  };
  const retryStageRelease = async () => {
    if (!pendingStageRelease) return;
    try {
      await platformClient.releasePlatformTerminalUpdateArtifactStage(
        {groupWorkspaceKey: pendingStageRelease.groupWorkspaceKey, stageRef: pendingStageRelease.stage.stageRef},
        {headers: {'X-Asset-Bind-Grant': pendingStageRelease.stage.stageBindGrant}},
      );
      setPendingStageRelease(undefined);
      message.success('临时上传资源已释放');
    } catch (cause) {
      setProblem(`临时上传资源释放失败：${platformProblemOf(cause).detail || '请重试释放'}`);
    }
  };
  return <Card title={pageTitle} {...testId(terminalUpdateTestIds.page)}>
    {pendingStageRelease && <Alert type="error" showIcon message="临时上传资源尚未释放" description={<Space><span>原集团空间中的上传资源仍待清理。</span><Button size="small" onClick={() => void retryStageRelease()} {...testId(terminalUpdateTestIds.releaseStagedUpload)}>重试释放</Button></Space>} />}
    <ProTable<Artifact> rowKey="artifactRef" search={{labelWidth: 'auto', optionRender: searchConfig => [
      <Button key="query" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('platform-terminal-update-filter-query')}>查询</Button>,
      <Button key="reset" onClick={() => {searchConfig.form?.resetFields(); setKind(undefined); setCursor(undefined);}} {...testId('platform-terminal-update-filter-reset')}>重置</Button>,
    ]}} onSubmit={values => {setKind(values.kind === 'FULL' || values.kind === 'HOT' ? values.kind : undefined); setCursor(undefined);}} options={false} loading={isFetching}
      dataSource={data?.items ?? []} columns={columns} pagination={false} toolBarRender={() => [
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => {setCursor(undefined); void refetch();}} {...testId(terminalUpdateTestIds.refresh)}>刷新</Button>,
        <Button key="upload" type="primary" onClick={() => setUploadOpen(true)} {...testId(terminalUpdateTestIds.upload)}>上传更新包</Button>,
      ]} {...testId(terminalUpdateTestIds.list)} />
    {data?.nextCursor && <Button onClick={() => setCursor(data.nextCursor!)}>加载更多</Button>}
    {error && <Alert type="error" showIcon message={platformProblemOf(error).detail || '读取更新包失败'} />}
    <Drawer title="上传终端更新包" open={uploadOpen} onClose={closeUpload} width={560} destroyOnClose>
      {problem && <Alert type="error" showIcon message={problem} />}
      <Form form={form} layout="vertical" initialValues={{kind: 'FULL'}} onFinish={save}>
        <Form.Item name="kind" label="更新包类型" rules={[{required: true}]}>
          <Select
            options={[{value: 'FULL', label: 'FULL 完整更新'}, {value: 'HOT', label: 'HOT 热更新'}]}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.artifactKindOption(option.value as 'FULL' | 'HOT'))}>
                {option.label}
              </span>
            )}
            {...testId(terminalUpdateTestIds.artifactKind)}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(before, after) => before.kind !== after.kind}>
          {({getFieldValue}) => getFieldValue('kind') === 'HOT' ? <Form.Item name="minimumFullArtifactRef" label="最低兼容 FULL 包" rules={[{required: true}]}>
            <Select showSearch optionFilterProp="label" options={(fullData?.items ?? []).map(item => ({value: item.artifactRef, label: `${item.applicationId} · ${item.apkVersion} · ${item.runtimeVersion}`}))} optionRender={option => <span {...testId(terminalUpdateTestIds.minimumFullCandidate(String(option.value)))}>{option.label}</span>} {...testId(terminalUpdateTestIds.minimumFull)} />
          </Form.Item> : null}
        </Form.Item>
      <Upload.Dragger accept=".zip" maxCount={1} beforeUpload={candidate => {
          if (pendingStage) { void releaseStage(pendingStage); setPendingStage(undefined); }
          setFile(candidate); setProblem(undefined); return false;
        }}
          onRemove={() => {if (pendingStage) void releaseStage(pendingStage); setPendingStage(undefined); setFile(undefined); return true;}} fileList={file ? [{uid: file.name, name: file.name, status: 'done'}] : []}
          {...testId(terminalUpdateTestIds.uploadInput)}>
          <p><InboxOutlined /></p><p>选择 FULL 或 HOT ZIP 文件</p>
        </Upload.Dragger>
        {currentPendingStage && <Alert type="success" showIcon message="解析校验成功" description={`${currentPendingStage.stage.fileName} · ${currentPendingStage.stage.byteSize} 字节 · SHA-256 ${currentPendingStage.stage.sha256}`} {...testId(terminalUpdateTestIds.parseSuccess)} />}
        <Space style={{marginTop: 20}}><Button onClick={closeUpload}>取消</Button>{currentPendingStage
          ? <Button type="primary" htmlType="submit" loading={saving} {...testId(terminalUpdateTestIds.save)}>保存</Button>
          : <Button type="primary" onClick={() => void parse()} loading={saving} disabled={!file} {...testId(terminalUpdateTestIds.save)}>解析</Button>}</Space>
      </Form>
    </Drawer>
    <Drawer title="更新包详情" open={Boolean(detail)} onClose={() => setDetail(undefined)} width={680} {...testId(terminalUpdateTestIds.detail)}>
      {detail && <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="类型">{detail.kind}</Descriptions.Item><Descriptions.Item label="应用">{detail.applicationId}</Descriptions.Item>
        <Descriptions.Item label="Runtime">{detail.runtimeVersion}</Descriptions.Item><Descriptions.Item label="原生构建">{detail.nativeBuildNumber}</Descriptions.Item>
        <Descriptions.Item label="APK 版本">{detail.apkVersion}</Descriptions.Item><Descriptions.Item label="JS 版本">{detail.jsVersion}</Descriptions.Item>
        <Descriptions.Item label="发布身份">{detail.publicationId}</Descriptions.Item><Descriptions.Item label="SHA-256">{detail.zipSha256}</Descriptions.Item>
        <Descriptions.Item label="大小">{detail.byteSize}</Descriptions.Item><Descriptions.Item label="创建时间">{formatCanonicalDateTime(detail.createdAtEpochMillis)}</Descriptions.Item>
      </Descriptions>}
    </Drawer>
  </Card>;
}
