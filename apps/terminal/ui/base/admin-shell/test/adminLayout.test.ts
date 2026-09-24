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
  it('binds the active IA frame marker to the outer panel root', () => {
    for (const framePath of ['src/components/AdminShellFrameLaptop.tsx', 'src/components/AdminShellFrameMobile.tsx']) {
      const frame = readSource(framePath)
      const outerPanel = jsxOpenings(frame, 'PrimitiveContainer').find(node => attributeText(frame, node, 'testID')?.includes('adminFrameTestId'))
      expect(outerPanel, framePath).toBeDefined()
      expect(attributeText(frame, outerPanel!, 'layout')).toBe('layout="card"')
      expect(attributeText(frame, outerPanel!, 'style')).toContain('adminGeometry.shell')
      expect(frame.text).toContain("maxHeight: '100%'")
      expect(frame.text).toContain("overflow: 'hidden'")
      const panelFrame = jsxOpenings(frame, 'PrimitiveContainer').find(node => attributeText(frame, node, 'testID')?.includes('adminTestIds.panel.frame'))
      expect(panelFrame, framePath).toBeDefined()
      expect(frame.text.match(/adminFrameTestId\(/g)).toHaveLength(1)
    }
    for (const sectionPath of [
      'src/components/sections/PlatformPortsSectionLaptop.tsx',
      'src/components/sections/PlatformPortsSectionMobile.tsx',
      'src/components/sections/RuntimeSectionLaptop.tsx',
      'src/components/sections/RuntimeSectionMobile.tsx',
      'src/components/sections/TopologySectionLaptop.tsx',
      'src/components/sections/TopologySectionMobile.tsx',
    ]) {
      const section = readSource(sectionPath)
      const frameReporterSource = sectionPath.includes('RuntimeSection')
        ? readSource('src/hooks/useAdminRuntimeDisplay.ts').text
        : section.text
      expect(frameReporterSource, sectionPath).toContain('useReportAdminFrame')
      expect(section.text, sectionPath).not.toContain('adminFrameTestId(')
    }
  })

  it('keeps the admin root as a full canvas and laptop as an explicit row', () => {
    const frame = readSource('src/components/AdminShellFrameLaptop.tsx')
    const root = openingWithTestId(frame, 'adminTestIds.shell')
    expect(attributeText(frame, root, 'layout')).toBe('layout="fill"')
    expect(attributeText(frame, root, 'style')).toContain('adminGeometry.rootLaptop')

    const laptop = readSource('src/components/AdminShellLaptop.tsx')
    const workspace = jsxOpenings(laptop, 'PrimitiveGrid').find(node => attributeText(laptop, node, 'testID')?.includes('terminal.admin:workspace'))
    expect(workspace).toBeDefined()
    expect(attributeText(laptop, workspace!, 'style')).toContain('workspaceStyle')
    expect(laptop.text).toContain("flexDirection: 'row'")
    expect(laptop.text).toContain("flexWrap: 'nowrap'")
  })

  it('keeps mobile navigation as one controlled dropdown and all floating cards individually bounded', () => {
    const navigation = readSource('src/components/AdminSectionNavigationMobile.tsx')
    const mobileNav = jsxOpenings(navigation, 'PrimitiveDropdownSelect')[0]
    expect(mobileNav).toBeDefined()
    expect(attributeText(navigation, mobileNav!, 'testID')).toBe('testID="terminal.admin:navigation"')
    expect(navigation.text).toContain('const [open, setOpen] = useState(false)')
    expect(navigation.text).not.toContain('PrimitivePressOption')

    const cardPaths = [
      'src/components/AdminLoginLaptop.tsx',
      'src/components/AdminLoginMobile.tsx',
      '../render/src/components/SystemFailureNotice.tsx',
      '../../feature/sample-staff-auth/src/components/laptop/AuthNotice.tsx',
      '../../feature/sample-member-desk/src/components/laptop/DiscardConfirm.tsx',
      '../../feature/sample-member-desk/src/components/laptop/RegistryNotice.tsx',
      '../../feature/sample-member-desk/src/components/laptop/WaitingConfirm.tsx',
      '../../feature/sample-member-desk/src/components/laptop/WithdrawConfirm.tsx',
      'src/components/PowerRoleConfirmationLaptop.tsx',
      'src/components/PowerRoleConfirmationMobile.tsx',
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
      const cardOpening = boundedCard!
      expect(hasAttribute(card, cardOpening, 'elevated')).toBe(cardPath.includes('AdminLogin'))
    }
  })

  it('uses the shared surface keyboard without applying a second manual lift', () => {
    for (const loginPath of ['src/components/AdminLoginLaptop.tsx', 'src/components/AdminLoginMobile.tsx']) {
      const login = readSource(loginPath)
      expect(jsxOpenings(login, 'PrimitivePinInput'), loginPath).toHaveLength(1)
      expect(login.text, loginPath).toContain('useAdminLogin')
      expect(login.text, loginPath).not.toContain('useInputField')
      expect(login.text, loginPath).not.toContain('InputKeyboard')
      expect(login.text, loginPath).not.toContain('keyboardLift')
    }
    const hook = readSource('src/hooks/useAdminLogin.ts')
    expect(hook.text).not.toContain('keyboardPlacement')
    expect(hook.text).toContain('field.focus()')
    expect(hook.text).toContain('measureRef: field.visibleAnchorRef')
  })

  it('keeps the login owner responsible for both surface-dismiss event guards', () => {
    const hook = readSource('src/hooks/useAdminLogin.ts')
    expect(hook.text).toContain('const stopSurfaceDismiss = (event: PrimitivePinInputInteractionEvent) => event.stopPropagation()')
    for (const loginPath of ['src/components/AdminLoginLaptop.tsx', 'src/components/AdminLoginMobile.tsx']) {
      const login = readSource(loginPath)
      expect(login.text, loginPath).toContain('<PrimitivePinInput {...login.passwordInput} />')
      expect(login.text, loginPath).toContain('useAdminLogin')
    }
  })

  it('keeps each content section as the bounded scroll owner', () => {
    for (const sectionPath of [
      'src/components/sections/SampleSection.tsx',
      'src/components/sections/PlatformPortsSectionLaptop.tsx',
      'src/components/sections/PlatformPortsSectionMobile.tsx',
      'src/components/sections/RuntimeSectionLaptop.tsx',
      'src/components/sections/RuntimeSectionMobile.tsx',
      'src/components/sections/TopologySectionLaptop.tsx',
      'src/components/sections/TopologySectionMobile.tsx',
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
