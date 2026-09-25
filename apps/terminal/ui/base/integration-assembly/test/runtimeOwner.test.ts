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
import {
  defineActor,
  defineCommand,
  onCommand,
  type RuntimeModuleContext,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {createIntegrationAssembly} from '../src/foundations/integrationAssembly'

const moduleName = 'test.console-owner-retry'
const startupReadyCommand = defineCommand<Readonly<{readonly ready: boolean}>>(moduleName, {
  name: 'startup-ready',
  visibility: 'public',
})

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
})

describe('console assembly runtime owner recovery', () => {
  it('retains a failed runtime, releases its resources, and replaces it with fresh modules', async () => {
    const events: unknown[] = []
    let installAttempts = 0
    let cleanupCalls = 0
    const platformPorts = createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {kind: 'sink', write: event => { events.push(event) }},
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

    const createApplicationModule = (): RuntimeModule => {
      const actor = defineActor(moduleName, 'startup-ready', [
        onCommand(startupReadyCommand, () => ({completed: true})),
      ])
      return Object.freeze({
        moduleName,
        kind: 'owner' as const,
        dependencies: [],
        commands: [{name: startupReadyCommand.commandName, visibility: startupReadyCommand.visibility}],
        actors: [{name: 'startup-ready'}],
        commandDefinitions: [startupReadyCommand],
        actorDefinitions: [actor],
        install: (context: RuntimeModuleContext) => {
          installAttempts += 1
          context.registerResource(() => { cleanupCalls += 1 })
          if (installAttempts === 1) throw new Error('first runtime install fails')
        },
      })
    }

    const assembly = await createIntegrationAssembly({
      appName: 'test-console-owner',
      errorPrefix: 'test-console-owner',
      runtimeName: 'test-console-owner',
      defaultPersistenceKey: 'test-console-owner',
      platformPorts,
      nativeLoadingCapability,
      surfaceForm: 'laptop',
      surfaceDeclarations: {PRIMARY: {width: 1280, height: 800}},
      parts: [],
      layerDismissals: {},
      variables: [],
      startupReadyCommand,
      createStartupReadyPayload: () => ({ready: true}),
      createApplicationModules: () => [createApplicationModule()],
    })

    const failedRuntime = assembly.runtime
    expect(failedRuntime.status).toBe('failed')
    expect(installAttempts).toBe(1)
    expect(cleanupCalls).toBe(1)
    expect(events).toEqual(expect.any(Array))

    const firstRetry = assembly.retryRuntime()
    const concurrentRetry = assembly.retryRuntime()
    expect(concurrentRetry).toBe(firstRetry)
    await firstRetry

    const recoveredRuntime = assembly.runtime
    expect(recoveredRuntime.status).toBe('started')
    expect(recoveredRuntime.runtimeId).not.toBe(failedRuntime.runtimeId)
    expect(installAttempts).toBe(2)
    expect(cleanupCalls).toBe(1)

    await assembly.retryRuntime()
    expect(assembly.runtime).toBe(recoveredRuntime)
    expect(installAttempts).toBe(2)
  })
})
