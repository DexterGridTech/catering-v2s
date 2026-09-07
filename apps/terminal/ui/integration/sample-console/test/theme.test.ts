import {readFileSync} from 'node:fs'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {createSampleAssembly, createSurfaceForDisplayIndex} from '../src'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {createTestPlatformPorts} from './support'

describe('sample-console app theme wiring', () => {
  it('maps every primitive semantic token to this app theme', () => {
    const css = readFileSync(new URL('../theme/global.css', import.meta.url), 'utf8')
    const tailwind = readFileSync(new URL('../tailwind.config.cjs', import.meta.url), 'utf8')
    const primitiveTokens = readFileSync(new URL('../../../base/primitives/src/theme/tokens.ts', import.meta.url), 'utf8')
    const semanticNames = [
      'canvas',
      'surface',
      'foreground',
      'muted-foreground',
      'border',
      'action',
      'action-foreground',
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
  })

  it('renders the app surface through the primitive semantic token path', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-theme-test-${Date.now()}`,
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
