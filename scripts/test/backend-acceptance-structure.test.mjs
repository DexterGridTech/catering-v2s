import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const acceptanceRoot = path.join(
  root,
  'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
);
const suitePath = path.join(acceptanceRoot, 'BackendAcceptanceTest.java');

function maskJavaTrivia(source) {
  const chars = source.split('');
  const blank = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
    }
  };
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      const end = newline === -1 ? source.length : newline;
      blank(index, end);
      index = end;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const endMarker = source.indexOf('*/', index + 2);
      const end = endMarker === -1 ? source.length : endMarker + 2;
      blank(index, end);
      index = end;
      continue;
    }
    if (source.startsWith('"""', index)) {
      const start = index;
      index += 3;
      while (index < source.length && !(source.startsWith('"""', index) && source[index - 1] !== '\\')) {
        index += 1;
      }
      index += source.startsWith('"""', index) ? 3 : 0;
      blank(start, index);
      continue;
    }
    if (source[index] === '"' || source[index] === "'") {
      const start = index;
      const quote = source[index];
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      blank(start, index);
      continue;
    }
    index += 1;
  }
  return chars.join('');
}

function braceDepthAt(maskedSource, offset) {
  let depth = 0;
  for (let index = 0; index < offset; index += 1) {
    if (maskedSource[index] === '{') depth += 1;
    if (maskedSource[index] === '}') depth = Math.max(0, depth - 1);
  }
  return depth;
}

function classNameOf(source, file) {
  const masked = maskJavaTrivia(source);
  const pattern =
    /\b(?:(?:public|protected|private|abstract|static|final|sealed|non-sealed)\s+)*class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  for (const match of masked.matchAll(pattern)) {
    if (braceDepthAt(masked, match.index) === 0) return match[1];
  }
  assert.fail('top-level class is missing: ' + file);
}

function acceptanceScenarioIds(source, masked) {
  const ids = [];
  for (const match of masked.matchAll(/@AcceptanceScenario\s*\(/g)) {
    const end = masked.indexOf(')', match.index);
    const annotation = source.slice(match.index, end === -1 ? source.length : end + 1);
    const id = annotation.match(/\bid\s*=\s*"([^"]+)"/);
    if (id) ids.push(id[1]);
  }
  return ids;
}

function hasExecutableConsumerReference(maskedBlock, className) {
  const escaped = escapeRegExp(className);
  return (
    new RegExp('\\bnew\\s+' + escaped + '\\s*\\(').test(maskedBlock) ||
    new RegExp('\\b' + escaped + '\\s*\\.\\s*[A-Za-z_$][A-Za-z0-9_$]*\\s*\\(').test(maskedBlock) ||
    new RegExp('\\b' + escaped + '\\s*::').test(maskedBlock)
  );
}

function explicitTestConsumers(suite, maskedSuite, className) {
  const consumers = [];
  const matches = [...maskedSuite.matchAll(/@Test\b/g)];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index;
    const end = matches[index + 1]?.index ?? maskedSuite.length;
    const maskedBlock = maskedSuite.slice(start, end);
    const classPattern = new RegExp('\\b' + escapeRegExp(className) + '\\b');
    if (!classPattern.test(maskedBlock)) continue;
    if (!hasExecutableConsumerReference(maskedBlock, className)) continue;
    const docStart = suite.lastIndexOf('/**', start);
    const docEnd = docStart === -1 ? -1 : suite.indexOf('*/', docStart) + 2;
    const sourceStart =
      docStart >= 0 && docEnd >= 2 && docEnd <= start && /^[\s@]*$/.test(suite.slice(docEnd, start))
        ? docStart
        : start;
    consumers.push({
      start,
      end,
      source: suite.slice(sourceStart, end),
      conditional: /@(?:Enabled|Disabled)[A-Za-z0-9_]*/.test(maskedBlock),
    });
  }
  return consumers;
}

function assertConditionalConsumerIsDocumented(consumer, className) {
  if (!consumer.conditional) return;
  assert.match(
    consumer.source,
    /disabled by default|default[- ]disabled|absent or not true|not enabled by default/i,
    className + ' conditional consumer must document its default status',
  );
  assert.match(
    consumer.source,
    /explicit (?:enablement|enable)|requires setting|set .* to true|enable.*setting/i,
    className + ' conditional consumer must document explicit enablement',
  );
}

export function validateAcceptanceStructure(repositoryRoot = root) {
  const rootAcceptance = path.join(
    repositoryRoot,
    'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
  );
  const rootSuitePath = path.join(rootAcceptance, 'BackendAcceptanceTest.java');
  const catalogPath = path.join(rootAcceptance, 'BackendAcceptanceScenarioCatalog.java');
  const suite = readFileSync(rootSuitePath, 'utf8');
  const maskedSuite = maskJavaTrivia(suite);
  const catalog = maskJavaTrivia(readFileSync(catalogPath, 'utf8'));
  assert.match(maskedSuite, /BackendAcceptanceScenarioCatalog\.discover\(this\)/);

  const files = readdirSync(rootAcceptance)
    .filter(file => file.endsWith('Scenarios.java'))
    .sort();
  assert.ok(files.length > 0, 'acceptance scenario directory is empty');
  const ids = [];
  for (const file of files) {
    const source = readFileSync(path.join(rootAcceptance, file), 'utf8');
    const maskedSource = maskJavaTrivia(source);
    const className = classNameOf(source, file);
    const annotated = /@AcceptanceScenario\s*\(/.test(maskedSource);
    if (annotated) {
      assert.match(catalog, new RegExp(`\\bnew\\s+${escapeRegExp(className)}\\(host\\)`), `${file} is not registered`);
    } else {
      const consumers = explicitTestConsumers(suite, maskedSuite, className);
      assert.ok(consumers.length > 0, `${file} has no explicit @Test consumer`);
      for (const consumer of consumers) assertConditionalConsumerIsDocumented(consumer, className);
    }
    ids.push(...acceptanceScenarioIds(source, maskedSource));
  }
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('backend acceptance discovers every real scenario file through a group or explicit host consumer', () => {
  validateAcceptanceStructure(root);
});

test('backend acceptance structure rejects an unregistered scenario group', () => {
  const scratch = mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'v2s-acceptance-structure-'));
  const scratchAcceptance = path.join(
    scratch,
    'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
  );
  try {
    cpSync(acceptanceRoot, scratchAcceptance, {recursive: true});
    writeFileSync(
      path.join(scratchAcceptance, 'UnregisteredAcceptanceScenarios.java'),
      `package com.catering.v2s.app.acceptance;
final class UnregisteredAcceptanceScenarios {
    @AcceptanceScenario(id = "fixture.unregistered", module = "FIXTURE", operation = "fixture")
    void fixture() {}
}
`,
    );
    assert.throws(
      () => validateAcceptanceStructure(scratch),
      error => String(error).includes('UnregisteredAcceptanceScenarios.java is not registered'),
    );
    rmSync(path.join(scratchAcceptance, 'UnregisteredAcceptanceScenarios.java'));
    writeFileSync(
      path.join(scratchAcceptance, 'UnconsumedHelperScenarios.java'),
      'package com.catering.v2s.app.acceptance;\nfinal class UnconsumedHelperScenarios {}\n',
    );
   assert.throws(
     () => validateAcceptanceStructure(scratch),
     error => String(error).includes('UnconsumedHelperScenarios.java has no explicit @Test consumer'),
   );
    rmSync(path.join(scratchAcceptance, 'UnconsumedHelperScenarios.java'));
    writeFileSync(
      path.join(scratchAcceptance, 'ConditionalHelperScenarios.java'),
      'package com.catering.v2s.app.acceptance;\nfinal class ConditionalHelperScenarios {}\n',
    );
    const suiteSource = readFileSync(path.join(scratchAcceptance, 'BackendAcceptanceTest.java'), 'utf8');
    const suiteEnd = suiteSource.lastIndexOf('\n}');
    const conditionalConsumer = [
      '',
      '    @Test',
      '    @EnabledIfEnvironmentVariable(named = "FIXTURE", matches = "true")',
      '    void conditionalFixtureConsumer() {',
      '        ConditionalHelperScenarios.run(this);',
      '    }',
      '',
    ].join('\n');
    writeFileSync(
      path.join(scratchAcceptance, 'BackendAcceptanceTest.java'),
      suiteSource.slice(0, suiteEnd) + conditionalConsumer + suiteSource.slice(suiteEnd),
    );
    assert.throws(
      () => validateAcceptanceStructure(scratch),
      error => String(error).includes('ConditionalHelperScenarios conditional consumer must document its default status'),
    );
    rmSync(path.join(scratchAcceptance, 'ConditionalHelperScenarios.java'));
    writeFileSync(
      path.join(scratchAcceptance, 'InvocationlessHelperScenarios.java'),
      'package com.catering.v2s.app.acceptance;\nfinal class InvocationlessHelperScenarios {}\n',
    );
    const invocationlessConsumer = [
      '',
      '    @Test',
      '    void invocationlessFixtureConsumer() {',
      '        Class<InvocationlessHelperScenarios> type = null;',
      '    }',
      '',
    ].join('\n');
    writeFileSync(
      path.join(scratchAcceptance, 'BackendAcceptanceTest.java'),
      suiteSource.slice(0, suiteEnd) + invocationlessConsumer + suiteSource.slice(suiteEnd),
    );
    assert.throws(
      () => validateAcceptanceStructure(scratch),
      error => String(error).includes('InvocationlessHelperScenarios.java has no explicit @Test consumer'),
    );
 } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
