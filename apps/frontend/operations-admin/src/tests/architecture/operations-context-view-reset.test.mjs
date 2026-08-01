import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
const keyedContent = /<registration\.Component\s+key=\{session\.contextVersion\}\s+queryContext=\{queryContext\}/;

function assertContextGenerationKey(source) {
  assert.match(source, /expectedContextVersion:\s*session\.contextVersion/);
  assert.match(source, keyedContent);
}

test('operations content is keyed by the owner-issued context generation', () => {
  assertContextGenerationKey(app);
});

test('red mutation removing the context-generation key is rejected', () => {
  assert.throws(() => assertContextGenerationKey(app.replace(' key={session.contextVersion}', '')), {name: 'AssertionError'});
});
