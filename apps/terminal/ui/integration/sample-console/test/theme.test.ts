import {readFileSync} from 'node:fs'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {createSampleAssembly as createProductionSampleAssembly, createSurfaceForDisplayIndex} from '../src'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {createTestPlatformPorts, type TestPlatformPorts} from './support'

type TestSampleAssemblyInput = Omit<Parameters<typeof createProductionSampleAssembly>[0], 'platformPorts' | 'nativeLoadingCapability'> & Readonly<{
  readonly platformPorts: TestPlatformPorts
}>

const createSampleAssembly = (input: TestSampleAssemblyInput) => createProductionSampleAssembly({
  ...input,
  nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
})

describe('sample-console app theme wiring', () => {
  it('maps every primitive semantic token to this app theme', () => {
    const css = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8')
    const tailwind = readFileSync(new URL('../tailwind.config.cjs', import.meta.url), 'utf8')
    const primitiveTokens = readFileSync(new URL('../../../base/primitives/src/theme/tokens.ts', import.meta.url), 'utf8')
    const semanticNames = [
      'canvas',
      'surface',
      'surface-elevated',
      'surface-inset',
      'foreground',
      'muted-foreground',
      'border',
      'action',
      'action-foreground',
      'focus',
      'ok-foreground',
      'ok-background',
      'ok-border',
      'warn-foreground',
      'warn-background',
      'warn-border',
      'error-foreground',
      'error-background',
      'error-border',
      'info-foreground',
      'info-background',
      'info-border',
      'keyboard-surface',
      'keyboard-key',
      'keyboard-action',
      'keyboard-key-foreground',
      'keyboard-action-foreground',
      'keyboard-border',
      'keyboard-focus',
    ]

    for (const semanticName of semanticNames) {
      expect(tailwind.includes(`${semanticName}:`) || tailwind.includes(`'${semanticName}':`)).toBe(true)
      expect(css).toContain(`--color-${semanticName}:`)
    }
    expect(primitiveTokens).toContain('bg-canvas')
    expect(primitiveTokens).toContain('text-foreground')
    expect(primitiveTokens).toContain('border-border')
    expect(primitiveTokens).toContain('bg-action')
    expect(primitiveTokens).toContain('text-action-foreground')
    expect(primitiveTokens).toContain('bg-transparent')
    expect(primitiveTokens).toContain('bg-keyboard-surface')
    expect(primitiveTokens).toContain('bg-keyboard-key')
    expect(primitiveTokens).toContain('bg-keyboard-action')
    expect(primitiveTokens).toContain('border-keyboard-focus')
  })

  it('keeps focus treatment owned by each integration theme', () => {
    const sampleConsoleCss = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8')
    const wallpaperCss = readFileSync(new URL('../../sample-wallpaper-console/theme/global.css', import.meta.url), 'utf8')
    const token = (source: string, name: string): string => {
      const match = source.match(new RegExp(`--color-${name}:\\s*([^;]+)`))
      if (match === null) throw new Error(`missing token ${name}`)
      return match[1]!.trim()
    }
    expect(token(sampleConsoleCss, 'focus')).not.toBe(token(wallpaperCss, 'focus'))
  })

  it('keeps keyboard planes neutral and lets focus follow the integration theme', () => {
    const sampleConsoleCss = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8')
    const wallpaperCss = readFileSync(new URL('../../sample-wallpaper-console/theme/global.css', import.meta.url), 'utf8')
    const token = (source: string, name: string): string => {
      const match = source.match(new RegExp(`--color-${name}:\\s*([^;]+)`))
      if (match === null) throw new Error(`missing token ${name}`)
      return match[1]!.trim()
    }
    for (const name of [
      'keyboard-surface',
      'keyboard-key',
      'keyboard-action',
      'keyboard-key-foreground',
      'keyboard-action-foreground',
      'keyboard-border',
    ]) {
      expect(token(sampleConsoleCss, name)).toBe(token(wallpaperCss, name))
    }
    expect(token(sampleConsoleCss, 'keyboard-key')).toBe(token(sampleConsoleCss, 'keyboard-action'))
    expect(token(sampleConsoleCss, 'keyboard-focus')).not.toBe(token(wallpaperCss, 'keyboard-focus'))
  })

  it('renders the app surface through the primitive semantic token path', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-theme-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let renderer: ReactTestRenderer | undefined
    try {
      act(() => {
        renderer = create(createSurfaceForDisplayIndex(assembly, 0))
      })
      const canvasNodes = renderer!.root.findAll(node =>
        typeof node.props.className === 'string'
        && node.props.className.split(/\s+/).includes('bg-canvas'),
      )
      expect(canvasNodes.length).toBeGreaterThan(0)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })
})
