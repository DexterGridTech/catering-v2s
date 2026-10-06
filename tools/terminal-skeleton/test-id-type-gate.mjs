import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createAnalysisProgram, resolveAliasedSymbol} from '../terminal-shared/typescript-analysis.mjs';

const isProductionTerminalSource = (sourceFile, terminalRoot) => {
  if (!/\.tsx?$/.test(sourceFile.fileName) || sourceFile.fileName.endsWith('.d.ts')) return false;
  const relative = path.relative(terminalRoot, sourceFile.fileName);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  const segments = relative.split(path.sep);
  return segments.includes('src') && !segments.some(segment => segment === 'test' || segment === '__tests__');
};

const isAny = type => (type.flags & ts.TypeFlags.Any) !== 0;

const samePhysicalFile = (left, right) => {
  try {
    return fs.realpathSync.native(left) === fs.realpathSync.native(right);
  } catch {
    return false;
  }
};

const isCanonicalTestIdType = (type, constructorPath) => {
  if (type.aliasSymbol?.name !== 'TestId') return false;
  return type.getProperties().some(property =>
    property.name.includes('testIdTypeMarker') &&
    property.declarations?.some(declaration => samePhysicalFile(declaration.getSourceFile().fileName, constructorPath)),
  );
};

const targetsTestId = (checker, typeNode, testIdSymbol) => {
  const symbol = checker.getSymbolAtLocation(typeNode);
  if (symbol && resolveAliasedSymbol(checker, symbol) === testIdSymbol) return true;
  const type = checker.getTypeFromTypeNode(typeNode);
  return type.aliasSymbol === testIdSymbol || type.symbol === testIdSymbol;
};

export const runTestIdTypeGate = ({root, analysis: existingAnalysis}) => {
  const terminalRoot = path.join(root, 'apps/terminal');
  const constructorPath = path.join(terminalRoot, 'ui/base/primitives/src/foundations/testId.ts');
  const analysis = existingAnalysis ?? createAnalysisProgram(root);
  const checker = analysis.program.getTypeChecker();
  const constructorFile = analysis.program.getSourceFile(constructorPath);
  if (!constructorFile) throw new Error('TER_TEST_ID_CONSTRUCTOR_SOURCE_MISSING');
  const constructorDeclaration = constructorFile.statements.find(
    statement => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'TestId',
  );
  if (!constructorDeclaration) throw new Error('TER_TEST_ID_TYPE_DECLARATION_MISSING');
  const testIdSymbol = checker.getSymbolAtLocation(constructorDeclaration.name);
  if (!testIdSymbol) throw new Error('TER_TEST_ID_TYPE_UNRESOLVED');

  const violations = [];
  let checkedAttributes = 0;
  for (const sourceFile of analysis.program.getSourceFiles()) {
    if (!isProductionTerminalSource(sourceFile, terminalRoot)) continue;
    const relative = path.relative(root, sourceFile.fileName).split(path.sep).join('/');
    const visit = node => {
      if (
        sourceFile.fileName.endsWith('.tsx') &&
        ts.isJsxAttribute(node) &&
        (node.name.getText(sourceFile) === 'testID' || node.name.getText(sourceFile) === 'testId')
      ) {
        checkedAttributes += 1;
        const initializer = node.initializer;
        const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
        const type = expression ? checker.getTypeAtLocation(expression) : undefined;
        if (!type || isAny(type) || !isCanonicalTestIdType(type, constructorPath)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const actual = type ? checker.typeToString(type) : 'unknown';
          violations.push(`${relative}:${position.line + 1}:TER_TEST_ID_TYPE_MISMATCH(actual=${actual})`);
        }
      }
      if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && sourceFile.fileName !== constructorPath) {
        if (targetsTestId(checker, node.type, testIdSymbol)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push(`${relative}:${position.line + 1}:TER_TEST_ID_CAST_OUTSIDE_FACTORY`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  if (checkedAttributes === 0) throw new Error('TER_TEST_ID_PRODUCTION_ATTRIBUTES_NOT_FOUND');
  if (violations.length) throw new Error(violations.join('; '));
  return Object.freeze({checkedAttributes});
};
