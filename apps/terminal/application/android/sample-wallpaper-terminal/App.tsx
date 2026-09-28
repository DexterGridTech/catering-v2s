import '@catering-v2s/ui-integration-sample-wallpaper-console/theme/global.css';
import {
  createSurfaceForDisplayIndex,
  type SurfaceForm,
  type WallpaperConsoleAssembly,
} from '@catering-v2s/ui-integration-sample-wallpaper-console';
import {StandaloneStartupFailurePage} from '@catering-v2s/ui-base-render';
import {AndroidTerminalApp} from '@catering-v2s/application-base-android';
import {
  createSampleWallpaperTerminalAssembly,
  nativeLoadingCapability,
  nativeLoadingLogger,
} from './src/assembly/platformPorts';
import {ControlledKeyboardHarness, useControlledKeyboardHarness} from './src/components/controlledKeyboardHarness';

type AppProps = Readonly<{
  readonly displayIndex?: 0 | 1;
  readonly surfaceForm?: SurfaceForm;
}>;

export default function App({displayIndex, surfaceForm}: AppProps) {
  const controlledKeyboardHarness = useControlledKeyboardHarness(displayIndex !== 1);
  if (controlledKeyboardHarness) return <ControlledKeyboardHarness />;

  return (
    <AndroidTerminalApp<WallpaperConsoleAssembly>
      displayIndex={displayIndex}
      surfaceForm={surfaceForm}
      createAssembly={createSampleWallpaperTerminalAssembly}
      renderSurface={(assembly, nextDisplayIndex) => createSurfaceForDisplayIndex(assembly, nextDisplayIndex)}
      nativeLoadingCapability={nativeLoadingCapability}
      renderFailurePage={({reason, displayIndex}) => (
        <StandaloneStartupFailurePage
          reason={reason}
          displayIndex={displayIndex}
          logger={nativeLoadingLogger}
          nativeLoadingCapability={nativeLoadingCapability}
        />
      )}
      loadingTestID="sample-wallpaper-terminal.loading"
      loadingMessage="正在启动壁纸终端…"
      loadingBackgroundColor="#f1f5f9"
      loadingForegroundColor="#0f172a"
    />
  );
}
