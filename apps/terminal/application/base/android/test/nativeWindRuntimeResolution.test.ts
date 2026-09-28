import path from 'node:path';
import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const require = createRequire(import.meta.url);
const {createMetroConfig, pinNativeWindRuntime} = require('../config/index.cjs') as {
  createMetroConfig: (input: {appDir: string; globalCssPath: string}) => {
    resolver?: {
      extraNodeModules?: Record<string, string>;
      resolveRequest?: (context: unknown, moduleName: string, platform: string) => {type: string; filePath: string};
    };
  };
  pinNativeWindRuntime: (
    config: {
      resolver?: {
        resolveRequest?: (context: unknown, moduleName: string, platform: string) => {type: string; filePath: string};
      };
    },
    workspaceRoot: string,
  ) => {
    resolver?: {
      resolveRequest?: (context: unknown, moduleName: string, platform: string) => {type: string; filePath: string};
    };
  };
};

const packageRoot = path.resolve(process.cwd());
const sampleTerminalAppDir = path.resolve(packageRoot, '../../android/sample-terminal');
const workspaceNativeWindRuntime = path.resolve(packageRoot, '../../../../../node_modules/react-native-css-interop');

describe('NativeWind runtime resolution', () => {
  it('maps every Metro css-interop import to the workspace runtime', () => {
    const config = createMetroConfig({
      appDir: sampleTerminalAppDir,
      globalCssPath: '@catering-v2s/ui-integration-sample-console/theme/global.css',
    });

    expect(config.resolver?.extraNodeModules?.['react-native-css-interop']).toBe(workspaceNativeWindRuntime);

    const resolveRequest = config.resolver?.resolveRequest;
    expect(resolveRequest).toBeTypeOf('function');
    for (const moduleName of [
      'react-native-css-interop',
      'react-native-css-interop/jsx-runtime',
      'react-native-css-interop/dist/runtime/native/api',
      'react-native-css-interop/metro',
    ]) {
      const resolved = resolveRequest?.(
        {
          resolveRequest: () => {
            throw new Error('unexpected fallback resolver call');
          },
        } as never,
        moduleName,
        'android',
      );
      expect(resolved?.type).toBe('sourceFile');
      const resolvedPath = path.resolve(resolved?.filePath ?? '');
      const runtimeRoot = path.resolve(workspaceNativeWindRuntime);
      expect(resolvedPath === runtimeRoot || resolvedPath.startsWith(`${runtimeRoot}${path.sep}`)).toBe(true);
    }
    expect(() =>
      resolveRequest?.(
        {
          resolveRequest: () => {
            throw new Error('unexpected fallback resolver call');
          },
        } as never,
        'react-native-css-interop/../../package.json',
        'android',
      ),
    ).toThrow(/escaped runtime root/);

    const fallbackConfig = pinNativeWindRuntime(
      {
        resolver: {
          resolveRequest: (_context, moduleName) => ({type: 'sourceFile', filePath: `/fallback/${moduleName}`}),
        },
      },
      path.resolve(workspaceNativeWindRuntime, '../..'),
    );
    const fallback = fallbackConfig.resolver?.resolveRequest?.({}, 'react-native', 'android');
    expect(fallback).toEqual({type: 'sourceFile', filePath: '/fallback/react-native'});
  });
});
