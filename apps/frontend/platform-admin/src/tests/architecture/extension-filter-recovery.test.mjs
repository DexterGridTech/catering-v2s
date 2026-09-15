import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../features/organization-contract-overview/ui/PlatformReadPage.tsx', import.meta.url),
  'utf8',
);

test('platform organization and contract lists block stale recovery until a verified definition is available', () => {
  for (const formRef of ['organizationFilterFormRef', 'contractFilterFormRef']) {
    assert.match(source, /reconcileExtensionFilterValues\(/, formRef);
    assert.match(source, new RegExp(`formRef=\\{${formRef}\\}`), formRef);
  }
  assert.match(source, /title="筛选条件已按最新字段配置更新"/);
  assert.match(source, /extensionListRecoveryNoticeTestId\(/);
  assert.match(source, /organizationPagination\.setPage\(1\)/);
  assert.match(source, /contractPagination\.setPage\(1\)/);
  assert.match(source, /void organizationDefinitionQuery\s*\.refetch\(\)\s*\.then\(/);
  assert.match(source, /void contractDefinitionQuery\s*\.refetch\(\)\s*\.then\(/);
  assert.match(source, /organizationExtensionRecoveryInProgress/);
  assert.match(source, /contractExtensionRecoveryInProgress/);
  assert.match(source, /createExtensionFilterRecoveryState/);
  assert.match(source, /rememberStaleRevision/);
  assert.match(source, /const recovery = .*\.begin\(/s);
  assert.match(source, /isCurrentRecovery/);
  assert.match(source, /setOrganizationExtensionRecoveryFlags\(\{scopeKey: recovery\.scopeKey, inProgress: true, failed: false\}\)/);
  assert.match(source, /setContractExtensionRecoveryFlags\(\{scopeKey: recovery\.scopeKey, inProgress: true, failed: false\}\)/);
  assert.match(source, /organizationExtensionRecoveryFailed/);
  assert.match(source, /contractExtensionRecoveryFailed/);
  assert.match(source, /setOrganizationExtensionRecoveryFlags\(\{scopeKey: recovery\.scopeKey, inProgress: false, failed: true\}\)/);
  assert.match(source, /setContractExtensionRecoveryFlags\(\{scopeKey: recovery\.scopeKey, inProgress: false, failed: true\}\)/);
  assert.match(source, /organizationExtensionRecoveryBlocked/);
  assert.match(source, /contractExtensionRecoveryBlocked/);
  assert.equal((source.match(/const definition = result\.data/g) ?? []).length, 2);
  assert.equal((source.match(/isExtensionDefinitionRevisionAtLeast\(definition, recovery\.expectedRevision\)/g) ?? []).length, 2);
  assert.match(source, /extensionRecoveryRetryAvailable/);
  assert.doesNotMatch(source, /\.catch\(\(\) => undefined\)\.finally\(/);
  assert.match(source, /setExtensionRecoveryNoticeScope\(undefined\)/);
  assert.match(source, /ExtensionFilterInvalidSummary/);
  assert.match(source, /clearInvalidExtensionFilterFields/);
  assert.match(source, /onClear=/);
  assert.match(source, /useExtensionFilterInvalidFocus/);
  assert.match(source, /tabIndex=\{invalidFilterProblem\?\.invalidFields\?\.length \? -1/);
  assert.match(source, /extensionListInvalidSummaryTestId\(/);
  assert.equal(
    (source.match(/extensionFilterValues:\s*value\.extensionFilterValues as Record<string, unknown>/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(source, /extensionFilterValues:\s*value as Record<string, unknown>/);

  const extensionColumnPositions = [...source.matchAll(/\.\.\.extensionListAndSearchColumns/g)].map(
    match => match.index,
  );
  assert.equal(extensionColumnPositions.length, 2);
  for (const position of extensionColumnPositions) {
    assert.ok(position !== undefined);
    assert.ok(source.indexOf("title: '状态'", position) > position, 'extension columns must precede status');
  }
  assert.ok(
    extensionColumnPositions[0] > source.lastIndexOf("title: '备注'", extensionColumnPositions[0]),
    'organization extension columns must follow business columns',
  );
  assert.ok(
    extensionColumnPositions[1] > source.lastIndexOf("title: '货号数量'", extensionColumnPositions[1]),
    'contract extension columns must follow business columns',
  );
});
