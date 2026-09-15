import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const listPages = [
  {
    path: 'features/business-entity-management/ui/BusinessEntityManagementPage.tsx',
    scope: 'operations-business-entity-',
  },
  {
    path: 'features/store-management/ui/StoreManagementPage.tsx',
    scope: 'operations-store',
  },
  {
    path: 'features/contract-management/ui/ContractManagementPage.tsx',
    scope: 'operations-contract',
  },
];

test('every operations extension-enabled list blocks stale recovery until a verified definition is available', () => {
  for (const {path, scope} of listPages) {
    const source = read(path);
    assert.match(source, /reconcileExtensionFilterValues\(/, path);
    assert.match(source, /previousFields = definitionQuery\.currentData\?\.definitions/, path);
    assert.match(source, /previousValues = filters\.extensionFilterValues/, path);
    assert.match(source, /formRef=\{filterFormRef\}/, path);
    assert.match(source, /title="筛选条件已按最新字段配置更新"/, path);
    assert.match(source, /onClose=\{\(\) => setExtensionRecoveryNotice\(false\)\}/, path);
    assert.match(source, /extensionListRecoveryNoticeTestId\(/, path);
    assert.match(source, /pagination\.setPage\(1\)/, path);
    assert.match(source, /void definitionQuery\s*\.refetch\(\)\s*\.then\(/, path);
    assert.match(source, /extensionRecoveryInProgress/, path);
    assert.match(source, /createExtensionFilterRecoveryState/, path);
    assert.match(source, /rememberStaleRevision/, path);
    assert.match(source, /const recovery = .*\.begin\(/s, path);
    assert.match(source, /isCurrentRecovery/, path);
    assert.match(source, /setExtensionRecoveryInProgress\(true\)/, path);
    assert.match(source, /extensionRecoveryFailed/, path);
    assert.match(source, /setExtensionRecoveryFailed\(true\)/, path);
    assert.match(source, /extensionRecoveryBlocked/, path);
    assert.match(source, /const definition = result\.data/, path);
    assert.match(source, /isExtensionDefinitionRevisionAtLeast\(definition, recovery\.expectedRevision\)/, path);
    assert.match(source, /errorCode === 'EXTENSION_DEFINITION_REVISION_STALE'/, path);
    assert.doesNotMatch(source, /\.catch\(\(\) => undefined\)\.finally\(/, path);
    assert.match(source, /ExtensionFilterInvalidSummary/, path);
    assert.match(source, /clearInvalidExtensionFilterFields/, path);
    assert.match(source, /onClear=/, path);
    assert.match(source, /useExtensionFilterInvalidFocus/, path);
    assert.match(source, /tabIndex=\{invalidFilterProblem\?\.invalidFields\?\.length \? -1/, path);
    assert.match(source, /extensionListInvalidSummaryTestId\(/, path);
    assert.match(
      source,
      /extensionFilterValues:\s*(?:value|values)\.extensionFilterValues as Record<string, unknown>/,
      path,
    );
    assert.doesNotMatch(source, /extensionFilterValues:\s*(?:value|values) as Record<string, unknown>/, path);
    assert.match(source, new RegExp(`operations-business-entity-|${scope}`), path);
    const extensionColumnPosition = source.indexOf('...extensionListAndSearchColumns');
    const statusColumnPosition = source.indexOf("title: '状态'", extensionColumnPosition);
    assert.ok(extensionColumnPosition >= 0, `${path}: missing extension columns`);
    assert.ok(statusColumnPosition > extensionColumnPosition, `${path}: extension columns must precede status`);
  }
});
