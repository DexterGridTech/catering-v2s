import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const consumerFiles = [
  '../../features/organization-contract-overview/ui/PlatformReadPage.tsx',
  '../../features/organization-contract-overview/ui/OrganizationOverviewDetailDrawer.tsx',
  '../../features/organization-contract-overview/ui/ContractOverviewDetailDrawer.tsx',
].map(path => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const organizationController = fs.readFileSync(
  new URL(
    [
      '../../../../../backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/',
      'platform/organization/PlatformOrganizationOverviewController.java',
    ].join(''),
    import.meta.url,
  ),
  'utf8',
);

test('overview consumers use the display-name wire and the platform edge adapts owner DTOs explicitly', () => {
  for (const source of consumerFiles) {
    assert.match(source, /field\.name/);
    assert.doesNotMatch(source, /field\.label/);
  }
  assert.match(
    organizationController,
    /new OrganizationOverviewItemExtensionFieldsItem\(field\.name\(\), field\.value\(\)\)/,
  );
  assert.doesNotMatch(organizationController, /@GetMapping OrganizationOverviewTaskReadService\.(Page|Item)/);
  assert.doesNotMatch(
    organizationController,
    /@GetMapping\("\/hierarchy"\) OrganizationOverviewTaskReadService\.HierarchyTree/,
  );
});
