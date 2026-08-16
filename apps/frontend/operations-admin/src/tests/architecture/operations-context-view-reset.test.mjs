import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
const keyedContent = /<registration\.Component\s+key=\{session\.contextVersion\}\s+queryContext=\{queryContext\}/;
const unkeyedContent =
  /<registration\.Component(?![^>]*\bkey=\{session\.contextVersion\})[^>]*queryContext=\{queryContext\}/;

function assertContextGenerationKey(source) {
  assert.match(source, /expectedContextVersion:\s*session\.contextVersion/);
  assert.match(source, keyedContent);
  assert.doesNotMatch(source, unkeyedContent);
}

test('operations content is keyed by the owner-issued context generation', () => {
  assertContextGenerationKey(app);
});

test('red mutation removing the context-generation key is rejected', () => {
  const unkeyed = app.replace(' key={session.contextVersion}', '');
  assert.throws(() => assert.doesNotMatch(unkeyed, unkeyedContent), {name: 'AssertionError'});
});
