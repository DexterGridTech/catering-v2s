import {useEffect, useState, type ReactElement} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports';

export type AndroidSurfaceForm = 'laptop' | 'mobile';

export type AndroidTerminalAppProps<TAssembly> = Readonly<{
  readonly displayIndex?: 0 | 1;
  readonly surfaceForm?: AndroidSurfaceForm;
  readonly createAssembly: (input: Readonly<{readonly surfaceForm: AndroidSurfaceForm}>) => Promise<TAssembly>;
  readonly renderSurface: (assembly: TAssembly, displayIndex: 0 | 1) => ReactElement;
  readonly nativeLoadingCapability: NativeLoadingCapability;
  readonly loadingTestID?: string;
  readonly loadingMessage?: string;
  readonly loadingBackgroundColor?: string;
  readonly loadingForegroundColor?: string;
  readonly renderFailurePage: (
    input: Readonly<{
      readonly reason: string;
      readonly displayIndex: 0 | 1;
    }>,
  ) => ReactElement;
}>;

const assemblyPromises: Partial<Record<AndroidSurfaceForm, Promise<unknown>>> = {};

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'UnknownError');

export const AndroidTerminalApp = <TAssembly,>({
  displayIndex = 0,
  surfaceForm = 'laptop',
  createAssembly,
  renderSurface,
  nativeLoadingCapability,
  loadingTestID = 'application.base.android:loading',
  loadingMessage = '正在启动终端…',
  loadingBackgroundColor = '#f1f5f9',
  loadingForegroundColor = '#0f172a',
  renderFailurePage,
}: AndroidTerminalAppProps<TAssembly>): ReactElement => {
  const [assembly, setAssembly] = useState<TAssembly | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const promise =
      (assemblyPromises[surfaceForm] as Promise<TAssembly> | undefined) ??
      ((assemblyPromises[surfaceForm] = createAssembly({surfaceForm})) as Promise<TAssembly>);
    void promise
      .then(nextAssembly => {
        if (active) setAssembly(nextAssembly);
      })
      .catch(error => {
        if (active) setFailure(errorName(error));
      });
    return () => {
      active = false;
    };
  }, [createAssembly, surfaceForm]);

  if (failure !== null) {
    return renderFailurePage({reason: `assembly-rejection:${failure}`, displayIndex});
  }

  if (assembly === null) {
    return (
      <View testID={loadingTestID} style={[styles.fallback, {backgroundColor: loadingBackgroundColor}]}>
        <Text style={[styles.fallbackText, {color: loadingForegroundColor}]}>{loadingMessage}</Text>
      </View>
    );
  }

  try {
    return renderSurface(assembly, displayIndex);
  } catch (error) {
    // A surface can be rejected after assembly creation when the Android
    // host is launched on an unsupported physical display. Keep this
    // terminal path inside the same render-owned failure page as async
    // assembly rejection; otherwise the app process crashes while the
    // native splash has no truthful failure surface to hand off to.
    return renderFailurePage({reason: `surface-rejection:${errorName(error)}`, displayIndex});
  }
};

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    fontSize: 16,
  },
});
