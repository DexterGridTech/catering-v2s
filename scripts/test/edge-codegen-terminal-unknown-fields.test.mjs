import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'contracts/openapi-source/terminal-binding.schemas.json'), 'utf8'))
  .components.schemas;
const materialized = JSON.parse(fs.readFileSync(path.join(root, 'contracts/openapi/components/terminal-binding/terminal-binding.schemas.json'), 'utf8'))
  .components.schemas;
const wireRoot = path.join(root, 'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire');

function readWire(name) {
  return fs.readFileSync(path.join(wireRoot, `${name}.java`), 'utf8');
}

test('only terminal request schemas permit unknown fields and generated parsing still rejects duplicates', () => {
  const terminalRequests = ['TerminalActivationRequest', 'TerminalActivationCancellationRequest'];
  for (const name of terminalRequests) {
    assert.equal(canonical[name].additionalProperties, true, `${name} canonical schema permits unknown fields`);
    assert.equal(materialized[name].additionalProperties, true, `${name} materialized schema matches canonical source`);
    const generated = readWire(name);
    assert.match(generated, /@tools\.jackson\.databind\.annotation\.JsonDeserialize/);
    assert.match(generated, /if \(!seen\.add\(property\)\)/, `${name} tracks duplicate members`);
    assert.match(generated, /skipUnknownJsonValue\(parser\)/, `${name} skips unknown nested values while checking duplicate members`);
    assert.doesNotMatch(generated, /unknown property \" \+ property/, `${name} ignores unknown member names`);
  }

  const operationsRequest = 'OperationsTerminalActivationCancellationRequest';
  assert.equal(canonical[operationsRequest].additionalProperties, false);
  assert.equal(materialized[operationsRequest].additionalProperties, false);
  assert.match(readWire(operationsRequest), /return context\.reportInputMismatch\([^\n]*, \"unknown property \" \+ property\)/);
});
