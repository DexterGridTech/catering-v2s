#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SOURCE_ROOT_MATCHERS = [
  /^apps\/.*\/src\/main$/,
  /^libraries\/.*\/src\/main$/,
];
const TEST_ROOT_MATCHERS = [
  /^apps\/.*\/src\/test$/,
  /^libraries\/.*\/src\/test$/,
];
const LEDGER_CLASSIFICATIONS = new Set([
  "callback/mapper",
  "stream/loop",
  "extractor",
  "unbounded full-read",
  "repeated client refresh",
]);
const QUERY_BOUNDARIES = [
  ["JDBC_QUERY", /\b([A-Za-z_$][\w$]*)\.(query|queryForObject|queryForList|queryForStream|queryForRowSet)\s*\(/g],
  ["JDBC_UPDATE", /\b([A-Za-z_$][\w$]*)\.(update|batchUpdate)\s*\(/g],
  ["OBJECT_STORE_IO", /\b(objects|objectStorage)\.(exists|put|delete|get|stat|download|upload)\s*\(/g],
  ["OBJECT_STORE_IO", /\bclient\.(getObject|putObject|removeObject|statObject|downloadObject|uploadObject)\s*\(/g],
];

function fail(reason) { throw new Error(reason); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalized(value) { return JSON.stringify(value); }
function posix(relative) { return relative.split(path.sep).join("/"); }

function walkDirectories(root, relative = "") {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (!stat.isDirectory()) return [];
  const children = fs.readdirSync(absolute, {withFileTypes: true}).sort((left, right) => left.name.localeCompare(right.name));
  return [relative, ...children.flatMap((entry) => entry.isDirectory() ? walkDirectories(root, path.join(relative, entry.name)) : [])];
}

function roots(root, matchers) {
  return walkDirectories(root)
    .map(posix)
    .filter((relative) => matchers.some((matcher) => matcher.test(relative)))
    .sort();
}

function filesBelow(root, relative) {
  const absolute = path.join(root, relative);
  return fs.readdirSync(absolute, {withFileTypes: true}).sort((left, right) => left.name.localeCompare(right.name)).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return filesBelow(root, child);
    return entry.name.endsWith(".java") ? [posix(child)] : [];
  });
}

function javaFiles(root, sourceRoots, testRoots) {
  if (sourceRoots.length === 0) fail("CANONICAL_LEDGER_SOURCE_ROOT_MISSING");
  return [...new Set([...sourceRoots, ...testRoots].flatMap((relative) => filesBelow(root, relative)))].sort();
}

function nearestSymbol(lines, lineNumber, relative) {
  const before = lines.slice(0, lineNumber).join("\n");
  const classMatches = [...before.matchAll(/\b(?:class|interface|record|enum)\s+([A-Za-z_$][\w$]*)/g)];
  const className = classMatches.at(-1)?.[1] || path.posix.basename(relative, ".java");
  for (let index = lineNumber - 1; index >= 0; index -= 1) {
    const match = lines[index].match(/^\s*(?:public|protected|private|static|final|synchronized|abstract|default|\s)+[\w<>?,\[\] .]+\s+([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?:\{|throws\b)/);
    if (match && !["if", "for", "while", "switch", "catch"].includes(match[1])) return `${className}#${match[1]}`;
  }
  return `${className}#<initializer>`;
}

function candidatesFromFile(root, relative) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const lines = source.split("\n");
  return lines.flatMap((line, index) => QUERY_BOUNDARIES.flatMap(([mechanism, expression]) => {
    expression.lastIndex = 0;
    return [...line.matchAll(expression)].map((match) => {
      const callerSymbol = nearestSymbol(lines, index + 1, relative);
      const queryBoundarySymbol = `${match[1]}.${match[2]}`;
      const identity = `${callerSymbol} → ${queryBoundarySymbol} → ${mechanism}`;
      return {
        id: sha256(`${relative}:${index + 1}:${match.index}:${identity}`),
        sourcePath: relative,
        line: index + 1,
        column: match.index + 1,
        identity: {callerSymbol, queryBoundarySymbol, mechanism},
        classification: "QUERY_BOUNDARY_CANDIDATE",
      };
    });
  }));
}

function derive(root) {
  const sourceRoots = roots(root, SOURCE_ROOT_MATCHERS);
  const testRoots = roots(root, TEST_ROOT_MATCHERS);
  const rows = javaFiles(root, sourceRoots, testRoots).flatMap((relative) => candidatesFromFile(root, relative))
    .sort((left, right) => left.id.localeCompare(right.id));
  const ids = rows.map((row) => row.id);
  if (new Set(ids).size !== ids.length) fail("CANONICAL_LEDGER_DERIVED_ID_DUPLICATE");
  return {
    schemaVersion: 2,
    kind: "canonical-performance-candidate-scan",
    roots: {source: sourceRoots, test: testRoots},
    rows,
    fingerprint: sha256(normalized({roots: {source: sourceRoots, test: testRoots}, rows})),
  };
}

function requireString(value, code) {
  if (typeof value !== "string" || value.trim() === "") fail(code);
}

function validateRow(row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail(`CANONICAL_LEDGER_ROW_INVALID:${index}`);
  requireString(row.id, `CANONICAL_LEDGER_ROW_ID_INVALID:${index}`);
  if (!row.roots || typeof row.roots !== "object" || Array.isArray(row.roots)) fail(`CANONICAL_LEDGER_ROW_ROOTS_INVALID:${row.id}`);
  for (const field of ["source", "test"]) {
    if (!Array.isArray(row.roots[field]) || row.roots[field].length === 0 || row.roots[field].some((value) => typeof value !== "string" || value === "")) {
      fail(`CANONICAL_LEDGER_ROW_ROOTS_INVALID:${row.id}`);
    }
  }
  if (!row.identity || typeof row.identity !== "object" || Array.isArray(row.identity)) fail(`CANONICAL_LEDGER_ROW_IDENTITY_INVALID:${row.id}`);
  for (const field of ["callerSymbol", "queryBoundarySymbol", "mechanism"]) requireString(row.identity[field], `CANONICAL_LEDGER_ROW_IDENTITY_INVALID:${row.id}`);
  if (!LEDGER_CLASSIFICATIONS.has(row.classification)) fail(`CANONICAL_LEDGER_ROW_CLASSIFICATION_INVALID:${row.id}`);
  for (const field of ["owner", "testClass", "fixture", "budget", "disposition"]) {
    const value = row[field];
    if (value === undefined || value === null || value === "" || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)) {
      fail(`CANONICAL_LEDGER_ROW_${field.toUpperCase()}_INVALID:${row.id}`);
    }
  }
  const budget = row.budget;
  if (!budget || typeof budget !== "object" || Array.isArray(budget) || budget.mode !== "EXACT_SQL_STATEMENTS" || !Array.isArray(budget.cases) || budget.cases.length === 0 || !Array.isArray(budget.semanticInvariants)) {
    fail(`CANONICAL_LEDGER_ROW_BUDGET_CONTRACT_INVALID:${row.id}`);
  }
  const caseIds = new Set();
  for (const entry of budget.cases) {
    if (!entry || typeof entry.id !== "string" || entry.id.length === 0 || !Number.isInteger(entry.expectedStatements) || entry.expectedStatements < 1 || caseIds.has(entry.id)) {
      fail(`CANONICAL_LEDGER_ROW_BUDGET_CONTRACT_INVALID:${row.id}`);
    }
    caseIds.add(entry.id);
  }
}

function validateLedger(root, ledgerPath) {
  const absolute = path.join(root, ledgerPath);
  if (!fs.existsSync(absolute)) fail(`P4_CANONICAL_LEDGER_NOT_READY:${ledgerPath}`);
  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(absolute, "utf8")); } catch { fail(`CANONICAL_LEDGER_INVALID:${ledgerPath}`); }
  if (ledger.schemaVersion !== 2 || ledger.kind !== "canonical-performance-ledger" || !Array.isArray(ledger.rows) || ledger.rows.length === 0) {
    fail(`CANONICAL_LEDGER_INVALID:${ledgerPath}`);
  }
  const ids = new Set();
  ledger.rows.forEach((row, index) => {
    validateRow(row, index);
    if (ids.has(row.id)) fail(`CANONICAL_LEDGER_ROW_ID_DUPLICATE:${row.id}`);
    ids.add(row.id);
  });
  const current = derive(root);
  if (!ledger.candidateScan || typeof ledger.candidateScan !== "object") fail("CANONICAL_LEDGER_CANDIDATE_SCAN_MISSING");
  if (!Number.isInteger(ledger.candidateScan.count) || ledger.candidateScan.count < 0 || typeof ledger.candidateScan.fingerprint !== "string") {
    fail("CANONICAL_LEDGER_CANDIDATE_SCAN_INVALID");
  }
  if (ledger.candidateScan.count !== current.rows.length || ledger.candidateScan.fingerprint !== current.fingerprint) {
    fail("CANONICAL_LEDGER_CANDIDATE_SCAN_DRIFT");
  }
  return {ledger, current};
}

function fixtureLedger(scan) {
  return {
    schemaVersion: 2,
    kind: "canonical-performance-ledger",
    candidateScan: {count: scan.rows.length, fingerprint: scan.fingerprint},
    rows: [{
      id: "fixture-row",
      roots: {source: scan.roots.source, test: scan.roots.test.length ? scan.roots.test : ["apps/example/src/test"]},
      identity: {callerSymbol: "Example#read", queryBoundarySymbol: "jdbcTemplate.query", mechanism: "JDBC_QUERY"},
      classification: "callback/mapper",
      owner: "example",
      testClass: "ExampleTest",
      fixture: "P=1/P=100",
      budget: {mode: "EXACT_SQL_STATEMENTS", cases: [{id: "fixture", expectedStatements: 2}], semanticInvariants: ["fixture"]},
      disposition: "RUNTIME_BUDGET_REQUIRED",
    }],
  };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-canonical-ledger-"));
  try {
    const source = path.join(root, "apps/example/src/main/java/Example.java");
    const test = path.join(root, "apps/example/src/test/java/ExampleTest.java");
    fs.mkdirSync(path.dirname(source), {recursive: true});
    fs.mkdirSync(path.dirname(test), {recursive: true});
    fs.writeFileSync(source, "class Example { void read() { jdbcTemplate.query(\"SELECT id FROM example\"); jdbcTemplate.update(\"UPDATE example SET value = ?\"); result.getObject(1); objects.exists(\"asset\"); } }\n");
    fs.writeFileSync(test, "class ExampleTest {}\n");
    const first = derive(root);
    const ledgerPath = "ledger.json";
    const clean = fixtureLedger(first);
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(clean, null, 2)}\n`);
    validateLedger(root, ledgerPath);
    const omitted = structuredClone(clean);
    omitted.rows[0].budget = "";
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(omitted, null, 2)}\n`);
    try { validateLedger(root, ledgerPath); fail("CANONICAL_LEDGER_SELF_TEST_OMISSION_NOT_DETECTED"); } catch (error) {
      if (error.message !== "CANONICAL_LEDGER_ROW_BUDGET_INVALID:fixture-row") throw error;
    }
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(clean, null, 2)}\n`);
    fs.appendFileSync(source, "class Next { void write() { jdbcTemplate.queryForObject(\"SELECT count(*) FROM example\", Integer.class); } }\n");
    try { validateLedger(root, ledgerPath); fail("CANONICAL_LEDGER_SELF_TEST_DERIVED_EDGE_CHANGE_NOT_DETECTED"); } catch (error) {
      if (error.message !== "CANONICAL_LEDGER_CANDIDATE_SCAN_DRIFT") throw error;
    }
    const second = derive(root);
    if (first.rows.length !== 3 || new Set(first.rows.map((row) => row.id)).size !== 3) fail("CANONICAL_LEDGER_SELF_TEST_SAME_LINE_EDGES_NOT_DISTINCT");
    if (first.rows.some((row) => row.identity.queryBoundarySymbol === "result.getObject") || !first.rows.some((row) => row.identity.queryBoundarySymbol === "objects.exists")) fail("CANONICAL_LEDGER_SELF_TEST_OBJECT_STORE_BOUNDARY_INVALID");
    if (second.rows.length !== first.rows.length + 1 || second.fingerprint === first.fingerprint) fail("CANONICAL_LEDGER_SELF_TEST_DERIVED_SET_NOT_CHANGED");
    const refreshed = fixtureLedger(second);
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(refreshed, null, 2)}\n`);
    validateLedger(root, ledgerPath);
    process.stdout.write("CANONICAL_PERFORMANCE_LEDGER_SELF_TEST=PASS\nRED_LEDGER_REQUIRED_FIELD=PASS\nRED_DERIVED_EDGE_CHANGE=PASS\nRED_OBJECT_STORE_BOUNDARY=PASS\nCLEANUP=PASS\n");
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
}

const command = process.argv[2] || "scan";
try {
  if (command === "--self-test" || command === "self-test") selfTest();
  else if (command === "scan") process.stdout.write(`${JSON.stringify(derive(process.cwd()), null, 2)}\n`);
  else if (command === "check") {
    const {ledger, current} = validateLedger(process.cwd(), process.argv[3] || "doc/evidence/platform/rm1/p4/canonical-performance-ledger.json");
    process.stdout.write(`CANONICAL_PERFORMANCE_LEDGER=PASS\nROWS=${ledger.rows.length}\nCANDIDATES=${current.rows.length}\n`);
  } else fail("USAGE: canonical-ledger-scanner <scan|check [ledger-path]|--self-test>");
} catch (error) { process.stderr.write(`CANONICAL_PERFORMANCE_LEDGER=FAIL\nREASON=${error.message}\n`); process.exitCode = 1; }
