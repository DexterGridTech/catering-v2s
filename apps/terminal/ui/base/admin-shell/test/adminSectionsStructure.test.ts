import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as ts from 'typescript';
import {describe, expect, it} from 'vitest';

const hookPath = fileURLToPath(new URL('../src/hooks/useAdminSections.ts', import.meta.url));

const readSource = (filePath: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.ES2023,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const resolveLocalImport = (fromPath: string, specifier: string): string | undefined => {
  const basePath = resolve(dirname(fromPath), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    resolve(basePath, 'index.ts'),
    resolve(basePath, 'index.tsx'),
  ];
  return candidates.find(candidate => existsSync(candidate));
};

const localDependencyClosure = (rootPath: string): readonly ts.SourceFile[] => {
  const pending = [rootPath];
  const seen = new Set<string>();
  const sources: ts.SourceFile[] = [];
  while (pending.length > 0) {
    const currentPath = pending.shift()!;
    if (seen.has(currentPath)) continue;
    seen.add(currentPath);
    const source = readSource(currentPath);
    sources.push(source);
    for (const statement of source.statements) {
      const moduleSpecifier =
        ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) ? statement.moduleSpecifier : undefined;
      if (moduleSpecifier === undefined || !ts.isStringLiteral(moduleSpecifier)) continue;
      if (!moduleSpecifier.text.startsWith('.')) continue;
      const dependencyPath = resolveLocalImport(currentPath, moduleSpecifier.text);
      if (dependencyPath !== undefined) pending.push(dependencyPath);
    }
  }
  return sources;
};

const hasSurfaceFormRead = (source: ts.SourceFile): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'surfaceForm') {
      found = true;
      return;
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === 'surfaceForm'
    ) {
      found = true;
      return;
    }
    if (ts.isBindingElement(node)) {
      const names = [node.name, node.propertyName];
      if (names.some(name => name !== undefined && ts.isIdentifier(name) && name.text === 'surfaceForm')) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

describe('useAdminSections form-independence contract', () => {
  it('rejects surfaceForm reads across the hook local dependency closure', () => {
    const sources = localDependencyClosure(hookPath);
    expect(sources.map(source => source.fileName)).toContain(hookPath);
    expect(sources.every(source => !hasSurfaceFormRead(source))).toBe(true);
  });

  it('keeps every production admin surface as a named laptop/mobile UI with shared hooks only', () => {
    const sourceRoot = dirname(hookPath);
    const readComponent = (relativePath: string): string =>
      readFileSync(resolve(sourceRoot, '..', 'components', relativePath), 'utf8');
    const formFiles = [
      'AdminLayerLaptop.tsx',
      'AdminLayerMobile.tsx',
      'AdminLoginLaptop.tsx',
      'AdminLoginMobile.tsx',
      'AdminShellFrameLaptop.tsx',
      'AdminShellFrameMobile.tsx',
      'AdminPanelStateCardLaptop.tsx',
      'AdminPanelStateCardMobile.tsx',
      'AdminSectionContentLaptop.tsx',
      'AdminSectionContentMobile.tsx',
      'AdminSectionNavigationLaptop.tsx',
      'AdminSectionNavigationMobile.tsx',
      'sections/DisplayContextSectionLaptop.tsx',
      'sections/DisplayContextSectionMobile.tsx',
      'sections/PlatformPortsSectionLaptop.tsx',
      'sections/PlatformPortsSectionMobile.tsx',
      'sections/RuntimeSectionLaptop.tsx',
      'sections/RuntimeSectionMobile.tsx',
      'sections/TopologySectionLaptop.tsx',
      'sections/TopologySectionMobile.tsx',
      'PowerRoleConfirmationLaptop.tsx',
      'PowerRoleConfirmationMobile.tsx',
    ];
    for (const relativePath of formFiles) {
      const source = readComponent(relativePath);
      expect(source, relativePath).toMatch(/return \(|=> \(/);
      expect(source, relativePath).not.toContain('surfaceForm ===');
      expect(source, relativePath).not.toMatch(
        /from ['"](?:\.\/|\.\/sections\/)(?:AdminSectionContent|PlatformPortsSection|RuntimeSection|TopologySection|DisplayContextSection|PowerRoleConfirmation)['"]/,
      );
    }
    expect(readComponent('AdminLoginLaptop.tsx')).toContain('useAdminLogin');
    expect(readComponent('AdminLoginMobile.tsx')).toContain('useAdminLogin');
    expect(readComponent('AdminLayerLaptop.tsx')).toContain('AdminLoginLaptop');
    expect(readComponent('AdminLayerMobile.tsx')).toContain('AdminLoginMobile');
    expect(readComponent('PowerRoleConfirmationLaptop.tsx')).toContain('usePowerRoleConfirmation');
    expect(readComponent('PowerRoleConfirmationMobile.tsx')).toContain('usePowerRoleConfirmation');
    expect(readFileSync(resolve(sourceRoot, '..', 'parts', 'parts.ts'), 'utf8')).toContain(
      'rendererKey: `${spec.partKey}.${surfaceForm}`',
    );
    const publicIndex = readFileSync(resolve(sourceRoot, '..', 'index.ts'), 'utf8');
    expect(publicIndex).not.toMatch(/export \{Admin(?:Layer|Login|SectionNavigation|Shell)\}/);
    for (const compatibilityPath of [
      resolve(sourceRoot, '..', 'components', 'AdminLayer.tsx'),
      resolve(sourceRoot, '..', 'components', 'AdminLogin.tsx'),
      resolve(sourceRoot, '..', 'components', 'AdminShell.tsx'),
      resolve(sourceRoot, '..', 'components', 'AdminSectionNavigation.tsx'),
    ]) {
      expect(existsSync(compatibilityPath), compatibilityPath).toBe(false);
    }
    expect(existsSync(resolve(sourceRoot, '..', 'components', 'AdminSectionContent.tsx'))).toBe(false);
    expect(existsSync(resolve(sourceRoot, '..', 'components', 'sections', 'RuntimeSection.tsx'))).toBe(false);
    expect(existsSync(resolve(sourceRoot, '..', 'components', 'sections', 'TopologySection.tsx'))).toBe(false);
  });
});
