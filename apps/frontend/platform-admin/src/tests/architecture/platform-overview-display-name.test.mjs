import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const files = [
  '../../features/organization-contract-overview/ui/PlatformReadPage.tsx',
  '../../features/organization-contract-overview/ui/OrganizationOverviewDetailDrawer.tsx',
  '../../features/organization-contract-overview/ui/ContractOverviewDetailDrawer.tsx',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

test('overview details show extension display names and never the internal label projection', () => {
  for (const source of files) {
    assert.match(source, /field\.name/);
    assert.doesNotMatch(source, /field\.label/);
  }
});
