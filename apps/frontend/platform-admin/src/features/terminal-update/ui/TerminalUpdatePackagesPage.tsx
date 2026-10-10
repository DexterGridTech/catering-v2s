import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {Alert, Button, Card, Descriptions, Drawer, Form, Select, Space, Spin, Upload, message} from 'antd';
import {InboxOutlined, ReloadOutlined} from '@ant-design/icons';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  CursorPagination,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  createContentIdempotencyKey,
  digestFileContent,
  formatCanonicalDateTime,
  testId,
  useCursorStack,
  useDrawerFormLifecycle,
  useOverlayLock,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {
  platformClient,
  platformContentTabRefreshSignal,
  platformProblemOf,
  platformRtk,
} from '../../../app/api/PlatformTransport';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {
  PLATFORM_ADMIN_OPERATION_IDS,
  type TerminalUpdateArtifactDetail,
  type TerminalUpdateArtifactSummary,
  type TerminalUpdateStageResult,
} from '../../../app/api/generated/platform-edge';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import {terminalUpdateTestIds} from '../../../app/automation/terminalUpdateTestIds';
import {wireUuid} from '../../../app/api/wireUuid';
import {platformMinimumFullCandidateQuery} from './terminalUpdateArtifactQueries';

const pageTitle = adminCatalog.platformPages.find(
  page => page.pageDesignKey === platformPageDesignKeys.PlatformTerminalUpdatePackages,
)?.title;
if (!pageTitle) throw new Error('Missing terminal update package catalog page');

type Artifact = TerminalUpdateArtifactSummary;
type ArtifactFilters = {kind?: 'FULL' | 'HOT'; appId?: string; runtimeVersion?: string; queryText?: string};
type FormValues = {kind: 'FULL' | 'HOT'; minimumFullArtifactRef?: string};
type PendingStageRelease = {groupWorkspaceKey: string; stage: TerminalUpdateStageResult};
type PendingStage = PendingStageRelease & {file: File};

const matchesMinimumFull = (
  artifact: Artifact,
  minimum: NonNullable<TerminalUpdateStageResult['minimumFull']>,
): boolean => artifact.kind === 'FULL' && artifact.applicationId === minimum.applicationId &&
  artifact.nativeBuildNumber === minimum.nativeBuildNumber && artifact.runtimeVersion === minimum.runtimeVersion &&
  artifact.publicationId === minimum.publicationId && artifact.apkSha256 === minimum.apkSha256;

export function TerminalUpdatePackagesPage() {
  return (
    <WorkspaceScope>
      {groupWorkspaceKey => <PackagesForWorkspace groupWorkspaceKey={groupWorkspaceKey} />}
    </WorkspaceScope>
  );
}

function PackagesForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [filters, setFilters] = useState<ArtifactFilters>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [problem, setProblem] = useState<string>();
  const uploadOperationInFlight = useRef(false);
  const [detailRef, setDetailRef] = useState<string>();
  const [detail, setDetail] = useState<TerminalUpdateArtifactDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProblem, setDetailProblem] = useState<string>();
  const [pendingStage, setPendingStage] = useState<PendingStage>();
  const [pendingStageRelease, setPendingStageRelease] = useState<PendingStageRelease>();
  const [form] = Form.useForm<FormValues>();
  const pager = useCursorStack({resetKey: `${groupWorkspaceKey}:${JSON.stringify(filters)}`});
  const contentTabRefreshVersion = useRefreshVersion(platformContentTabRefreshSignal);
  const uploadLifecycle = useDrawerFormLifecycle({
    open: uploadOpen,
    onOpenChange: next => setUploadOpen(next),
    dirtyMessage: '已选择的更新包和未保存资料不会保留。',
  });
  const saving = uploadLifecycle.submitting;
  useOverlayLock(Boolean(detailRef));
  useEffect(() => {
    if (uploadOpen) {
      form.resetFields();
      setFile(undefined);
      setProblem(undefined);
      uploadLifecycle.resetPreservingOpen();
    }
  }, [form, uploadLifecycle, uploadOpen]);
  const currentPendingStage =
    pendingStage?.groupWorkspaceKey === groupWorkspaceKey && pendingStage.file === file ? pendingStage : undefined;
  useEffect(() => {
    if (!pendingStage || pendingStage.groupWorkspaceKey === groupWorkspaceKey) return;
    setPendingStage(undefined);
    void platformClient
      .releasePlatformTerminalUpdateArtifactStage(
        {groupWorkspaceKey: pendingStage.groupWorkspaceKey, stageRef: pendingStage.stage.stageRef},
        {headers: {'X-Asset-Bind-Grant': pendingStage.stage.stageBindGrant}},
      )
      .catch(cause => {
        setPendingStageRelease({groupWorkspaceKey: pendingStage.groupWorkspaceKey, stage: pendingStage.stage});
        setProblem(`临时上传资源释放失败：${platformProblemOf(cause).detail || '请重试释放'}`);
      });
  }, [groupWorkspaceKey, pendingStage]);
  const request = useMemo(
    () =>
      platformAdminRtkRequest.getPlatformTerminalUpdateArtifactPage(
        {groupWorkspaceKey},
        {query: {...filters, cursor: pager.cursor || undefined, limit: 50}},
      ),
    [filters, groupWorkspaceKey, pager.cursor],
  );
  const {currentData: data, error, isFetching, refetch} = platformRtk.useGetPlatformTerminalUpdateArtifactPageQuery(request);
  useEffect(() => {
    if (!detailRef) {
      setDetail(undefined);
      setDetailProblem(undefined);
      return;
    }
    let current = true;
    setDetail(undefined);
    setDetailProblem(undefined);
    setDetailLoading(true);
    void platformClient.getPlatformTerminalUpdateArtifactDetail(
      {groupWorkspaceKey, artifactRef: wireUuid(detailRef)},
      {},
    ).then(value => {
      if (current) setDetail(value);
    }).catch(cause => {
      if (current) setDetailProblem(platformProblemOf(cause).detail || '读取更新包详情失败');
    }).finally(() => {
      if (current) setDetailLoading(false);
    });
    return () => {
      current = false;
    };
  }, [contentTabRefreshVersion, detailRef, groupWorkspaceKey]);
  const openArtifactDetail = (artifactRef: string) => {
    setDetail(undefined);
    setDetailProblem(undefined);
    setDetailRef(artifactRef);
  };
  const minimumFull = currentPendingStage?.stage.candidateKind === 'HOT'
    ? currentPendingStage.stage.minimumFull ?? undefined
    : undefined;
  const fullRequest = useMemo(
    () =>
      platformAdminRtkRequest.getPlatformTerminalUpdateArtifactPage(
        {groupWorkspaceKey},
        {query: platformMinimumFullCandidateQuery(minimumFull)},
      ),
    [groupWorkspaceKey, minimumFull],
  );
  const {currentData: fullData, isFetching: fullFetching} = platformRtk.useGetPlatformTerminalUpdateArtifactPageQuery(fullRequest);
  const fullCandidates = minimumFull === undefined
    ? []
    : (fullData?.items ?? []).filter(item => matchesMinimumFull(item, minimumFull));
  const columns: ProColumns<Artifact>[] = [
    {
      title: '类型',
      dataIndex: 'kind',
      width: 90,
      valueType: 'select',
      valueEnum: {FULL: 'FULL 完整更新', HOT: 'HOT 热更新'},
      fieldProps: testId(terminalUpdateTestIds.artifactFilterKind),
    },
    {title: '应用包名', dataIndex: 'appId', hideInTable: true,
      fieldProps: testId(terminalUpdateTestIds.artifactFilterApplication)},
    {title: 'Runtime', dataIndex: 'runtimeVersion', hideInTable: true,
      fieldProps: testId(terminalUpdateTestIds.artifactFilterRuntime)},
    {title: '关键词', dataIndex: 'queryText', hideInTable: true,
      fieldProps: testId(terminalUpdateTestIds.artifactFilterQuery)},
    {
      title: '更新包',
      dataIndex: 'applicationId',
      search: false,
      render: (_, row) => (
        <Button type="link" onClick={() => openArtifactDetail(row.artifactRef)} {...testId(terminalUpdateTestIds.artifactOpen(row.artifactRef))}>
          {row.applicationId} · {artifactKindLabel(row.kind)} · {artifactDisplayVersion(row)}
        </Button>
      ),
    },
    {title: '应用', dataIndex: 'applicationId', search: false},
    {title: '原生版本', dataIndex: 'nativeBuildNumber', width: 110, search: false},
    {
      title: 'APK 版本',
      dataIndex: 'apkVersion',
      search: false,
      render: (_, row) => row.apkVersion,
    },
    {title: 'JS 版本', dataIndex: 'jsVersion', search: false},
    {title: 'Runtime', dataIndex: 'runtimeVersion', search: false},
    {
      title: '创建时间',
      dataIndex: 'createdAtEpochMillis',
      search: false,
      render: (_, row) => formatCanonicalDateTime(row.createdAtEpochMillis),
    },
  ];
  const releaseStage = async (stage: PendingStage): Promise<void> => {
    try {
      await platformClient.releasePlatformTerminalUpdateArtifactStage(
        {groupWorkspaceKey: stage.groupWorkspaceKey, stageRef: stage.stage.stageRef},
        {
          headers: {'X-Asset-Bind-Grant': stage.stage.stageBindGrant},
        },
      );
    } catch (cause) {
      setPendingStageRelease({groupWorkspaceKey: stage.groupWorkspaceKey, stage: stage.stage});
      setProblem(`临时上传资源释放失败：${platformProblemOf(cause).detail || '请重试释放'}`);
    }
  };
  const finishUploadClose = (visible: boolean) => {
    uploadLifecycle.afterOpenChange(visible);
    if (visible) return;
    const staged = pendingStage;
    if (staged) {
      setPendingStage(undefined);
      void releaseStage(staged);
    }
    setFile(undefined);
    setProblem(undefined);
    form.resetFields();
    uploadLifecycle.reset();
  };
  const parse = async (selectedFile: File, stageWorkspace = groupWorkspaceKey) => {
    if (uploadOperationInFlight.current) return;
    uploadOperationInFlight.current = true;
    uploadLifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const sha256 = await digestFileContent(selectedFile);
      const stageKey = await createContentIdempotencyKey(
        PLATFORM_ADMIN_OPERATION_IDS.stagePlatformTerminalUpdateArtifact,
        {
          usage: 'TERMINAL_UPDATE_ARTIFACT',
          fileName: selectedFile.name,
          size: selectedFile.size,
          contentDigest: sha256,
        },
      );
      const stage = await platformClient.stagePlatformTerminalUpdateArtifact(
        {groupWorkspaceKey: stageWorkspace},
        {
          body: {usage: 'TERMINAL_UPDATE_ARTIFACT', file: selectedFile, sha256},
          headers: {'Idempotency-Key': stageKey},
        },
      );
      setPendingStage({groupWorkspaceKey: stageWorkspace, stage, file: selectedFile});
    } catch (cause) {
      setProblem(platformProblemOf(cause).detail || '更新包解析失败');
    } finally {
      uploadOperationInFlight.current = false;
      uploadLifecycle.setSubmitting(false);
    }
  };
  const save = async (values: FormValues) => {
    const staged = pendingStage;
    if (!file || !staged || staged.file !== file || staged.groupWorkspaceKey !== groupWorkspaceKey
      || uploadOperationInFlight.current) return;
    if (values.kind !== staged.stage.candidateKind) {
      setProblem(`上传文件解析为 ${staged.stage.candidateKind}，请按解析结果选择更新包类型。`);
      return;
    }
    if (values.kind === 'HOT' && (staged.stage.minimumFull === null || staged.stage.minimumFull === undefined ||
      !fullCandidates.some(item => item.artifactRef === values.minimumFullArtifactRef))) {
      setProblem('当前选择的 FULL 包与 HOT 声明的最低兼容版本不匹配，请选择匹配的 FULL 包。');
      return;
    }
    uploadOperationInFlight.current = true;
    uploadLifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const body = {
        stageRef: staged.stage.stageRef,
        stageBindGrant: staged.stage.stageBindGrant,
        kind: values.kind,
        ...(values.kind === 'HOT' && values.minimumFullArtifactRef
          ? {minimumFullArtifactRef: wireUuid(values.minimumFullArtifactRef)}
          : {}),
      };
      const registerKey = await createContentIdempotencyKey(
        PLATFORM_ADMIN_OPERATION_IDS.registerPlatformTerminalUpdateArtifact,
        body,
      );
      const saved = await platformClient.registerPlatformTerminalUpdateArtifact(
        {groupWorkspaceKey},
        {
          body,
          headers: {'Idempotency-Key': registerKey},
        },
      );
      setPendingStage(undefined);
      setPendingStageRelease(undefined);
      openArtifactDetail(saved.artifactRef);
      setFile(undefined);
      setProblem(undefined);
      form.resetFields();
      uploadLifecycle.setDirty(false);
      uploadLifecycle.closeAfterSuccess();
      void refetch();
      message.success('更新包已保存');
    } catch (cause) {
      setProblem(platformProblemOf(cause).detail || '更新包处理失败');
      setPendingStage(undefined);
      await releaseStage(staged);
    } finally {
      uploadOperationInFlight.current = false;
      uploadLifecycle.setSubmitting(false);
    }
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
  return (
    <Card title={pageTitle} {...testId(terminalUpdateTestIds.page)}>
      {pendingStageRelease && (
        <Alert
          type="error"
          showIcon
          message="临时上传资源尚未释放"
          description={
            <Space>
              <span>原集团空间中的上传资源仍待清理。</span>
              <Button
                size="small"
                onClick={() => void retryStageRelease()}
                {...testId(terminalUpdateTestIds.releaseStagedUpload)}
              >
                重试释放
              </Button>
            </Space>
          }
        />
      )}
      <ProTable<Artifact>
        rowKey="artifactRef"
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="query"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId(terminalUpdateTestIds.artifactFilterSubmit)}
            >
              查询
            </Button>,
            <Button
              key="reset"
              onClick={() => {
                searchConfig.form?.resetFields();
                setFilters({});
                pager.reset();
              }}
              {...testId(terminalUpdateTestIds.artifactFilterReset)}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={values => {
          const appId = typeof values.appId === 'string' ? values.appId.trim() : '';
          const runtimeVersion = typeof values.runtimeVersion === 'string' ? values.runtimeVersion.trim() : '';
          const queryText = typeof values.queryText === 'string' ? values.queryText.trim() : '';
          setFilters({
            ...(values.kind === 'FULL' || values.kind === 'HOT' ? {kind: values.kind} : {}),
            ...(appId ? {appId} : {}),
            ...(runtimeVersion ? {runtimeVersion} : {}),
            ...(queryText ? {queryText} : {}),
          });
          pager.reset();
        }}
        onReset={() => {
          setFilters({});
          pager.reset();
        }}
        options={false}
        loading={isFetching}
        dataSource={data?.items ?? []}
        columns={columns}
        pagination={false}
        toolBarRender={() => [
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => void refetch()}
            {...testId(terminalUpdateTestIds.refresh)}
          >
            刷新
          </Button>,
          <Button
            key="upload"
            type="primary"
            onClick={() => setUploadOpen(true)}
            {...testId(terminalUpdateTestIds.upload)}
          >
            上传更新包
          </Button>,
        ]}
        {...testId(terminalUpdateTestIds.list)}
      />
      <CursorPagination
        state={pager}
        nextCursor={data?.nextCursor ?? undefined}
        testIdPrefix={terminalUpdateTestIds.list + '-pagination'}
      />
      {error && <Alert type="error" showIcon message={platformProblemOf(error).detail || '读取更新包失败'} />}
      <Drawer
        title="上传终端更新包"
        open={uploadOpen}
        onClose={uploadLifecycle.requestClose}
        afterOpenChange={finishUploadClose}
        maskClosable={!saving}
        keyboard={!saving}
        width={720}
        destroyOnHidden
        {...adminDrawerSurfaceProps}
        footer={(
          <Space>
            <Button onClick={uploadLifecycle.requestClose} disabled={saving}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              form="terminal-update-artifact-upload-form"
              loading={saving}
              disabled={!currentPendingStage || saving}
              {...testId(terminalUpdateTestIds.save)}
            >
              保存
            </Button>
          </Space>
        )}
      >
        {problem && <Alert type="error" showIcon message={problem} />}
        <Form
          id="terminal-update-artifact-upload-form"
          form={form}
          layout="vertical"
          initialValues={{kind: 'FULL'}}
          onFinish={save}
          onValuesChange={() => uploadLifecycle.setDirty(true)}
          disabled={saving}
        >
          <Form.Item name="kind" label="更新包类型" rules={[{required: true}]}>
            <Select
              options={[
                {value: 'FULL', label: 'FULL 完整更新'},
                {value: 'HOT', label: 'HOT 热更新'},
              ]}
              optionRender={option => (
                <span {...testId(terminalUpdateTestIds.artifactKindOption(option.value as 'FULL' | 'HOT'))}>
                  {option.label}
                </span>
              )}
              {...testId(terminalUpdateTestIds.artifactKind)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(before, after) => before.kind !== after.kind}>
            {({getFieldValue}) =>
              getFieldValue('kind') === 'HOT' ? (
                <Form.Item name="minimumFullArtifactRef" label="最低兼容 FULL 包" rules={[{required: true}]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    loading={fullFetching}
                    notFoundContent={minimumFull === undefined
                      ? '先解析 HOT 包以读取兼容声明'
                      : '没有找到与此 HOT 声明完全匹配的 FULL 包'}
                    options={fullCandidates.map(item => ({
                      value: item.artifactRef,
                      label: `${item.applicationId} · build ${item.nativeBuildNumber} · ${item.runtimeVersion} · ` +
                        `${item.publicationId} · APK SHA-256 ${item.apkSha256}`,
                    }))}
                    optionRender={option => (
                      <span {...testId(terminalUpdateTestIds.minimumFullCandidate(String(option.value)))}>
                        {option.label}
                      </span>
                    )}
                    {...testId(terminalUpdateTestIds.minimumFull)}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Upload.Dragger
            accept=".zip"
            maxCount={1}
            disabled={saving}
            beforeUpload={candidate => {
              if (uploadOperationInFlight.current) return false;
              uploadLifecycle.setDirty(true);
              if (pendingStage) {
                void releaseStage(pendingStage);
                setPendingStage(undefined);
              }
              setFile(candidate);
              setProblem(undefined);
              void parse(candidate, groupWorkspaceKey);
              return false;
            }}
            onRemove={() => {
              if (uploadOperationInFlight.current) return false;
              if (pendingStage) void releaseStage(pendingStage);
              setPendingStage(undefined);
              setFile(undefined);
              uploadLifecycle.setDirty(true);
              return true;
            }}
            fileList={file ? [{uid: file.name, name: file.name, status: 'done'}] : []}
            {...testId(terminalUpdateTestIds.uploadInput)}
          >
            <p>
              <InboxOutlined />
            </p>
            <p>选择 FULL 或 HOT ZIP 文件</p>
          </Upload.Dragger>
          {currentPendingStage && (
            <Alert
              type="success"
              showIcon
              message="解析校验成功"
              description={
                <>
                  <div>
                    {currentPendingStage.stage.fileName} · {currentPendingStage.stage.byteSize} 字节 · ZIP SHA-256{' '}
                    {currentPendingStage.stage.sha256}
                  </div>
                  <Descriptions column={1} size="small" style={{marginTop: 8}}>
                    <Descriptions.Item label="解析类型">
                      {artifactKindLabel(currentPendingStage.stage.candidateKind)}
                    </Descriptions.Item>
                    <Descriptions.Item label="应用包名">{currentPendingStage.stage.applicationId}</Descriptions.Item>
                    <Descriptions.Item label="平台">{currentPendingStage.stage.platform}</Descriptions.Item>
                    <Descriptions.Item label="原生版本">
                      {currentPendingStage.stage.nativeVersion} · build {currentPendingStage.stage.nativeBuildNumber}
                    </Descriptions.Item>
                    <Descriptions.Item label="JS 版本">{currentPendingStage.stage.bundleVersion}</Descriptions.Item>
                    <Descriptions.Item label="Runtime">{currentPendingStage.stage.runtimeVersion}</Descriptions.Item>
                    <Descriptions.Item label="发布身份">{currentPendingStage.stage.publicationId}</Descriptions.Item>
                    {currentPendingStage.stage.candidateKind === 'FULL' && (
                      <Descriptions.Item label="APK SHA-256">{currentPendingStage.stage.apkSha256}</Descriptions.Item>
                    )}
                    {currentPendingStage.stage.minimumFull && (
                      <Descriptions.Item label="要求的最低 FULL">
                        {currentPendingStage.stage.minimumFull.applicationId} · build{' '}
                        {currentPendingStage.stage.minimumFull.nativeBuildNumber} ·{' '}
                        {currentPendingStage.stage.minimumFull.runtimeVersion} ·{' '}
                        {currentPendingStage.stage.minimumFull.publicationId} · APK SHA-256{' '}
                        {currentPendingStage.stage.minimumFull.apkSha256}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </>
              }
              {...testId(terminalUpdateTestIds.parseSuccess)}
            />
          )}
        </Form>
      </Drawer>
      <Drawer
        title={
          detail
            ? `${detail.applicationId} · ${artifactKindLabel(detail.kind)} · ${artifactDisplayVersion(detail)} · 更新包详情`
            : '更新包详情'
        }
        open={Boolean(detailRef)}
        onClose={() => setDetailRef(undefined)}
        width={720}
        {...adminDrawerSurfaceProps}
        {...testId(terminalUpdateTestIds.detail)}
      >
        {detailLoading && <Spin />}
        {detailProblem && <Alert type="error" showIcon message={detailProblem} />}
        {detail && (
          <Descriptions {...adminDetailDescriptionsProps}>
            <Descriptions.Item label="类型">{artifactKindLabel(detail.kind)}</Descriptions.Item>
            <Descriptions.Item label="应用">{detail.applicationId}</Descriptions.Item>
            <Descriptions.Item label="Runtime">{detail.runtimeVersion}</Descriptions.Item>
            <Descriptions.Item label="原生构建">{detail.nativeBuildNumber}</Descriptions.Item>
            <Descriptions.Item label="APK 版本">{detail.apkVersion}</Descriptions.Item>
            <Descriptions.Item label="JS 版本">{detail.jsVersion}</Descriptions.Item>
            <Descriptions.Item label="发布身份">{detail.publicationId}</Descriptions.Item>
            <Descriptions.Item label="ZIP SHA-256">{detail.zipSha256}</Descriptions.Item>
            {detail.apkSha256 && <Descriptions.Item label="APK SHA-256">{detail.apkSha256}</Descriptions.Item>}
            {detail.kind === 'HOT' && (
              <>
                <Descriptions.Item label="最低兼容 FULL 包">{detail.minimumFullArtifactRef ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="最低兼容 FULL 身份">
                  {detail.minimumFullFacts
                    ? `${detail.minimumFullFacts.applicationId ?? '—'} · build ${detail.minimumFullFacts.nativeBuildNumber ?? '—'} · ` +
                      `${detail.minimumFullFacts.runtimeVersion ?? '—'} · ${detail.minimumFullFacts.publicationId ?? '—'} · ` +
                      `APK SHA-256 ${detail.minimumFullFacts.apkSha256 ?? '—'}`
                    : '—'}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="大小">{detail.byteSize}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatCanonicalDateTime(detail.createdAtEpochMillis)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </Card>
  );
}

function artifactKindLabel(kind: Artifact['kind']): string {
  return kind === 'FULL' ? '完整更新' : '热更新';
}

function artifactDisplayVersion(artifact: Artifact): string {
  return artifact.kind === 'HOT' ? artifact.jsVersion : artifact.apkVersion;
}
