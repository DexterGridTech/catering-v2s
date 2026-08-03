import {LockOutlined} from '@ant-design/icons';
import {LoginFormPage} from '@ant-design/pro-components';
import {Button, Result, Steps} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {operationsClient} from '../../../app/api/OperationsTransport';

type Branding = {workspaceName: string; operationsTitle: string; logoUrl?: string};
type EntryState = {kind: 'loading'} | {kind: 'ready'; branding: Branding} | {kind: 'unavailable'};

export function OperationsPasswordRecoveryCompletePage({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [entryState, setEntryState] = useState<EntryState>({kind: 'loading'});
  const [entryReload, setEntryReload] = useState(0);
  const generation = useAsyncGenerationGuard();
  const navigate = useNavigate();
  const locked = useOverlayLock();

  useEffect(() => {
    const request = generation.begin();
    setEntryState({kind: 'loading'});
    void operationsClient.getOperationsWorkspaceLoginEntry({groupWorkspaceKey}, {})
      .then((entry) => {
        if (!generation.isCurrent(request)) return;
        setEntryState(entry.status === 'ENABLED'
          ? {kind: 'ready', branding: {workspaceName: entry.workspaceName, operationsTitle: entry.operationsTitle, logoUrl: entry.logoUrl ?? undefined}}
          : {kind: 'unavailable'});
      })
      .catch(() => { if (generation.isCurrent(request)) setEntryState({kind: 'unavailable'}); });
  }, [entryReload, generation, groupWorkspaceKey]);

  if (entryState.kind === 'loading') return <LoginFormPage logo={<LockOutlined/>}><Steps current={2} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]}/></LoginFormPage>;
  if (entryState.kind === 'unavailable') return <Result status="error" title="暂时无法打开恢复入口，请稍后重试" extra={<Button onClick={() => setEntryReload((value) => value + 1)} {...testId('operations-recovery-retry-entry')}>重试</Button>}/>;
  const {branding} = entryState;
  return <LoginFormPage className="auth-login-page" logo={branding.logoUrl ? <img src={branding.logoUrl} alt=""/> : <LockOutlined/>} title={branding.workspaceName} subTitle={branding.operationsTitle}>
    <Steps current={2} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]}/>
    <Result status="success" title="密码已重设" subTitle={`请使用新密码登录${branding.operationsTitle}。`} extra={<Button type="primary" disabled={locked} onClick={() => void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`)} {...testId('operations-recovery-return-login')}>返回登录</Button>}/>
  </LoginFormPage>;
}
