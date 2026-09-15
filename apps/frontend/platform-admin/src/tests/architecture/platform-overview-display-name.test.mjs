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
    assert.match(source, /extensionValues/);
    assert.match(source, /organizationOverviewExtensionItems/);
  }
  assert.match(
    organizationController,
    /extensionValues\(value\.extensionValues\(\)\)/,
  );
  assert.match(
    organizationController,
    /new OrganizationOverviewItemExtensionFieldsItem\(field\.name\(\), field\.value\(\)\)/,
  );
  assert.match(organizationController, /boolean hierarchy = "HIERARCHY"\.equals\(value\.category\(\)\)/);
  assert.doesNotMatch(organizationController, /@GetMapping OrganizationOverviewTaskReadService\.(Page|Item)/);
  assert.doesNotMatch(
    organizationController,
    /@GetMapping\("\/hierarchy"\) OrganizationOverviewTaskReadService\.HierarchyTree/,
  );
});

test('hierarchy detail continues to consume the existing display-name wire', () => {
  const page = consumerFiles[0];
  assert.match(page, /Omit<OrganizationOverviewItem, 'extensionFields'>/);
  assert.match(page, /extensionFields: \(item\.extensionFields \?\? \[\]\)\.map/);
  assert.match(page, /hierarchyDetailPresentation\(detail\)/);
  assert.doesNotMatch(page, /hierarchyDetailPresentation\(detail, /);
  assert.doesNotMatch(page, /extensionValues: hierarchyRoot\.extensionValues/);
  assert.doesNotMatch(page, /extensionRuleRevision: hierarchyRoot\.extensionRuleRevision/);
});
