import {readFileSync} from 'node:fs'
import * as ts from 'typescript'
import {describe, expect, it} from 'vitest'

const readSource = (relativePath: string): ts.SourceFile => {
  const url = new URL(`../${relativePath}`, import.meta.url)
  return ts.createSourceFile(relativePath, readFileSync(url, 'utf8'), ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX)
}

const jsxOpenings = (source: ts.SourceFile, tagName: string): readonly ts.JsxOpeningLikeElement[] => {
  const result: ts.JsxOpeningLikeElement[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === tagName) {
      result.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

const attributeText = (source: ts.SourceFile, opening: ts.JsxOpeningLikeElement, name: string): string | undefined => {
  const attribute = opening.attributes.properties.find(property =>
    ts.isJsxAttribute(property) && property.name.getText(source) === name,
  )
  return attribute === undefined ? undefined : attribute.getText(source)
}

const hasAttribute = (source: ts.SourceFile, opening: ts.JsxOpeningLikeElement, name: string): boolean =>
  opening.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(source) === name)

const descendantOpenings = (node: ts.Node): readonly ts.JsxOpeningLikeElement[] => {
  const result: ts.JsxOpeningLikeElement[] = []
  const visit = (current: ts.Node): void => {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) result.push(current)
    ts.forEachChild(current, visit)
  }
  visit(node)
  return result
}

const openingWithTestId = (source: ts.SourceFile, testId: string): ts.JsxOpeningLikeElement => {
  const opening = jsxOpenings(source, 'PrimitiveContainer').find(node => attributeText(source, node, 'testID')?.includes(testId))
  if (opening === undefined) throw new Error(`missing PrimitiveContainer testID=${testId}`)
  return opening
}

describe('admin layout structural contract', () => {
  it('keeps the admin root as a full canvas and laptop as an explicit row', () => {
    const frame = readSource('src/components/AdminShellFrame.tsx')
    const root = openingWithTestId(frame, 'adminTestIds.shell')
    expect(attributeText(frame, root, 'layout')).toBe('layout="fill"')
    expect(attributeText(frame, root, 'style')).toContain('rootStyle')

    const laptop = readSource('src/components/AdminShellLaptop.tsx')
    const workspace = jsxOpenings(laptop, 'PrimitiveGrid').find(node => attributeText(laptop, node, 'testID')?.includes('terminal.admin:workspace'))
    expect(workspace).toBeDefined()
    expect(attributeText(laptop, workspace!, 'style')).toContain('workspaceStyle')
    expect(laptop.text).toContain("flexDirection: 'row'")
    expect(laptop.text).toContain("flexWrap: 'nowrap'")
  })

  it('keeps mobile navigation wrapped and all floating cards individually bounded', () => {
    const navigation = readSource('src/components/AdminSectionNavigation.tsx')
    const mobileNav = jsxOpenings(navigation, 'PrimitiveGrid')[0]
    expect(attributeText(navigation, mobileNav!, 'style')).toContain('flexWrap: \'wrap\'')

    const cardPaths = [
      'src/components/AdminLogin.tsx',
      '../render/src/components/SystemFailureNotice.tsx',
      '../../feature/sample-staff-auth/src/components/AuthNotice.tsx',
      '../../feature/sample-member-desk/src/components/DiscardConfirm.tsx',
      '../../feature/sample-member-desk/src/components/RegistryNotice.tsx',
      '../../feature/sample-member-desk/src/components/WaitingConfirm.tsx',
      '../../feature/sample-member-desk/src/components/WithdrawConfirm.tsx',
      'src/components/PowerRoleConfirmation.tsx',
    ]
    for (const cardPath of cardPaths) {
      const card = readSource(cardPath)
      const centers = jsxOpenings(card, 'PrimitiveCenter')
      expect(centers, cardPath).toHaveLength(1)
      const center = centers[0]!
      const centerStyle = attributeText(card, center, 'style')
      expect(centerStyle, cardPath).toBeDefined()
      const owningFrameSource = centerStyle === 'style={layerFrameStyle}' ? card.text : centerStyle!
      expect(owningFrameSource, cardPath).toContain('flex')
      expect(owningFrameSource, cardPath).toContain('minHeight')
      expect(owningFrameSource, cardPath).toContain('padding')
      expect(owningFrameSource, cardPath).not.toContain('maxWidth')
      const centerElement = ts.isJsxElement(center.parent) && center.parent.openingElement === center
        ? center.parent
        : undefined
      const boundedCard = centerElement === undefined
        ? undefined
        : descendantOpenings(centerElement).find(node =>
          node !== center
          && attributeText(card, node, 'layout') === 'layout="card"'
          && hasAttribute(card, node, 'bounded'),
        )
      expect(boundedCard, `${cardPath} must own its bounded card inside its center frame`).toBeDefined()
    }
  })

  it('uses the shared surface keyboard and lifts the admin login card', () => {
    const login = readSource('src/components/AdminLogin.tsx')
    const loginCard = openingWithTestId(login, '`${adminTestIds.login}:card`')
    const cardElement = loginCard.parent
    expect(cardElement).toBeDefined()
    const descendants = cardElement === undefined ? [] : descendantOpenings(cardElement)
    expect(descendants.some(node => node.tagName.getText(login) === 'InputKeyboard')).toBe(false)
    expect(jsxOpenings(login, 'InputKeyboard')).toHaveLength(0)
    expect(login.text).toContain("keyboardPlacement: 'surface'")
    expect(login.text).toContain('translateY: -keyboardLift')
  })

  it('keeps each content section as the bounded scroll owner', () => {
    for (const sectionPath of [
      'src/components/sections/SampleSection.tsx',
      'src/components/sections/PlatformPortsSection.tsx',
      'src/components/sections/RuntimeSection.tsx',
      'src/components/sections/DisplayContextSection.tsx',
      'src/components/sections/TopologySection.tsx',
    ]) {
      const section = readSource(sectionPath)
      const root = jsxOpenings(section, 'PrimitiveContainer')[0]
      expect(root, sectionPath).toBeDefined()
      expect(attributeText(section, root!, 'layout')).toBe('layout="content"')
      expect(hasAttribute(section, root!, 'bounded')).toBe(true)
      expect(attributeText(section, root!, 'style')).toContain('sectionStyle')
    }
  })
})
