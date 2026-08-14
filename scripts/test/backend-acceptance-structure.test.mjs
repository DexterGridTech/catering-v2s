import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const acceptanceRoot = path.join(root, 'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance');
const suitePath = path.join(acceptanceRoot, 'BackendAcceptanceTest.java');
const scenarioFiles = [
  'IamAcceptanceScenarios.java',
  'OrganizationAcceptanceScenarios.java',
  'CommercialContractAcceptanceScenarios.java',
  'AssetAcceptanceScenarios.java',
];

test('backend acceptance discovers all real scenarios through explicit domain groups', () => {
  const suite = readFileSync(suitePath, 'utf8');
  assert.match(suite, /BackendAcceptanceScenarioCatalog\.discover\(this\)/);

  const scenarioSources = scenarioFiles.map((file) => {
    const filePath = path.join(acceptanceRoot, file);
    assert.equal(existsSync(filePath), true, `missing scenario group: ${file}`);
    return readFileSync(filePath, 'utf8');
  });
  const ids = scenarioSources.flatMap((source) => [...source.matchAll(/@AcceptanceScenario\(id = "([^"]+)"/g)].map((match) => match[1]));
  assert.equal(ids.length, 18);
  assert.equal(new Set(ids).size, ids.length);
});
