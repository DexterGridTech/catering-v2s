import {createElement, type ReactElement} from 'react'
import {describe, expect, it} from 'vitest'
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports'
import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {AdminLauncher} from '@catering-v2s/ui-base-admin-shell'
import {SurfaceRoot} from '@catering-v2s/ui-base-render'
import {
  createIntegrationAssembly,
  getSurfaceDeclarations,
  readTerminalSurfaces,
  surfaceFormForOrientation,
} from '../src'

const landscape = {
  PRIMARY: {width: 1280, height: 800},
  SECONDARY: {width: 1280, height: 800},
} as const

describe('shared terminal surface declarations', () => {
  it('preserves valid laptop and primary-only mobile declarations', () => {
    const surfaces = readTerminalSurfaces({
      orientations: {landscape, portrait: {PRIMARY: {width: 360, height: 640}}},
    }, {errorPrefix: 'test-console'})
    expect(surfaces).toEqual({
      orientations: {landscape, portrait: {PRIMARY: {width: 360, height: 640}}},
    })
    expect(Object.isFrozen(surfaces)).toBe(true)
    expect(Object.isFrozen(surfaces.orientations)).toBe(true)
    expect(getSurfaceDeclarations(surfaces, 'laptop', {errorPrefix: 'test-console'}))
      .toBe(surfaces.orientations.landscape)
    expect(getSurfaceDeclarations(surfaces, 'mobile', {errorPrefix: 'test-console'}))
      .toBe(surfaces.orientations.portrait)
    expect(surfaceFormForOrientation('landscape')).toBe('laptop')
    expect(surfaceFormForOrientation('portrait')).toBe('mobile')
  })

  it('rejects invalid shape, missing dimensions, non-positive dimensions and portrait secondary', () => {
    expect(() => readTerminalSurfaces({orientations: {}}, {errorPrefix: 'sample-console'}))
      .toThrow(/\[sample-console\].*landscape surfaces are required/)
    expect(() => readTerminalSurfaces({layout: 'column'}, {errorPrefix: 'sample-console'}))
      .toThrow(/\[sample-console\].*invalid shape/)
    expect(() => readTerminalSurfaces({orientations: {landscape: {
      PRIMARY: landscape.PRIMARY,
    }}}, {errorPrefix: 'sample-console'})).toThrow(/landscape\.SECONDARY surface/)
    expect(() => readTerminalSurfaces({orientations: {
      landscape,
      portrait: {PRIMARY: {width: 360, height: 640}, SECONDARY: {width: 1, height: 1}},
    }}, {errorPrefix: 'sample-console'})).toThrow(/portrait\.SECONDARY is not allowed/)
    expect(() => readTerminalSurfaces({orientations: {
      landscape: {PRIMARY: {width: 0, height: 800}, SECONDARY: landscape.SECONDARY},
    }}, {errorPrefix: 'sample-console'})).toThrow(/positive width and height/)
  })

  it('fails mobile selection when the package has no portrait declaration', () => {
    const surfaces = readTerminalSurfaces({orientations: {landscape}}, {errorPrefix: 'sample2'})
    expect(() => getSurfaceDeclarations(surfaces, 'mobile', {errorPrefix: 'sample2'}))
      .toThrow(/\[sample2\].*mobile surface declarations are required/)
  })

  it('keeps the console input frame inside SurfaceRoot renderContentFrame', async () => {
    const startupReadyCommand = defineCommand<Readonly<{readonly ready: boolean}>>('test.console-surface', {
      name: 'startup-ready',
      visibility: 'public',
    })
    const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
      targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
      hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
    })
    const platformPorts = createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {kind: 'sink', write: () => ({status: 'succeeded', value: {}, completedAt: 0})},
        persistKv: createProcessMemoryStateStoragePort(),
        persistSecure: createProcessMemoryStateStoragePort(),
        device: unavailableDevicePort,
        appControl: unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        hotUpdate: unavailableHotUpdatePort,
        logUpload: unavailableLogUploadPort,
        topologyHost: unavailableTopologyHostPort,
      },
    })

    const assembly = await createIntegrationAssembly({
      appName: 'test-console-surface',
      errorPrefix: 'test-console-surface',
      runtimeName: 'test-console-surface',
      defaultPersistenceKey: 'test-console-surface',
      platformPorts,
      nativeLoadingCapability,
      surfaceForm: 'laptop',
      surfaceDeclarations: {PRIMARY: {width: 1280, height: 800}},
      parts: [],
      layerDismissals: {},
      variables: [],
      startupReadyCommand,
      createStartupReadyPayload: () => ({ready: true}),
      createApplicationModules: () => [],
    })

    const providerElement = assembly.createSurface({
      displayIndex: 0,
      displayMode: 'PRIMARY',
      surfaceForm: 'laptop',
    })
    const providerProps = providerElement.props as Readonly<{readonly children: ReactElement<Record<string, unknown>>}>
    const surfaceRootElement = providerProps.children
    expect(surfaceRootElement.type).toBe(SurfaceRoot)

    const contentMarker = createElement('integration-assembly-content')
    const surfaceRootProps = surfaceRootElement.props as Readonly<{
      readonly renderContentFrame: (input: Readonly<{readonly content: ReactElement}>) => ReactElement<Record<string, unknown>>
    }>
    const inputFrameElement = surfaceRootProps.renderContentFrame({content: contentMarker})
    const inputFrameProps = inputFrameElement.props as Readonly<{readonly children: ReactElement<Record<string, unknown>>}>
    const launcherElement = inputFrameProps.children

    expect(launcherElement.type).toBe(AdminLauncher)
    const launcherProps = launcherElement.props as Readonly<{readonly children: ReactElement}>
    expect(launcherProps.children).toBe(contentMarker)
  })
})
