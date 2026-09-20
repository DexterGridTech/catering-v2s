#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repositoryRoot = path.resolve(process.cwd());
const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const scanRoot = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : repositoryRoot);

function walkFiles(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(filePath, output);
    else if (entry.isFile() && filePath.endsWith('.java')) output.push(filePath);
  }
  return output;
}

function productionJavaFiles(root) {
  return walkFiles(path.join(root, 'apps/backend/catering-business-server/modules'))
    .filter(filePath => filePath.includes(`${path.sep}src${path.sep}main${path.sep}java${path.sep}`))
    .sort();
}

function scan(root) {
  const violations = [];
  for (const filePath of productionJavaFiles(root)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const marker = /\b[A-Z][A-Z0-9_]*CONTINUATION[A-Z0-9_]*\b/g;
    let match;
    while ((match = marker.exec(source))) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push({
        file: path.relative(root, filePath).split(path.sep).join('/'),
        line,
        identifier: match[0],
      });
    }
  }
  return {files: productionJavaFiles(root), violations};
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (args.includes('--self-test')) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-sql-readability-'));
  try {
    const fixture = path.join(
      scratch,
      'apps/backend/catering-business-server/modules/fixture/src/main/java/FixtureSql.java',
    );
    fs.mkdirSync(path.dirname(fixture), {recursive: true});
    fs.writeFileSync(
      fixture,
      'final class FixtureSql { static final String FIXTURE_CONTINUATION_VALUE = "x"; }\n',
    );
    const result = scan(scratch);
    if (result.violations.length !== 1 || result.violations[0].identifier !== 'FIXTURE_CONTINUATION_VALUE') {
      fail('R4_SQL_READABILITY_SELF_TEST_NOT_DETECTED');
    }
    process.stdout.write('R4_SQL_READABILITY_RED=PASS\n');
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
  }
  process.exit(0);
}

const result = scan(scanRoot);
if (result.violations.length > 0) {
  for (const violation of result.violations) {
    process.stderr.write(
      `R4_SQL_CONTINUATION_IDENTIFIER ${violation.file}:${violation.line} ${violation.identifier}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(
  `BACKEND_SQL_READABILITY=PASS\nSQL_PRODUCTION_JAVA_FILES=${result.files.length}\nSQL_CONTINUATION_IDENTIFIERS=0\n`,
);
