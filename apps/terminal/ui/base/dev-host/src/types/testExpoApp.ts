import type {ReactElement} from 'react';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import type {SurfaceMode, WebPlatformOptions} from '../implementations/webPlatform';
import type {WebSurfaceHostSource} from '../implementations/webSurfaceHost';

export type SurfaceSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';

export type SurfaceCreationInput = Readonly<{
  readonly displayIndex: 0 | 1;
  readonly displayMode: DisplayMode;
  readonly surfaceForm: SurfaceForm;
}>;

export type TerminalSurfaces = Readonly<{
  readonly orientations: Readonly<{
    readonly landscape: Readonly<Record<DisplayMode, SurfaceSize>>;
    readonly portrait?: Readonly<Pick<Record<DisplayMode, SurfaceSize>, 'PRIMARY'>>;
  }>;
}>;

export type TestExpoRuntimeStatus = 'created' | 'starting' | 'started' | 'failed';

export type TestExpoAssembly = Readonly<{
  readonly createSurface: (input: SurfaceCreationInput) => ReactElement;
}>;

export type TestExpoAppOptions<TAssembly extends TestExpoAssembly> = Readonly<{
  readonly appName: string;
  readonly title: string;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly surfaceForm?: SurfaceForm;
  readonly persistenceKey?: string;
  readonly webPlatformOptions?: WebPlatformOptions;
  readonly createAssembly: (
    input: Readonly<{
      readonly platformPorts: PlatformPorts;
      readonly nativeLoadingCapability: NativeLoadingCapability;
      readonly persistenceKey: string;
      readonly surfaceForm: SurfaceForm;
      readonly surfaceHostSourcesByDisplayIndex: Readonly<Partial<Record<0 | 1, WebSurfaceHostSource>>>;
    }>,
  ) => Promise<TAssembly>;
  readonly getRuntimeStatus: (assembly: TAssembly) => TestExpoRuntimeStatus;
  /**
   * Lets the integration owner commit a display-topology refresh before the
   * host reads the same display facts for surface mounting.
   */
  readonly onSurfaceModeChanged?: (
    input: Readonly<{
      readonly assembly: TAssembly;
      readonly surfaceMode: SurfaceMode;
    }>,
  ) => Promise<void>;
}>;

