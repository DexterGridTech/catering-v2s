#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoots = [
  'apps/frontend/platform-admin/src',
  'apps/frontend/operations-admin/src',
];

function productionFiles(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.tsx$/.test(entry.name) && !/\.(?:test|spec)\.tsx$/.test(entry.name)) files.push(absolute);
    }
  };
  visit(absoluteRoot);
  return files.sort();
}

function occurrences(source) {
  return [...source.matchAll(/<ProTable\b/g)].map((match) => {
    const start = match.index ?? 0;
    const openingPrefix = source.slice(start, start + 220);
    return {
      start,
      compact: /^<ProTable(?:<[^>\r\n]+>)?(?=[^>]*\bsize="small"(?=\s|>))/.test(openingPrefix),
    };
  });
}

function scan(files) {
  const findings = [];
  for (const absolute of files) {
    const source = fs.readFileSync(absolute, 'utf8');
    const items = occurrences(source);
    items.forEach((item, index) => {
      findings.push({
        file: path.relative(root, absolute),
        index: index + 1,
        compact: item.compact,
      });
    });
  }
  return findings;
}

function assertSelfTest() {
  const red = occurrences('<ProTable<Row> rowKey="id" />');
  if (red.length !== 1 || red[0].compact) throw new Error('PROTABLE_COMPACT_SELF_TEST_RED_NOT_DETECTED');
  const green = occurrences('<ProTable<Row> rowKey="id" size="small" />');
  if (green.length !== 1 || !green[0].compact) throw new Error('PROTABLE_COMPACT_SELF_TEST_GREEN_REJECTED');
  process.stdout.write('PROTABLE_COMPACT_SELF_TEST=PASS\nRED_MISSING_SIZE=PASS\n');
}

function main() {
  if (process.argv.includes('--self-test')) {
    assertSelfTest();
    return;
  }
  const files = appRoots.flatMap(productionFiles);
  const findings = scan(files);
  const missing = findings.filter((entry) => !entry.compact);
  const byApp = Object.fromEntries(appRoots.map((appRoot) => [
    path.basename(path.dirname(appRoot)), findings.filter((entry) => entry.file.startsWith(`${appRoot}/`)).length,
  ]));
  if (missing.length > 0) {
    for (const entry of missing) process.stderr.write(`PROTABLE_COMPACT_MISSING:${entry.file}#${entry.index}\n`);
    throw new Error(`PROTABLE_COMPACT_FAIL:instances=${findings.length}:missing=${missing.length}`);
  }
  process.stdout.write(`PROTABLE_COMPACT=PASS\nPROTABLE_INSTANCES=${findings.length}\nPROTABLE_FILES=${new Set(findings.map((entry) => entry.file)).size}\nPLATFORM_ADMIN=${byApp['platform-admin']}\nOPERATIONS_ADMIN=${byApp['operations-admin']}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
