import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../../../../../');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
test('RP-07 sends one normalized queryText and never duplicates name/code', () => {
  const adapter = read(
    [
      'apps/frontend/operations-admin/src/features/',
      'business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts',
    ].join(''),
  );
  assert.match(adapter, /queryText:\s*queryText\?\.trim\(\)\s*\|\|\s*undefined/);
  assert.doesNotMatch(adapter, /name:\s*queryText|code:\s*queryText/);
});

test.todo('focused or no-seed browser proof must demonstrate brand authorization uses the shared submission lifecycle');
