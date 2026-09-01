import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {describe, expect, it} from 'vitest';

const uiDirectory = path.dirname(fileURLToPath(import.meta.url));

// This is the complete set of catalog-management TSX surfaces that can put
// hand-written text into a user-facing catalog task. Generated copy is checked
// separately by the P1 generator because it has a different source of truth.
const userVisibleSurfaceFiles = Object.freeze([
  'BrandCatalogCopyDrawer.tsx',
  'CatalogAssetPreview.tsx',
  'CatalogBatchOutcome.tsx',
  'CatalogConfigurationDrawerSurface.tsx',
  'CatalogConfigurationLibraryNavigation.tsx',
  'CatalogDefinitionLibraries.tsx',
  'CatalogDescriptorPicker.tsx',
  'CatalogDictionaryDrawerState.tsx',
  'CatalogDictionaryAtomModals.tsx',
  'CatalogSimpleDictionaryLibrary.tsx',
  'CatalogSkuAttributeLibrary.tsx',
  'CatalogFactSectionBoundary.tsx',
  'CatalogInventoryBomView.tsx',
  'CatalogInventoryBomWorkbench.tsx',
  'CatalogItemAttributesEditor.tsx',
  'CatalogItemAttributesView.tsx',
  'CatalogItemBasicEditor.tsx',
  'CatalogItemBasicView.tsx',
  'CatalogItemCompositeEditor.tsx',
  'CatalogItemCompositeView.tsx',
  'CatalogItemCreateDrawer.tsx',
  'CatalogItemEditorDrawer.tsx',
  'CatalogItemEditorFieldPresentation.tsx',
  'CatalogItemEditorSectionAssembler.tsx',
  'CatalogItemEditorTabs.tsx',
  'CatalogItemEditorWorkspace.tsx',
  'CatalogItemGovernanceView.tsx',
  'CatalogItemIdentifiersEditor.tsx',
  'CatalogItemIdentifiersView.tsx',
  'CatalogItemInventoryBomEditor.tsx',
  'CatalogItemInventoryBomView.tsx',
  'CatalogItemListTable.tsx',
  'CatalogItemOrderOptionsEditor.tsx',
  'CatalogItemOrderOptionsView.tsx',
  'CatalogItemProductionEditor.tsx',
  'CatalogItemProductionView.tsx',
  'CatalogItemReadOnlyPresenters.tsx',
  'CatalogItemSkuSpecificationsEditor.tsx',
  'CatalogItemSkuSpecificationsView.tsx',
  'CatalogItemViewDrawer.tsx',
  'CatalogItemViewSections.tsx',
  'CatalogTemporaryPromotionTask.tsx',
  'controllers/CatalogWorkbenchController.tsx',
  'CatalogWorkbenchNavigationTree.tsx',
  'CatalogWorkbenchItemList.tsx',
  'CatalogWorkbenchToolbar.tsx',
  'controllers/useCatalogCategoryActionController.tsx',
  'controllers/useCatalogBatchActionController.ts',
  'controllers/useCatalogSkuRows.ts',
  'CatalogCategoryActionModal.tsx',
  'CatalogBatchActionModal.tsx',
  'LocalCatalogCopyDrawer.tsx',
  '../model/catalogModel.ts',
]);

const visibleAttributeNames = new Set([
  'title',
  'label',
  'placeholder',
  'description',
  'help',
  'extra',
  'okText',
  'cancelText',
  'checkedChildren',
  'unCheckedChildren',
  'aria-label',
  'tooltip',
  'emptyText',
]);

const forbiddenVocabulary: ReadonlyArray<readonly [string, RegExp]> = Object.freeze([
  ['SKU', /SKU/iu],
  ['预检', /预检/u],
  ['重新读取失败', /重新读取失败/u],
  ['商品类型', /商品类型/u],
  ['版本', /版本/u],
  ['shape', /\bshape\b/iu],
  ['scope', /\bscope\b/iu],
  ['owner', /\bowner\b/iu],
  ['contract', /\bcontract\b/iu],
  ['ref', /\bref\b/iu],
  ['UUID', /\buuid\b/iu],
  ['profile', /\bprofile\b/iu],
  ['effect', /\beffect\b/iu],
  ['payload', /\bpayload\b/iu],
  ['readback', /\breadback\b/iu],
  ['problem code', /\bproblem\s+code\b/iu],
  ['manifest', /\bmanifest\b/iu],
  ['raw exception', /\braw\s+exception\b/iu],
]);

function textOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function visibleTextFromExpression(node: ts.Expression): string[] {
  const direct = textOf(node);
  if (direct !== null) return [direct];
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return visibleTextFromExpression(node.expression);
  }
  if (ts.isConditionalExpression(node)) {
    return [...visibleTextFromExpression(node.whenTrue), ...visibleTextFromExpression(node.whenFalse)];
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsToken &&
    node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
    node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsToken &&
    node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken
  ) {
    return [...visibleTextFromExpression(node.left), ...visibleTextFromExpression(node.right)];
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap(property => {
      if (!ts.isPropertyAssignment(property)) return [];
      const name = property.name.getText();
      return visibleAttributeNames.has(name) ? visibleTextFromExpression(property.initializer) : [];
    });
  }
  return [];
}

function visibleTexts(source: string, fileName: string): string[] {
  const result: string[] = [];
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const userVisibleCopyTexts = (node: ts.Expression): string[] => {
    const direct = textOf(node);
    if (direct !== null) return [direct];
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node))
      return userVisibleCopyTexts(node.expression);
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(element => userVisibleCopyTexts(element));
    if (ts.isObjectLiteralExpression(node))
      return node.properties.flatMap(property =>
        ts.isPropertyAssignment(property) ? userVisibleCopyTexts(property.initializer) : [],
      );
    return [];
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.includes('USER_VISIBLE_COPY') &&
      node.initializer
    ) {
      result.push(...userVisibleCopyTexts(node.initializer));
    }
    if (ts.isJsxText(node)) {
      const value = node.getText(sourceFile).replace(/\s+/gu, ' ').trim();
      if (value) result.push(value);
    }
    if (ts.isJsxAttribute(node) && visibleAttributeNames.has(node.name.getText(sourceFile)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) result.push(node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        result.push(...visibleTextFromExpression(node.initializer.expression));
      }
    }
    if (ts.isJsxExpression(node) && node.expression) result.push(...visibleTextFromExpression(node.expression));
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

function forbiddenHits(source: string, fileName: string): string[] {
  return visibleTexts(source, fileName).flatMap(value =>
    forbiddenVocabulary
      .filter(([, expression]) => expression.test(value))
      .map(([term]) => `${fileName}:${term}:${value}`),
  );
}

describe('catalog user-visible vocabulary', () => {
  it('keeps hand-written catalog UI copy in business language', () => {
    const hits = userVisibleSurfaceFiles.flatMap(fileName =>
      forbiddenHits(readFileSync(path.join(uiDirectory, fileName), 'utf8'), fileName),
    );
    expect(hits).toEqual([]);
  });

  it('turns red when a forbidden term is rendered instead of only appearing in implementation code', () => {
    const redFixture = '<Button title="按 SKU 管理商品">SKU</Button>';
    expect(forbiddenHits(redFixture, 'red-fixture.tsx')).toEqual([
      'red-fixture.tsx:SKU:按 SKU 管理商品',
      'red-fixture.tsx:SKU:SKU',
    ]);
  });

  it('turns red when a forbidden term is hidden in a runtime user-visible copy map', () => {
    const redFixture = 'const EXAMPLE_USER_VISIBLE_COPY = {description: "按 SKU 管理商品"};';
    expect(forbiddenHits(redFixture, 'red-runtime-copy.ts')).toEqual(['red-runtime-copy.ts:SKU:按 SKU 管理商品']);
  });
});
