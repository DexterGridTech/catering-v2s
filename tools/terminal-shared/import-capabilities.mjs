import ts from 'typescript'

function importTypeModuleName(node) {
  if (!ts.isLiteralTypeNode(node.argument) || !ts.isStringLiteral(node.argument.literal)) return undefined
  return node.argument.literal.text
}

function importTypeName(node) {
  if (node.qualifier === undefined) return '*'
  const text = node.qualifier.getText(node.getSourceFile())
  return text.split('.').at(-1) ?? text
}

export function collectImportedCapabilities(sourceFile) {
  const capabilities = []
  const add = (node, moduleName, importedName, localName, kind) => {
    capabilities.push({node, moduleName, importedName, localName, kind})
  }

  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text
      const clause = node.importClause
      if (clause === undefined) {
        add(node, moduleName, '*', '*', 'side-effect')
      } else {
        if (clause.name !== undefined) add(node, moduleName, 'default', clause.name.text, 'default')
        if (clause.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)) {
          add(node, moduleName, '*', clause.namedBindings.name.text, 'namespace')
        } else if (clause.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            const importedName = element.propertyName?.text ?? element.name.text
            add(node, moduleName, importedName, element.name.text, 'named')
          }
        }
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text
      if (node.exportClause === undefined || ts.isNamespaceExport(node.exportClause)) {
        add(node, moduleName, '*', '*', 're-export-namespace')
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const importedName = element.propertyName?.text ?? element.name.text
          add(node, moduleName, importedName, element.name.text, 're-export-named')
        }
      }
    } else if (ts.isImportTypeNode(node)) {
      const moduleName = importTypeModuleName(node)
      if (moduleName !== undefined) add(node, moduleName, importTypeName(node), importTypeName(node), 'type')
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      const moduleName = node.arguments[0].text
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        add(node, moduleName, '*', '*', 'dynamic-import')
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        add(node, moduleName, '*', '*', 'require')
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return capabilities
}

export function findImportCapabilityViolation(sourceFile, rules = {}) {
  const forbiddenModules = new Set(rules.forbiddenModules ?? [])
  const forbiddenNamespaceModules = new Set(rules.forbiddenNamespaceModules ?? [])
  const forbiddenImportedNames = new Set(rules.forbiddenImportedNames ?? [])
  const forbiddenImportedNamesByModule = rules.forbiddenImportedNamesByModule ?? {}
  const allowedImportedNamesByModule = rules.allowedImportedNamesByModule ?? {}

  for (const capability of collectImportedCapabilities(sourceFile)) {
    const moduleForbiddenNames = new Set(forbiddenImportedNamesByModule[capability.moduleName] ?? [])
    const moduleAllowedNames = new Set(allowedImportedNamesByModule[capability.moduleName] ?? [])
    if (forbiddenModules.has(capability.moduleName)) return capability
    const isNamespaceCapability = capability.kind === 'namespace'
      || capability.kind === 'dynamic-import'
      || capability.kind === 'require'
      || capability.kind === 're-export-namespace'
      || (capability.kind === 'type' && capability.importedName === '*')
    if (isNamespaceCapability && forbiddenNamespaceModules.has(capability.moduleName)) return capability
    if (forbiddenImportedNames.has(capability.importedName) && !moduleAllowedNames.has(capability.importedName)) {
      return capability
    }
    if (moduleForbiddenNames.has(capability.importedName) && !moduleAllowedNames.has(capability.importedName)) {
      return capability
    }
  }
  return undefined
}
