import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const adminTokens = [
  'admin-shell-surface',
  'admin-shell-foreground',
  'admin-shell-muted',
  'admin-shell-border',
  'admin-content-surface',
  'admin-content-foreground',
  'admin-content-muted',
  'admin-content-border',
  'admin-ratio-undeclared',
  'admin-inset',
  'admin-action',
  'admin-action-start',
  'admin-action-end',
  'admin-action-foreground',
  'admin-focus',
  'admin-surface-current',
  'admin-surface-noncurrent',
] as const

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')

const cssPath = (name: string): string => `../../../integration/${name}/theme/global.css`
const tailwindPath = (name: string): string => `../../../integration/${name}/tailwind.config.cjs`

const cssTokens = (source: string): readonly string[] => [...source.matchAll(/--color-(admin-[a-z-]+)\s*:/g)].map(match => match[1]!)
const tailwindTokens = (source: string): readonly string[] => [...source.matchAll(/['"](admin-[a-z-]+)['"]\s*:/g)].map(match => match[1]!)

describe('admin theme token contract', () => {
  it('keeps both integration CSS variables and Tailwind mappings in the same 17-token set', () => {
    const expected = [...adminTokens].sort()
    for (const integration of ['sample-console', 'sample-wallpaper-console']) {
      expect([...new Set(cssTokens(read(cssPath(integration))))].sort()).toEqual(expected)
      expect([...new Set(tailwindTokens(read(tailwindPath(integration))))].sort()).toEqual(expected)
      for (const token of adminTokens) {
        expect(read(cssPath(integration))).toContain(`--color-${token}:`)
        expect(read(tailwindPath(integration))).toContain(`'${token}': 'rgb(var(--color-${token}) / <alpha-value>)'`)
      }
    }
  })
})
