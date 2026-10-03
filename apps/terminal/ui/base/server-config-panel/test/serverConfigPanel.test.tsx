import React from 'react';
import {Text, View} from 'react-native';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render} from '@testing-library/react-native';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import type {AdminSectionProps} from '@catering-v2s/ui-base-admin-shell';
import {ServerConfigPanel} from '../src/components/ServerConfigPanel';

const mockRuntime = vi.hoisted(() => ({
  instanceMode: 'MASTER' as 'MASTER' | 'SLAVE',
  state: {} as Record<string, unknown>,
  commandRun: vi.fn(async () => ({status: 'completed', actorResults: []})),
}));

vi.mock('@catering-v2s/ui-base-render', () => ({
  moduleName: 'ui.base.render',
  useUiStateSelector: (selector: (state: Record<string, unknown>) => unknown) => selector(mockRuntime.state),
  useTrackedCommand: () => ({requestInFlight: false, run: mockRuntime.commandRun}),
}));

vi.mock('@catering-v2s/ui-base-admin-shell', () => ({ADMIN_CONSOLE_FOCUS_SCOPE_ID: 'admin.console'}));

vi.mock('@catering-v2s/ui-base-input', () => ({
  InputScrollArea: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <View testID={testID}>{children}</View>
  ),
  useInputField: (options: {initialValue?: string; testID: string}) => ({
    inputProps: {testID: options.testID, value: options.initialValue ?? '', onChangeText: vi.fn()},
  }),
}));

vi.mock('@catering-v2s/ui-base-primitives', () => ({
  PrimitiveActions: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <View testID={testID}>{children}</View>
  ),
  PrimitiveButton: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <Text testID={testID}>{children}</Text>
  ),
  PrimitiveCard: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <View testID={testID}>{children}</View>
  ),
  PrimitiveContainer: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <View testID={testID}>{children}</View>
  ),
  PrimitiveHeading: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <Text testID={testID}>{children}</Text>
  ),
  PrimitiveInput: ({testID, value, secureTextEntry}: {testID: string; value?: string; secureTextEntry?: boolean}) => (
    <Text testID={testID}>{`${secureTextEntry === true ? 'secure' : 'plain'}:${value ?? ''}`}</Text>
  ),
  PrimitiveLabel: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <Text testID={testID}>{children}</Text>
  ),
  PrimitiveSelect: ({testID}: {testID: string}) => <Text testID={testID} />,
  PrimitiveStatus: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <Text testID={testID}>{children}</Text>
  ),
  PrimitiveSwitch: ({testID}: {testID: string}) => <Text testID={testID} />,
  PrimitiveText: ({children, testID}: {children?: React.ReactNode; testID: string}) => (
    <Text testID={testID}>{children}</Text>
  ),
}));

const defaults: TransportServerConfig = Object.freeze({
  selectedSpace: 'dev',
  spaces: Object.freeze([
    Object.freeze({
      name: 'dev',
      servers: Object.freeze([
        Object.freeze({
          serverName: 'business',
          addresses: Object.freeze([
            {addressName: 'primary', baseUrl: 'https://dev.example.test/api', timeoutMs: 10000},
          ]),
          proxy: Object.freeze({
            protocol: 'http' as const,
            host: 'proxy.example.test',
            port: 8080,
            username: 'dev-user',
            password: 'secret-that-must-not-render',
          }),
        }),
      ]),
    }),
  ]),
});

const context = Object.freeze({
  catalogEntry: Object.freeze({
    partKey: 'terminal.server-config.admin',
    rendererKey: 'terminal.server-config.admin',
    containerKeys: ['admin.sections'],
    displayModes: ['PRIMARY'],
    workspaces: ['MAIN'],
    instanceModes: ['MASTER'],
    surfaceForm: ['laptop'],
    title: '服务配置',
    description: '服务配置',
  }),
  runtimeFacts: {} as AdminSectionProps['context']['runtimeFacts'],
  surface: {} as AdminSectionProps['context']['surface'],
  commandBoundary: {} as AdminSectionProps['context']['commandBoundary'],
}) as AdminSectionProps['context'];

const stateFor = (instanceMode: 'MASTER' | 'SLAVE', syncedHostDefaults: TransportServerConfig | null) => {
  mockRuntime.instanceMode = instanceMode;
  mockRuntime.state = {
    'kernel.base.runtime.instance-mode': {instanceMode},
    'kernel.base.server-config.configuration': {
      selectedSpace: 'dev',
      overrides: {},
      proxyPasswords: {},
      syncedHostDefaults,
      serviceRevisions: {business: 0},
    },
  };
};

describe('server-config admin panel', () => {
  beforeEach(() => {
    mockRuntime.commandRun.mockClear();
  });

  it('does not project package-local defaults on an uninitialized SLAVE branch', async () => {
    stateFor('SLAVE', null);
    const screen = await render(<ServerConfigPanel defaults={defaults} context={context} />);
    expect(screen.getByTestId('terminal.server-config.read.status').props.children).toBe('主机配置待同步');
    expect(screen.queryByTestId('terminal.server-config.save')).toBeNull();
    expect(screen.queryByTestId('terminal.server-config.read.address.1')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toContain('dev.example.test');
  });

  it('shows the synchronized host snapshot read-only on a SLAVE branch', async () => {
    const hostDefaults: TransportServerConfig = Object.freeze({
      ...defaults,
      spaces: Object.freeze([
        Object.freeze({
          name: 'dev',
          servers: Object.freeze([
            Object.freeze({
              serverName: 'business',
              addresses: Object.freeze([
                {addressName: 'primary', baseUrl: 'https://host.example.test/api', timeoutMs: 9000},
              ]),
              proxy: Object.freeze({protocol: 'http' as const, host: 'host-proxy.example.test', port: 8081}),
            }),
          ]),
        }),
      ]),
    });
    stateFor('SLAVE', hostDefaults);
    const screen = await render(<ServerConfigPanel defaults={defaults} context={context} />);
    expect(screen.getByTestId('terminal.server-config.read.status').props.children).toBe('副机只读配置');
    expect(screen.getByTestId('terminal.server-config.read.address.1').props.children).toContain(
      'https://host.example.test/api',
    );
    expect(JSON.stringify(screen.toJSON())).not.toContain('https://dev.example.test/api');
    expect(screen.queryByTestId('terminal.server-config.save')).toBeNull();
  });

  it('shows only a masked proxy status and secure empty input on the MASTER host', async () => {
    stateFor('MASTER', null);
    const screen = await render(<ServerConfigPanel defaults={defaults} context={context} />);
    expect(screen.getByTestId('terminal.server-config.proxy-password-configured').props.children).toBe(
      '代理密码已配置，不显示明文',
    );
    expect(screen.getByTestId('terminal.server-config.proxy-password').props.children).toBe('secure:');
    expect(JSON.stringify(screen.toJSON())).not.toContain('secret-that-must-not-render');
    expect(JSON.stringify(screen.toJSON())).not.toContain('default-proxy-secret');
  });
});
