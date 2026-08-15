#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoots = ['apps/frontend/platform-admin/src', 'apps/frontend/operations-admin/src'];

function filesUnder(relativeRoot) {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) files.push(absolute);
    }
  };
  walk(path.join(root, relativeRoot));
  return files.sort();
}

function scanSource(source, relativeFile) {
  const findings = [];
  const legacy = [...source.matchAll(/format(?:NameCode|CodeNamePath)\s*\(/g)];
  const handBuilt = [];
  for (const match of source.matchAll(/`[^`]*`/gs)) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const lineText = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
    if (!/\bkey\s*[:=]/.test(lineText) && /\$\{[^}]*(?:name|Name)[^}]*\}/.test(match[0]) && /\$\{[^}]*(?:code|Code)[^}]*\}/.test(match[0])) handBuilt.push(match);
  }
  for (const match of source.matchAll(/<[^>]+>\s*\{[^}]*(?:name|Name)[^}]*\}\s*<\/[^>]+>\s*<[^>]+>\s*\{[^}]*(?:code|Code)[^}]*\}\s*<\/[^>]+>/gi)) handBuilt.push(match);
  for (const pattern of [
    /<([A-Za-z][\w.]*)\b[^>]*>[^<{}]*\{[^}]*?(?:name|Name)[^}]*\}[^<{}]*\{[^}]*?(?:code|Code)[^}]*\}[^<{}]*<\/\1>/gs,
    /<([A-Za-z][\w.]*)\b[^>]*>[^<{}]*\{[^}]*?(?:code|Code)[^}]*\}[^<{}]*\{[^}]*?(?:name|Name)[^}]*\}[^<{}]*<\/\1>/gs,
  ]) for (const match of source.matchAll(pattern)) handBuilt.push(match);
  for (const pattern of [
    /\b[\w$.]*(?:name|Name)\w*\b\s*\+\s*['"`][^'"`]*['"`]\s*\+\s*\b[\w$.]*(?:code|Code)\w*\b/g,
    /\b[\w$.]*(?:code|Code)\w*\b\s*\+\s*['"`][^'"`]*['"`]\s*\+\s*\b[\w$.]*(?:name|Name)\w*\b/g,
  ]) for (const match of source.matchAll(pattern)) handBuilt.push(match);
  const line = (match) => source.slice(0, match.index).split('\n').length;
  for (const match of legacy) findings.push({kind: 'LEGACY_FORMATTER', file: relativeFile, line: line(match)});
  for (const match of handBuilt) findings.push({kind: 'HAND_BUILT_NAME_CODE', file: relativeFile, line: line(match)});
  return findings;
}

function scan(files) {
  return files.flatMap((absolute) => scanSource(fs.readFileSync(absolute, 'utf8'), path.relative(root, absolute)));
}

function componentCoverage(files) {
  const producerPattern = /<NameCode(?:Text|PathText)\b|createElement\(NameCode(?:Text|PathText)\b/g;
  const producerFiles = new Set();
  let producerSites = 0;
  for (const absolute of files) {
    const source = fs.readFileSync(absolute, 'utf8');
    const matches = [...source.matchAll(producerPattern)];
    if (matches.length) {
      producerFiles.add(absolute);
      producerSites += matches.length;
    }
  }
  return {producerFiles: producerFiles.size, producerSites};
}

function selfTest() {
  const legacy = scanSource('const label = formatNameCode(name, code);', 'fixture.ts');
  const handBuilt = scanSource('const label = `${dataNodeName} (${dataNodeCode})`;', 'fixture.ts');
  const handBuiltPath = scanSource('const label = `${dataNodeName} / ${dataNodeCode}`;', 'fixture.ts');
  const handBuiltJsx = scanSource('<span>{node.name}</span><span>{node.code}</span>', 'fixture.ts');
  const handBuiltSameElement = scanSource('<Typography.Text>{row.productName}（{row.productCode}）</Typography.Text>', 'fixture.ts');
  const handBuiltConcat = scanSource("const label = row.name + '（' + row.code;", 'fixture.ts');
  const clean = scanSource('const label = <NameCodeText name={name} code={code}/>;', 'fixture.ts');
  if (!legacy.some((finding) => finding.kind === 'LEGACY_FORMATTER')) throw new Error('NAME_CODE_SELF_TEST_LEGACY_RED_NOT_DETECTED');
  if (!handBuilt.some((finding) => finding.kind === 'HAND_BUILT_NAME_CODE')) throw new Error('NAME_CODE_SELF_TEST_HAND_BUILT_RED_NOT_DETECTED');
  if (!handBuiltPath.some((finding) => finding.kind === 'HAND_BUILT_NAME_CODE')) throw new Error('NAME_CODE_SELF_TEST_PATH_RED_NOT_DETECTED');
  if (!handBuiltJsx.some((finding) => finding.kind === 'HAND_BUILT_NAME_CODE')) throw new Error('NAME_CODE_SELF_TEST_JSX_RED_NOT_DETECTED');
  if (!handBuiltSameElement.some((finding) => finding.kind === 'HAND_BUILT_NAME_CODE')) throw new Error('NAME_CODE_SELF_TEST_SAME_ELEMENT_RED_NOT_DETECTED');
  if (!handBuiltConcat.some((finding) => finding.kind === 'HAND_BUILT_NAME_CODE')) throw new Error('NAME_CODE_SELF_TEST_CONCAT_RED_NOT_DETECTED');
  if (clean.length) throw new Error('NAME_CODE_SELF_TEST_CLEAN_FIXTURE_FALSE_POSITIVE');
  process.stdout.write('NAME_CODE_DENSITY_SELF_TEST=PASS\nRED_LEGACY_FORMATTER=PASS\nRED_HAND_BUILT_NAME_CODE=PASS\n');
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const files = appRoots.flatMap(filesUnder);
  const findings = scan(files);
  const coverage = componentCoverage(files);
  if (coverage.producerFiles < 31 || coverage.producerSites < 77) throw new Error(`NAME_CODE_COMPONENT_COVERAGE_FAIL:FILES=${coverage.producerFiles}:SITES=${coverage.producerSites}`);
  if (findings.length) {
    findings.forEach((finding) => process.stderr.write(`${finding.kind}:${finding.file}:${finding.line}\n`));
    throw new Error(`NAME_CODE_DENSITY_FAIL:FINDINGS=${findings.length}`);
  }
  process.stdout.write(`NAME_CODE_DENSITY=PASS\nLEGACY_FORMATTER_CALLS=0\nHAND_BUILT_NAME_CODE=0\nCOMPONENT_PRODUCER_FILES=${coverage.producerFiles}\nCOMPONENT_PRODUCER_SITES=${coverage.producerSites}\n`);
}

try { main(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
