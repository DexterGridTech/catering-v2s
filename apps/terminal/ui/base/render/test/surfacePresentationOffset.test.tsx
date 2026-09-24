import {Animated} from 'react-native'
import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {act, create, type ReactTestRenderer, type TestInstance} from 'react-test-renderer'
import ts from 'typescript'
import {describe, expect, it} from 'vitest'
import {SurfacePresentationOffsetProvider, useSurfacePresentationOffset} from '../src'

const OffsetProbe = ({onOffset}: Readonly<{readonly onOffset: (offset: ReturnType<typeof useSurfacePresentationOffset>) => void}>) => {
  const offset = useSurfacePresentationOffset()
  onOffset(offset)
  return <Animated.View testID="presentation-offset-probe" style={{transform: [{translateY: offset}]}} />
}

const productionSourceFiles = (directory: string): readonly string[] => readdirSync(directory, {withFileTypes: true})
  .flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return productionSourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })

const moduleSpecifiersIn = (sourceText: string, fileName: string): readonly string[] => {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [specifier] = node.arguments
      if (specifier !== undefined && ts.isStringLiteral(specifier)) specifiers.push(specifier.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return specifiers
}

describe('surface presentation offset bridge', () => {
  it('keeps the render foundation independent from input package imports', () => {
    const sourceDirectory = fileURLToPath(new URL('../src', import.meta.url))
    const forbiddenImports = productionSourceFiles(sourceDirectory).flatMap(fileName =>
      moduleSpecifiersIn(readFileSync(fileName, 'utf8'), fileName)
        .filter(specifier => specifier === '@catering-v2s/ui-base-input'
          || specifier.startsWith('@catering-v2s/ui-base-input/')
          || /(?:^|\/)(?:ui-base-input|input)(?:\/|$)/.test(specifier))
        .map(specifier => ({fileName, specifier})),
    )

    expect(forbiddenImports).toEqual([])
  })

  it('defaults to zero when no input frame provider is mounted', () => {
    let offset: ReturnType<typeof useSurfacePresentationOffset> | null = null
    let renderer: ReactTestRenderer | undefined
    act(() => { renderer = create(<OffsetProbe onOffset={value => { offset = value }} />) })

    expect(offset).toBe(0)
    const probe = renderer!.root.findByProps({testID: 'presentation-offset-probe'})
    const style = probe.props.style as Readonly<{readonly transform: readonly Readonly<{readonly translateY: unknown}>[]}>
    expect(style.transform).toEqual([
      {translateY: 0},
    ])
    act(() => { renderer!.unmount() })
  })

  it('passes the frame-owned animated offset node through without creating a second value', () => {
    const offsetNode = new Animated.Value(-120)
    let offset: ReturnType<typeof useSurfacePresentationOffset> | null = null
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        <SurfacePresentationOffsetProvider offset={offsetNode}>
          <OffsetProbe onOffset={value => { offset = value }} />
        </SurfacePresentationOffsetProvider>,
      )
    })

    expect(offset).toBe(offsetNode)
    const probe = renderer!.root.findByProps({testID: 'presentation-offset-probe'}) as TestInstance
    const style = probe.props.style as Readonly<{readonly transform: readonly Readonly<{readonly translateY: unknown}>[]}>
    expect(style.transform[0].translateY).toBe(offsetNode)
    act(() => { renderer!.unmount() })
  })
})
