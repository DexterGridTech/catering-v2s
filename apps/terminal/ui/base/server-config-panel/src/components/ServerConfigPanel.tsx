import {useEffect, useMemo, useState} from 'react';
import type {CommandDefinition, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  clearServerOverrideCommand,
  restoreServerDefaultsCommand,
  selectServerConfigSpaceCommand,
  selectServerConfiguration,
  setServerOverrideCommand,
  type ServerConfigAddressInput,
  type ServerConfigProxyInput,
} from '@catering-v2s/kernel-base-server-config';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {InputScrollArea} from '@catering-v2s/ui-base-input';
import {useTrackedCommand, useUiStateSelector} from '@catering-v2s/ui-base-render';
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveSelect,
  PrimitiveStatus,
  PrimitiveSwitch,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {AdminSectionProps} from '@catering-v2s/ui-base-admin-shell';
import {ConfigField} from './ConfigField';
import {serverConfigPanelTestIds as testIds} from './serverConfigPanelTestIds';

type AddressDraft = Readonly<{addressName: string; baseUrl: string; timeoutMs: string}>;
type ConfigDraft = Readonly<{
  addresses: readonly AddressDraft[];
  proxyEnabled: boolean;
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
}>;

const emptyDraft: ConfigDraft = Object.freeze({
  addresses: Object.freeze([{addressName: 'primary', baseUrl: '', timeoutMs: '10000'}]),
  proxyEnabled: false,
  proxyHost: '',
  proxyPort: '8080',
  proxyUsername: '',
  proxyPassword: '',
});
const noAddresses: readonly Readonly<{addressName: string; baseUrl: string; timeoutMs?: number}>[] = Object.freeze([]);

const feedbackFrom = (result: CommandDispatchResult | undefined): string => {
  if (result === undefined) return '操作未完成，请重试。';
  if (result.status !== 'completed') return '配置未通过校验，草稿已保留。';
  const actor = result.actorResults.find(entry => entry.status === 'completed');
  const value = actor?.result;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '配置已生效。';
  const persistence = (value as Readonly<Record<string, unknown>>).persistence;
  if (persistence === 'failed') return '配置已生效，但未能持久化；当前生效值已保留。';
  if (persistence === 'unconfirmed') return '配置已生效，持久化结果暂无法确认。';
  return '配置已生效并已保存。';
};

const draftFrom = (
  addresses: readonly Readonly<{addressName: string; baseUrl: string; timeoutMs?: number}>[],
  proxy: null | Readonly<{
    protocol: 'http';
    host: string;
    port: number;
    username?: string;
    passwordConfigured: boolean;
  }>,
): ConfigDraft =>
  Object.freeze({
    addresses: Object.freeze(
      addresses.map(address =>
        Object.freeze({
          addressName: address.addressName,
          baseUrl: address.baseUrl,
          timeoutMs: String(address.timeoutMs ?? 10000),
        }),
      ),
    ),
    proxyEnabled: proxy !== null,
    proxyHost: proxy?.host ?? '',
    proxyPort: String(proxy?.port ?? 8080),
    proxyUsername: proxy?.username ?? '',
    proxyPassword: '',
  });

const addressesOf = (draft: ConfigDraft): readonly ServerConfigAddressInput[] =>
  Object.freeze(
    draft.addresses.map(address =>
      Object.freeze({
        addressName: address.addressName,
        baseUrl: address.baseUrl,
        timeoutMs: Number(address.timeoutMs),
      }),
    ),
  );

const proxyOf = (
  draft: ConfigDraft,
  existingPasswordOverridden: boolean,
  defaultPasswordConfigured: boolean,
): ServerConfigProxyInput | null => {
  if (!draft.proxyEnabled) return null;
  const password: ServerConfigProxyInput['password'] =
    draft.proxyPassword.length > 0
      ? Object.freeze({mode: 'set', value: draft.proxyPassword})
      : existingPasswordOverridden
        ? Object.freeze({mode: 'keep'})
        : defaultPasswordConfigured
          ? Object.freeze({mode: 'set', value: ''})
          : Object.freeze({mode: 'none'});
  return Object.freeze({
    protocol: 'http',
    host: draft.proxyHost,
    port: Number(draft.proxyPort),
    ...(draft.proxyUsername.length === 0 ? {} : {username: draft.proxyUsername}),
    password,
  });
};

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0});

export const ServerConfigPanel = ({
  defaults,
  context,
}: AdminSectionProps & Readonly<{readonly defaults: TransportServerConfig}>) => {
  const config = useUiStateSelector(state => selectServerConfiguration(state, defaults));
  const instanceMode = useUiStateSelector(selectRuntimeInstanceMode);
  const tracked = useTrackedCommand();
  const selectedSpace = config?.selectedSpace ?? defaults.selectedSpace;
  const effectiveSpace = config?.spaces.find(space => space.name === selectedSpace);
  const defaultSpace = config?.defaults.find(space => space.name === selectedSpace);
  const [selectedServerName, setSelectedServerName] = useState(effectiveSpace?.servers[0]?.serverName ?? '');
  const [draft, setDraft] = useState<ConfigDraft>(emptyDraft);
  const [draftIdentity, setDraftIdentity] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [draftVersion, setDraftVersion] = useState(0);
  const [addressRowsVersion, setAddressRowsVersion] = useState(0);
  const branch = instanceMode === 'SLAVE';
  const hostProjectionReady = !branch || config?.source === 'host-sync';
  const service = effectiveSpace?.servers.find(server => server.serverName === selectedServerName);
  const defaultService = defaultSpace?.servers.find(server => server.serverName === selectedServerName);
  const addresses = service?.addresses ?? noAddresses;
  const effectiveProxy = service?.proxy ?? null;
  const defaultProxy = defaultService?.proxy ?? null;
  const hasService = service !== undefined;
  const draftSourceKey = JSON.stringify({
    addresses,
    proxy:
      effectiveProxy === null
        ? null
        : {
            protocol: effectiveProxy.protocol,
            host: effectiveProxy.host,
            port: effectiveProxy.port,
            username: effectiveProxy.username,
            passwordConfigured: effectiveProxy.passwordConfigured,
          },
  });
  const sourceDraft = useMemo(() => {
    const source = JSON.parse(draftSourceKey) as Readonly<{
      addresses: readonly Readonly<{addressName: string; baseUrl: string; timeoutMs?: number}>[];
      proxy: null | Readonly<{
        protocol: 'http';
        host: string;
        port: number;
        username?: string;
        passwordConfigured: boolean;
      }>;
    }>;
    return draftFrom(source.addresses, source.proxy);
  }, [draftSourceKey]);
  const currentDraftIdentity = JSON.stringify({
    source: config?.source ?? null,
    selectedSpace,
    selectedServerName,
    draftSourceKey,
  });
  const editable = !branch && hostProjectionReady && !tracked.requestInFlight && draftIdentity === currentDraftIdentity;
  const visibleAddresses = editable ? draft.addresses : addresses;
  const serviceOptions = useMemo(
    () => (effectiveSpace?.servers ?? []).map(server => ({value: server.serverName, label: server.serverName})),
    [effectiveSpace?.servers],
  );

  useEffect(() => {
    const first = effectiveSpace?.servers[0]?.serverName ?? '';
    if (!effectiveSpace?.servers.some(server => server.serverName === selectedServerName)) setSelectedServerName(first);
  }, [effectiveSpace, selectedServerName]);

  useEffect(() => {
    if (!hasService) {
      setDraftIdentity(null);
      return;
    }
    setDraft(sourceDraft);
    setDraftIdentity(currentDraftIdentity);
  }, [currentDraftIdentity, hasService, sourceDraft]);

  const changeAddress = (index: number, key: keyof AddressDraft, value: string): void => {
    setDraft(current =>
      Object.freeze({
        ...current,
        addresses: Object.freeze(
          current.addresses.map((address, currentIndex) =>
            currentIndex === index ? Object.freeze({...address, [key]: value}) : address,
          ),
        ),
      }),
    );
  };
  const run = async <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
    resetDraftOnSuccess = true,
  ): Promise<void> => {
    setFeedback('');
    try {
      const result = await tracked.run({
        definition,
        payload,
        rejectionPolicy: 'CONSUME',
        onRejected: () => setFeedback('操作被配置 owner 拒绝，草稿已保留。'),
      });
      setFeedback(feedbackFrom(result));
      if (result?.status === 'completed' && resetDraftOnSuccess) setDraftVersion(version => version + 1);
    } catch {
      setFeedback('操作未完成，请重试；草稿已保留。');
    }
  };
  const save = (): void => {
    if (service === undefined || !editable) return;
    if (defaultProxy?.passwordConfigured && !service.proxyPasswordOverridden && draft.proxyPassword.length === 0) {
      setFeedback('请重新输入默认代理密码后再保存覆盖配置。');
      return;
    }
    void run(
      setServerOverrideCommand,
      {
        serverName: service.serverName,
        addresses: addressesOf(draft),
        proxy: proxyOf(draft, service.proxyPasswordOverridden, defaultProxy?.passwordConfigured ?? false),
      },
      false,
    );
  };

  return (
    <PrimitiveContainer
      testID={testIds.section}
      layout="content"
      appearance="admin-content"
      bounded
      style={sectionStyle}
    >
      <PrimitiveHeading appearance="admin-page" testID={testIds.title}>
        {context.catalogEntry.title}
      </PrimitiveHeading>
      <InputScrollArea testID={testIds.scroll}>
        {!hostProjectionReady ? (
          <PrimitiveStatus testID={testIds.readStatus} tone="warn">
            主机配置待同步
          </PrimitiveStatus>
        ) : (
          <>
            <PrimitiveText testID={testIds.readStatus}>{branch ? '副机只读配置' : '本机服务配置'}</PrimitiveText>
            <PrimitiveText testID={testIds.readSpace}>服务空间：{selectedSpace}</PrimitiveText>
            {editable ? (
              <PrimitiveSelect
                testID={testIds.space}
                accessibilityLabel="服务空间"
                options={(config?.spaces ?? []).map(space => ({value: space.name, label: space.name}))}
                value={selectedSpace}
                onValueChange={spaceName => void run(selectServerConfigSpaceCommand, {spaceName})}
              />
            ) : null}
            <PrimitiveText testID={testIds.readService}>服务：{service?.serverName ?? '暂无服务'}</PrimitiveText>
            {editable && serviceOptions.length > 1 ? (
              <PrimitiveSelect
                testID={testIds.service}
                accessibilityLabel="服务"
                options={serviceOptions}
                value={selectedServerName}
                onValueChange={setSelectedServerName}
              />
            ) : null}
            <PrimitiveCard appearance="admin" testID={testIds.addresses}>
              {visibleAddresses.map((address, index) => {
                const fieldBase = `terminal.server-config.address.${index + 1}`;
                const draftAddress = editable
                  ? address
                  : {
                      addressName: address.addressName,
                      baseUrl: address.baseUrl,
                      timeoutMs: String(address.timeoutMs ?? 10000),
                    };
                return (
                  <PrimitiveCard
                    key={`${fieldBase}:${draftVersion}:${addressRowsVersion}:${draftIdentity ?? 'loading'}`}
                    appearance="admin"
                    testID={testIds.addressCard(index + 1)}
                  >
                    {editable ? (
                      <>
                        <ConfigField
                          fieldId={`${fieldBase}.name`}
                          testID={testIds.addressField(index + 1, 'name')}
                          label={`地址 ${index + 1} 名称`}
                          initialValue={draftAddress.addressName}
                          editable
                          onValueChange={value => changeAddress(index, 'addressName', value)}
                        />
                        <ConfigField
                          fieldId={`${fieldBase}.url`}
                          testID={testIds.addressField(index + 1, 'url')}
                          label={`地址 ${index + 1} URL 前缀`}
                          initialValue={draftAddress.baseUrl}
                          editable
                          onValueChange={value => changeAddress(index, 'baseUrl', value)}
                        />
                        <ConfigField
                          fieldId={`${fieldBase}.timeout`}
                          testID={testIds.addressField(index + 1, 'timeout')}
                          label={`地址 ${index + 1} 超时毫秒`}
                          initialValue={String(draftAddress.timeoutMs)}
                          editable
                          numeric
                          onValueChange={value => changeAddress(index, 'timeoutMs', value.replace(/[^0-9]/g, ''))}
                        />
                      </>
                    ) : (
                      <PrimitiveText testID={testIds.readAddress(index + 1)}>
                        {address.addressName}：{address.baseUrl}（{address.timeoutMs} ms）
                      </PrimitiveText>
                    )}
                    {editable && draft.addresses.length > 1 ? (
                      <PrimitiveButton
                        testID={testIds.removeAddress(index + 1)}
                        appearance="admin-secondary"
                        onPress={() => {
                          setAddressRowsVersion(version => version + 1);
                          setDraft(current =>
                            Object.freeze({
                              ...current,
                              addresses: Object.freeze(
                                current.addresses.filter((_, addressIndex) => addressIndex !== index),
                              ),
                            }),
                          );
                        }}
                      >
                        移除地址
                      </PrimitiveButton>
                    ) : null}
                  </PrimitiveCard>
                );
              })}
              {editable && draft.addresses.length < 4 ? (
                <PrimitiveButton
                  testID={testIds.addAddress}
                  appearance="admin-secondary"
                  onPress={() => {
                    setAddressRowsVersion(version => version + 1);
                    setDraft(current =>
                      Object.freeze({
                        ...current,
                        addresses: Object.freeze([
                          ...current.addresses,
                          Object.freeze({
                            addressName: `address-${current.addresses.length + 1}`,
                            baseUrl: '',
                            timeoutMs: '10000',
                          }),
                        ]),
                      }),
                    );
                  }}
                >
                  添加地址
                </PrimitiveButton>
              ) : null}
            </PrimitiveCard>
            {addresses.map((address, index) => (
              <PrimitiveText key={`effective-${address.addressName}`} testID={testIds.effectiveAddress(index + 1)}>
                当前生效地址：{address.addressName} · {address.baseUrl}（{address.timeoutMs ?? 10000} ms）
              </PrimitiveText>
            ))}
            <PrimitiveText testID={testIds.effectiveProxy}>
              当前生效代理：
              {effectiveProxy === null
                ? '未配置'
                : `${effectiveProxy.host}:${effectiveProxy.port}；密码${effectiveProxy.passwordConfigured ? '已配置' : '未配置'}`}
            </PrimitiveText>
            {editable ? (
              <>
                <PrimitiveSwitch
                  testID={testIds.proxyEnabled}
                  accessibilityLabel="启用 HTTP 代理"
                  checked={draft.proxyEnabled}
                  onCheckedChange={enabled => setDraft(current => Object.freeze({...current, proxyEnabled: enabled}))}
                />
                <PrimitiveText testID={testIds.proxyEnabledLabel}>启用 HTTP 代理</PrimitiveText>
                {draft.proxyEnabled ? (
                  <PrimitiveCard
                    key={`proxy:${draftVersion}:${config?.selectedSpace ?? ''}:${selectedServerName}:${draftSourceKey}`}
                    appearance="admin"
                    testID={testIds.proxyFields}
                  >
                    <ConfigField
                      fieldId="terminal.server-config.proxy-host"
                      testID={testIds.proxyHost}
                      label="HTTP 代理主机"
                      initialValue={draft.proxyHost}
                      editable
                      onValueChange={proxyHost => setDraft(current => Object.freeze({...current, proxyHost}))}
                    />
                    <ConfigField
                      fieldId="terminal.server-config.proxy-port"
                      testID={testIds.proxyPort}
                      label="HTTP 代理端口"
                      initialValue={draft.proxyPort}
                      editable
                      numeric
                      onValueChange={proxyPort =>
                        setDraft(current => Object.freeze({...current, proxyPort: proxyPort.replace(/[^0-9]/g, '')}))
                      }
                    />
                    <ConfigField
                      fieldId="terminal.server-config.proxy-user"
                      testID={testIds.proxyUser}
                      label="代理用户名"
                      initialValue={draft.proxyUsername}
                      editable
                      onValueChange={proxyUsername => setDraft(current => Object.freeze({...current, proxyUsername}))}
                    />
                    <ConfigField
                      fieldId="terminal.server-config.proxy-password"
                      testID={testIds.proxyPassword}
                      label="代理密码"
                      initialValue=""
                      editable
                      secure
                      onValueChange={proxyPassword => setDraft(current => Object.freeze({...current, proxyPassword}))}
                    />
                    {effectiveProxy?.passwordConfigured || defaultProxy?.passwordConfigured ? (
                      <PrimitiveText testID={testIds.proxyPasswordConfigured}>代理密码已配置，不显示明文</PrimitiveText>
                    ) : null}
                  </PrimitiveCard>
                ) : null}
              </>
            ) : (
              <PrimitiveText testID={testIds.readProxy}>
                HTTP 代理：
                {effectiveProxy === null
                  ? '未配置'
                  : `${effectiveProxy.host}:${effectiveProxy.port}；密码${effectiveProxy.passwordConfigured ? '已配置' : '未配置'}`}
              </PrimitiveText>
            )}
          </>
        )}
      </InputScrollArea>
      {editable ? (
        <PrimitiveActions testID={testIds.actions}>
          <PrimitiveButton
            testID={testIds.save}
            appearance="admin-primary"
            disabled={tracked.requestInFlight || service === undefined}
            busy={tracked.requestInFlight}
            onPress={save}
          >
            保存配置
          </PrimitiveButton>
          <PrimitiveButton
            testID={testIds.clear}
            appearance="admin-secondary"
            disabled={tracked.requestInFlight || service === undefined}
            onPress={() => service && void run(clearServerOverrideCommand, {serverName: service.serverName})}
          >
            清除覆盖
          </PrimitiveButton>
          <PrimitiveButton
            testID={testIds.restore}
            appearance="admin-secondary"
            disabled={tracked.requestInFlight}
            onPress={() => void run(restoreServerDefaultsCommand, {})}
          >
            恢复默认
          </PrimitiveButton>
        </PrimitiveActions>
      ) : null}
      {feedback.length > 0 ? <PrimitiveStatus testID={testIds.result}>{feedback}</PrimitiveStatus> : null}
    </PrimitiveContainer>
  );
};
