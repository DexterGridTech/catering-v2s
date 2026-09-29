import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function sourceFiles(root) {
  const result = [];
  const terminalRoot = path.join(root, 'apps/terminal');
  const visit = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['node_modules', '.git', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.(?:ts|tsx|mts|cts)$/.test(entry.name)) result.push(entryPath);
    }
  };
  // Full-repository runs use apps/terminal, while checker model tests copy a
  // single package into a temporary root.  In the latter shape there is no
  // apps/terminal directory, so include the fixture root itself to resolve
  // relative imports and symbol origins instead of silently dropping them.
  visit(fs.existsSync(terminalRoot) ? terminalRoot : root);
  return result.sort();
}

function resolveAliasedSymbol(checker, symbol) {
  let current = symbol;
  const seen = new Set();
  while (current && current.flags & ts.SymbolFlags.Alias && !seen.has(current)) {
    seen.add(current);
    const next = checker.getAliasedSymbol(current);
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

/**
 * Resolve the value symbol reached by a small expression used as a manifest
 * field.  This intentionally follows only value aliases that TypeScript can
 * resolve without data-flow analysis (property/element access and one-hop or
 * chained const aliases).  Callers can then compare the resulting symbol
 * identity and declaration origin instead of trusting identifier text.
 */
function resolveValueExpressionSymbol(checker, expression, seen = new Set()) {
  if (!expression) return null;
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  const symbolAtExpression = checker.getSymbolAtLocation(current);
  if (!symbolAtExpression) return null;
  const resolved = resolveAliasedSymbol(checker, symbolAtExpression);
  if (!resolved || seen.has(resolved)) return resolved;
  seen.add(resolved);
  const declaration =
    resolved.valueDeclaration ?? resolved.declarations?.find(candidate => ts.isVariableDeclaration(candidate));
  if (declaration && ts.isBindingElement(declaration)) {
    const variable = declaration.parent?.parent;
    const initializer = variable && ts.isVariableDeclaration(variable) ? variable.initializer : null;
    const bindingName = declaration.propertyName ?? declaration.name;
    if (initializer && (ts.isIdentifier(bindingName) || ts.isStringLiteral(bindingName))) {
      const objectType = checker.getTypeAtLocation(initializer);
      const property = checker.getPropertyOfType(objectType, bindingName.text);
      if (property) {
        const nested = resolveValueExpressionSymbol(
          checker,
          property.valueDeclaration ?? property.declarations?.[0],
          seen,
        );
        return nested ?? resolveAliasedSymbol(checker, property);
      }
    }
  }
  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
    const nested = resolveValueExpressionSymbol(checker, declaration.initializer, seen);
    if (nested) return nested;
  }
  return resolved;
}

function moduleSymbol(checker, sourceFile) {
  return checker.getSymbolAtLocation(sourceFile);
}

function packageModulePath(root, moduleName) {
  const segments = moduleName.split('.');
  if (segments.length !== 3) throw new Error(`invalid module name ${moduleName}`);
  return path.join(root, 'apps/terminal', ...segments);
}

export function createAnalysisProgram(root) {
  const files = sourceFiles(root);
  return {
    files,
    program: ts.createProgram(files, {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    }),
  };
}

export function assertNoSyntacticDiagnostics(analysis, root) {
  const diagnostics = analysis.program.getSyntacticDiagnostics();
  if (diagnostics.length === 0) return;
  const messages = diagnostics.map(diagnostic => {
    const sourcePath = diagnostic.file?.fileName;
    const location =
      sourcePath && diagnostic.start !== undefined
        ? (() => {
            const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            return `${path.relative(root, sourcePath).split(path.sep).join('/')}:${position.line + 1}:${position.character + 1}`;
          })()
        : path
            .relative(root, sourcePath ?? '')
            .split(path.sep)
            .join('/');
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    return `TS${diagnostic.code} ${location}: ${message}`;
  });
  throw new Error(messages.join('\n'));
}

export function assertNoCompilerOptionsDiagnostics(analysis, root) {
  const diagnostics = analysis.program.getOptionsDiagnostics();
  if (diagnostics.length === 0) return;
  const messages = diagnostics.map(diagnostic => {
    const sourcePath = diagnostic.file?.fileName;
    const location = sourcePath ? path.relative(root, sourcePath).split(path.sep).join('/') : 'compiler-options';
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    return `TS${diagnostic.code} ${location}: ${message}`;
  });
  throw new Error(messages.join('\n'));
}

/**
 * Resolve an exported literal from a package's moduleName.ts. The returned
 * declaration must originate in that file; same-text constants in another
 * module are not accepted as the package's identity.
 */
export function resolveModuleNameExport({root, moduleName, exportName = 'moduleKind', analysis}) {
  const packageRoot = packageModulePath(root, moduleName);
  const sourcePath = path.join(packageRoot, 'src/moduleName.ts');
  if (!fs.existsSync(sourcePath)) return null;
  const context = analysis ?? createAnalysisProgram(root);
  const files = context.files;
  if (!files.includes(sourcePath)) files.push(sourcePath);
  const program = context.program;
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(sourcePath);
  if (!sourceFile) return null;
  const module = moduleSymbol(checker, sourceFile);
  if (!module) return null;
  const exported = checker.getExportsOfModule(module).find(symbol => symbol.name === exportName);
  if (!exported) return null;
  const symbol = resolveAliasedSymbol(checker, exported);
  const declaration = symbol?.declarations?.find(
    candidate => ts.isVariableDeclaration(candidate) && candidate.parent?.parent?.parent === sourceFile,
  );
  if (!declaration?.initializer) {
    throw new Error(`${moduleName} ${exportName} must be declared in ${path.relative(root, sourcePath)}`);
  }
  let initializer = declaration.initializer;
  while (
    ts.isAsExpression(initializer) ||
    ts.isTypeAssertionExpression(initializer) ||
    ts.isParenthesizedExpression(initializer) ||
    ts.isSatisfiesExpression(initializer)
  ) {
    initializer = initializer.expression;
  }
  if (!ts.isStringLiteral(initializer) || !['owner', 'toolkit'].includes(initializer.text)) {
    throw new Error(`${moduleName} ${exportName} must be an owner/toolkit string literal`);
  }
  return {value: initializer.text, sourcePath, declaration, symbol};
}

/** Resolve a named import's symbol to its final declaration. */
export function resolveImportedSymbol({root, sourcePath, importName, moduleSpecifier, analysis}) {
  const context = analysis ?? createAnalysisProgram(root);
  const files = context.files;
  if (!files.includes(sourcePath)) files.push(sourcePath);
  const program = context.program;
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(sourcePath);
  if (!sourceFile) return null;
  const importDeclaration = sourceFile.statements.find(
    statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleSpecifier,
  );
  if (
    !importDeclaration?.importClause?.namedBindings ||
    !ts.isNamedImports(importDeclaration.importClause.namedBindings)
  )
    return null;
  const element = importDeclaration.importClause.namedBindings.elements.find(
    candidate => candidate.name.text === importName,
  );
  if (!element) return null;
  const symbol = checker.getSymbolAtLocation(element.name);
  if (!symbol) return null;
  return {program, checker, sourceFile, symbol: resolveAliasedSymbol(checker, symbol)};
}

export {resolveAliasedSymbol, resolveValueExpressionSymbol};
