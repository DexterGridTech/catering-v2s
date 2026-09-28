import '@catering-v2s/ui-integration-sample-console/theme/global.css';
import {
  createSurfaceForDisplayIndex,
  type SampleAssembly,
  type SurfaceForm,
} from '@catering-v2s/ui-integration-sample-console';
import {StandaloneStartupFailurePage} from '@catering-v2s/ui-base-render';
import {AndroidTerminalApp} from '@catering-v2s/application-base-android';
import {createSampleTerminalAssembly, nativeLoadingCapability, nativeLoadingLogger} from './src/assembly/platformPorts';
import {ControlledKeyboardHarness, useControlledKeyboardHarness} from './src/components/controlledKeyboardHarness';

type AppProps = Readonly<{
  readonly displayIndex?: 0 | 1;
  readonly surfaceForm?: SurfaceForm;
}>;

export default function App({displayIndex, surfaceForm}: AppProps) {
  const controlledKeyboardHarness = useControlledKeyboardHarness(displayIndex !== 1);
  if (controlledKeyboardHarness) return <ControlledKeyboardHarness />;

  return (
    <AndroidTerminalApp<SampleAssembly>
      displayIndex={displayIndex}
      surfaceForm={surfaceForm}
      createAssembly={createSampleTerminalAssembly}
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
      loadingMessage="正在启动终端…"
      loadingBackgroundColor="#071829"
      loadingForegroundColor="#eaf6ff"
    />
  );
}
