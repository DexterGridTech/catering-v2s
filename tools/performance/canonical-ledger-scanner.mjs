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
const DISPOSITION_VALUES = new Set([
  "COVERED_BY_EXISTING_LEDGER_ROW",
  "NOT_RUNTIME_BUDGET_WITH_REASON",
  "RUNTIME_BUDGET_REQUIRED",
]);
const EXCLUSION_REASONS = new Set([
  "TEST_FIXTURE_SETUP",
  "STATIC_INITIALIZER",
  "NON_REPEATED_OWNER_WRITE",
  "OBJECT_STORAGE_NOT_SQL",
]);
const DEFAULT_LEDGER_PATH = "doc/evidence/platform/rm1/p4/canonical-performance-ledger.json";
const DEFAULT_RECOVERY_PATH = "doc/evidence/platform/rm1/p4/canonical-performance-candidate-recovery-receipt.json";
const DEFAULT_DISPOSITION_PATH = "doc/evidence/platform/rm1/p4/canonical-performance-candidate-disposition.json";
const DEFAULT_BASELINE_PATH = "doc/evidence/platform/rm1/p4/canonical-performance-accepted-baseline.json";
const BASELINE_TEST_SOURCE_OVERRIDES = {
  M2: "apps/backend/catering-business-server/modules/store-contract/src/test/java/com/catering/v2s/contract/application/ContractFixedStoreQueryTest.java",
};
const EXPECTED_OLD_CANDIDATE_SCAN = {
  count: 721,
  fingerprint: "86515aa2e1af801e1aa561447d0f5f50b00a1e6d8267a994891b36fb0dbecddf",
};
const FINITE_RECOVERY_LOCATIONS = [
  "doc/evidence/platform/rm1/p4/2026-08-12-p4-runtime-ledger-rebaseline.json",
  "doc/evidence/platform/rm1/p4/p4-ledger-authority-problem-family-discovery.json",
  "doc/evidence/platform/rm1/p4/rm1-u07-package-exit.json",
  ".runtime/compliance-control/hook-events/p4-final-candidate-fingerprint-14.pre.json",
  ".runtime/compliance-control/hook-events/p4-final-candidate-fingerprint-14.post.json",
  ".runtime/compliance-control/hook-events/p4-refresh-canonical-ledger-final-source-20260729.pre.json",
  ".runtime/compliance-control/hook-events/p4-refresh-canonical-ledger-final-source-20260729.post.json",
];
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

function readJson(root, relative, code) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail(`${code}_MISSING:${relative}`);
  try { return JSON.parse(fs.readFileSync(absolute, "utf8")); }
  catch { fail(`${code}_INVALID:${relative}`); }
}

function fileHash(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return "ABSENT";
  return sha256(fs.readFileSync(absolute));
}

function candidateSourceEvidence(root, row) {
  const sourceHash = fileHash(root, row.sourcePath);
  if (sourceHash === "ABSENT") fail(`CANONICAL_LEDGER_SOURCE_MISSING:${row.sourcePath}`);
  return {
    path: row.sourcePath,
    sha256: sourceHash,
    anchor: `${row.sourcePath}:${row.line}:${row.column}:${row.identity.callerSymbol}:${row.identity.queryBoundarySymbol}:${row.identity.mechanism}`,
  };
}

function sameIdentity(left, right) {
  return left?.callerSymbol === right?.callerSymbol
    && left?.queryBoundarySymbol === right?.queryBoundarySymbol
    && left?.mechanism === right?.mechanism;
}

function ledgerCaseIds(row) {
  if (!row?.budget || row.budget.mode !== "EXACT_SQL_STATEMENTS" || !Array.isArray(row.budget.cases)) return [];
  return row.budget.cases.map((entry) => entry.id).sort();
}

function loadLedgerShape(root, ledgerPath) {
  const ledger = readJson(root, ledgerPath, "CANONICAL_LEDGER");
  if (ledger.schemaVersion !== 2 || ledger.kind !== "canonical-performance-ledger" || !Array.isArray(ledger.rows) || ledger.rows.length === 0) {
    fail(`CANONICAL_LEDGER_INVALID:${ledgerPath}`);
  }
  const ids = new Set();
  ledger.rows.forEach((row, index) => {
    validateRow(row, index);
    if (ids.has(row.id)) fail(`CANONICAL_LEDGER_ROW_ID_DUPLICATE:${row.id}`);
    ids.add(row.id);
  });
  return ledger;
}

function recoveryLocationResult(root, relative) {
  if (!fs.existsSync(path.join(root, relative))) {
    return {path: relative, sha256: "ABSENT", result: "NOT_PRESENT_OR_NO_ROW_SET"};
  }
  const value = readJson(root, relative, "CANONICAL_LEDGER_RECOVERY_SOURCE");
  const hasCandidateRows = Array.isArray(value?.rows)
    && value.rows.length === EXPECTED_OLD_CANDIDATE_SCAN.count
    && typeof value.fingerprint === "string";
  return {
    path: relative,
    sha256: fileHash(root, relative),
    result: hasCandidateRows ? "FOUND_WITH_FINGERPRINT" : "NOT_PRESENT_OR_NO_ROW_SET",
    ...(hasCandidateRows ? {count: value.rows.length, fingerprint: value.fingerprint} : {}),
  };
}

function buildRecoveryReceipt(root) {
  const locations = FINITE_RECOVERY_LOCATIONS.map((relative) => recoveryLocationResult(root, relative));
  const found = locations.filter((entry) => entry.result === "FOUND_WITH_FINGERPRINT");
  if (found.length > 0) {
    if (found.length !== 1 || found[0].count !== EXPECTED_OLD_CANDIDATE_SCAN.count || found[0].fingerprint !== EXPECTED_OLD_CANDIDATE_SCAN.fingerprint) {
      fail("CANONICAL_LEDGER_RECOVERY_SOURCE_CONFLICT");
    }
    return {
      schemaVersion: 1,
      kind: "canonical-performance-candidate-recovery-receipt",
      expectedOldCandidateScan: EXPECTED_OLD_CANDIDATE_SCAN,
      status: "FOUND_WITH_FINGERPRINT",
      locations,
    };
  }
  return {
    schemaVersion: 1,
    kind: "canonical-performance-candidate-recovery-receipt",
    expectedOldCandidateScan: EXPECTED_OLD_CANDIDATE_SCAN,
    status: "OLD_ROW_SET_UNRECOVERABLE",
    locations,
  };
}

function dispositionForCandidate(root, ledger, row) {
  const sourceEvidence = candidateSourceEvidence(root, row);
  const matchingRows = ledger.rows.filter((candidate) => sameIdentity(candidate.identity, row.identity));
  if (matchingRows.length === 1) {
    const existing = matchingRows[0];
    const caseId = ledgerCaseIds(existing)[0];
    return {
      candidateId: row.id,
      sourcePath: row.sourcePath,
      line: row.line,
      column: row.column,
      identity: row.identity,
      disposition: "COVERED_BY_EXISTING_LEDGER_ROW",
      ledgerBinding: {kind: "EXISTING_LEDGER_CASE", ledgerId: existing.id, caseId},
      sourceEvidence,
    };
  }

  let reason;
  if (row.identity.mechanism === "OBJECT_STORE_IO") reason = "OBJECT_STORAGE_NOT_SQL";
  else if (row.identity.callerSymbol.endsWith("#<initializer>")) reason = "STATIC_INITIALIZER";
  else if (row.sourcePath.includes("/src/test/")) reason = "TEST_FIXTURE_SETUP";
  else if (row.identity.mechanism === "JDBC_UPDATE") reason = "NON_REPEATED_OWNER_WRITE";

  if (reason) {
    return {
      candidateId: row.id,
      sourcePath: row.sourcePath,
      line: row.line,
      column: row.column,
      identity: row.identity,
      disposition: "NOT_RUNTIME_BUDGET_WITH_REASON",
      exclusion: {reason},
      sourceEvidence,
    };
  }

  return {
    candidateId: row.id,
    sourcePath: row.sourcePath,
    line: row.line,
    column: row.column,
    identity: row.identity,
    disposition: "RUNTIME_BUDGET_REQUIRED",
    ledgerBinding: {
      kind: "NEW_LEDGER_CASE",
      ledgerId: `CANDIDATE_${row.id}`,
      caseId: "RUNTIME_DISCOVERY",
      coverage: "DECLARED_FOR_FUTURE_MEASURED_BUDGET_EXPANSION",
    },
    sourceEvidence,
  };
}

function validateRecoveryReceipt(root, receiptPath) {
  const receipt = readJson(root, receiptPath, "CANONICAL_LEDGER_RECOVERY_RECEIPT");
  if (receipt.schemaVersion !== 1 || receipt.kind !== "canonical-performance-candidate-recovery-receipt") fail("CANONICAL_LEDGER_RECOVERY_RECEIPT_INVALID");
  if (JSON.stringify(receipt.expectedOldCandidateScan) !== JSON.stringify(EXPECTED_OLD_CANDIDATE_SCAN)) fail("CANONICAL_LEDGER_RECOVERY_EXPECTATION_INVALID");
  if (receipt.status !== "OLD_ROW_SET_UNRECOVERABLE") fail(`CANONICAL_LEDGER_RECOVERY_STATUS_INVALID:${receipt.status}`);
  if (!Array.isArray(receipt.locations) || receipt.locations.length !== FINITE_RECOVERY_LOCATIONS.length) fail("CANONICAL_LEDGER_RECOVERY_LOCATION_SET_INVALID");
  const actualPaths = receipt.locations.map((entry) => entry.path).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify([...FINITE_RECOVERY_LOCATIONS].sort())) fail("CANONICAL_LEDGER_RECOVERY_LOCATION_SET_INVALID");
  for (const entry of receipt.locations) {
    if (!entry || !["FOUND_WITH_FINGERPRINT", "NOT_PRESENT_OR_NO_ROW_SET"].includes(entry.result)) fail("CANONICAL_LEDGER_RECOVERY_LOCATION_RESULT_INVALID");
    if (entry.sha256 !== fileHash(root, entry.path)) fail(`CANONICAL_LEDGER_RECOVERY_SOURCE_HASH_DRIFT:${entry.path}`);
    if (entry.result === "FOUND_WITH_FINGERPRINT") fail("CANONICAL_LEDGER_RECOVERY_FOUND_ROW_SET_NOT_ACCEPTED");
  }
  return receipt;
}

function validateCandidateDisposition(root, ledger, current, dispositionPath = DEFAULT_DISPOSITION_PATH) {
  const disposition = readJson(root, dispositionPath, "CANONICAL_LEDGER_CANDIDATE_DISPOSITION");
  if (disposition.schemaVersion !== 1 || disposition.kind !== "canonical-performance-candidate-disposition" || disposition.status !== "PASS") fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_INVALID");
  validateRecoveryReceipt(root, disposition.recoveryReceiptPath);
  if (!disposition.sourceScan || disposition.sourceScan.count !== current.rows.length || disposition.sourceScan.fingerprint !== current.fingerprint) fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_SCAN_DRIFT");
  if (!Array.isArray(disposition.rows) || disposition.rows.length !== current.rows.length) fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_ROW_COUNT_INVALID");

  const currentById = new Map(current.rows.map((row) => [row.id, row]));
  const seen = new Set();
  for (const entry of disposition.rows) {
    if (!entry || typeof entry !== "object" || !currentById.has(entry.candidateId) || seen.has(entry.candidateId)) fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_EXACT_SET_INVALID");
    seen.add(entry.candidateId);
    const candidate = currentById.get(entry.candidateId);
    if (entry.sourcePath !== candidate.sourcePath || entry.line !== candidate.line || entry.column !== candidate.column || !sameIdentity(entry.identity, candidate.identity)) fail(`CANONICAL_LEDGER_CANDIDATE_SOURCE_SUBSTITUTION:${entry.candidateId}`);
    const expectedSource = candidateSourceEvidence(root, candidate);
    if (JSON.stringify(entry.sourceEvidence) !== JSON.stringify(expectedSource)) fail(`CANONICAL_LEDGER_CANDIDATE_SOURCE_EVIDENCE_DRIFT:${entry.candidateId}`);
    if (!DISPOSITION_VALUES.has(entry.disposition)) fail(`CANONICAL_LEDGER_CANDIDATE_DISPOSITION_VALUE_INVALID:${entry.candidateId}`);
    const expected = dispositionForCandidate(root, ledger, candidate);
    if (entry.disposition !== expected.disposition) fail(`CANONICAL_LEDGER_CANDIDATE_JUDGEMENT_INVALID:${entry.candidateId}`);
    if (entry.disposition === "NOT_RUNTIME_BUDGET_WITH_REASON") {
      if (entry.exclusion?.reason !== expected.exclusion.reason || !EXCLUSION_REASONS.has(entry.exclusion.reason)) fail(`CANONICAL_LEDGER_CANDIDATE_EXCLUSION_REASON_INVALID:${entry.candidateId}`);
    } else if (entry.disposition === "COVERED_BY_EXISTING_LEDGER_ROW") {
      if (JSON.stringify(entry.ledgerBinding) !== JSON.stringify(expected.ledgerBinding)) fail(`CANONICAL_LEDGER_CANDIDATE_EXISTING_BINDING_INVALID:${entry.candidateId}`);
    } else if (JSON.stringify(entry.ledgerBinding) !== JSON.stringify(expected.ledgerBinding)) {
      fail(`CANONICAL_LEDGER_CANDIDATE_NEW_BINDING_INVALID:${entry.candidateId}`);
    }
  }
  if (seen.size !== current.rows.length) fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_EXACT_SET_INVALID");
  return disposition;
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

function validateLedger(root, ledgerPath, options = {requireDisposition: true}) {
  const absolute = path.join(root, ledgerPath);
  if (!fs.existsSync(absolute)) fail(`P4_CANONICAL_LEDGER_NOT_READY:${ledgerPath}`);
  const ledger = loadLedgerShape(root, ledgerPath);
  const current = derive(root);
  if (!ledger.candidateScan || typeof ledger.candidateScan !== "object") fail("CANONICAL_LEDGER_CANDIDATE_SCAN_MISSING");
  if (!Number.isInteger(ledger.candidateScan.count) || ledger.candidateScan.count < 0 || typeof ledger.candidateScan.fingerprint !== "string") {
    fail("CANONICAL_LEDGER_CANDIDATE_SCAN_INVALID");
  }
  if (ledger.candidateScan.count !== current.rows.length || ledger.candidateScan.fingerprint !== current.fingerprint) {
    fail("CANONICAL_LEDGER_CANDIDATE_SCAN_DRIFT");
  }
  if (options.requireDisposition) {
    if (!ledger.candidateDisposition || ledger.candidateDisposition.path !== DEFAULT_DISPOSITION_PATH || typeof ledger.candidateDisposition.sha256 !== "string") fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_BINDING_MISSING");
    validateCandidateDisposition(root, ledger, current, ledger.candidateDisposition.path);
    if (ledger.candidateDisposition.sha256 !== fileHash(root, ledger.candidateDisposition.path)) fail("CANONICAL_LEDGER_CANDIDATE_DISPOSITION_HASH_DRIFT");
  }
  return {ledger, current};
}

function baselineCaseKey(ledgerId, caseId) {
  return `${ledgerId}#${caseId}`;
}

function ledgerCases(ledger) {
  return ledger.rows.flatMap((row) => row.budget.cases.map((entry) => ({
    key: baselineCaseKey(row.id, entry.id),
    ledgerId: row.id,
    caseId: entry.id,
    expectedStatements: entry.expectedStatements,
    row,
  }))).sort((left, right) => left.key.localeCompare(right.key));
}

function testEvidencePath(root, row) {
  const override = BASELINE_TEST_SOURCE_OVERRIDES[row.id];
  if (override) {
    if (!fs.existsSync(path.join(root, override))) fail(`CANONICAL_BASELINE_SOURCE_EVIDENCE_MISSING:${row.id}`);
    return override;
  }
  const files = row.roots.test.flatMap((relative) => filesBelow(root, relative));
  const exactName = `${row.testClass}.java`;
  const allTestFiles = roots(root, TEST_ROOT_MATCHERS).flatMap((relative) => filesBelow(root, relative));
  const exactMatches = [...new Set([...files, ...allTestFiles].filter((relative) => path.posix.basename(relative) === exactName))];
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) fail(`CANONICAL_BASELINE_SOURCE_EVIDENCE_AMBIGUOUS:${row.id}`);
  const methodName = row.identity.callerSymbol.split("#")[1]?.replace(/\(.*/, "");
  const byMethod = methodName && files.filter((relative) => fs.readFileSync(path.join(root, relative), "utf8").includes(methodName));
  if (byMethod?.length === 1) return byMethod[0];
  fail(`CANONICAL_BASELINE_SOURCE_EVIDENCE_AMBIGUOUS:${row.id}`);
}

function baselineSourceEvidence(root, entry) {
  const sourcePath = testEvidencePath(root, entry.row);
  return {
    path: sourcePath,
    sha256: fileHash(root, sourcePath),
    anchor: `${sourcePath}::${entry.row.testClass}::${entry.row.identity.callerSymbol}::${entry.caseId}::fresh-remote-P4`,
  };
}

function relativePath(root, absolute) {
  const relative = posix(path.relative(root, absolute));
  if (!relative || relative.startsWith("../") || relative === "..") fail("CANONICAL_BASELINE_EVIDENCE_OUTSIDE_ROOT");
  return relative;
}

function measurementEvidence(root, evidencePath) {
  const requested = path.resolve(root, evidencePath);
  const manifestAbsolute = fs.existsSync(requested) && fs.statSync(requested).isDirectory()
    ? path.join(requested, "run-manifest.json")
    : requested;
  const manifestPath = relativePath(root, manifestAbsolute);
  const manifest = readJson(root, manifestPath, "CANONICAL_BASELINE_RUN_MANIFEST");
  if (manifest.kind !== "r5-managed-testcontainers-run" || typeof manifest.runId !== "string" || manifest.task !== ":apps:backend:catering-business-server:test") {
    fail("CANONICAL_BASELINE_RUN_MANIFEST_INVALID");
  }
  if (manifest.business?.status !== "PASS" || manifest.cleanup?.status !== "PASS" || manifest.cleanup?.reaped !== true) {
    fail("CANONICAL_BASELINE_RUN_NOT_CLEAN");
  }
  return {
    kind: "MANAGED_REMOTE_P4_TESTCONTAINERS",
    runId: manifest.runId,
    evidencePath: relativePath(root, path.dirname(manifestAbsolute)),
    runManifestPath: manifestPath,
    runManifestSha256: fileHash(root, manifestPath),
    task: manifest.task,
    businessStatus: manifest.business.status,
    cleanupStatus: manifest.cleanup.status,
  };
}

function packageChangeSurfaces(root) {
  const packagePath = path.join(root, ".runtime/compliance-control/active-package.json");
  if (!fs.existsSync(packagePath)) return [];
  const packageState = readJson(root, ".runtime/compliance-control/active-package.json", "CANONICAL_BASELINE_ACTIVE_PACKAGE");
  return [...new Set([
    ...(Array.isArray(packageState.changedPaths) ? packageState.changedPaths : []),
    ...(Array.isArray(packageState.allowedChangeSurfaces) ? packageState.allowedChangeSurfaces : []),
  ])];
}

function validateAuthorityArtifact(root, artifact, entry) {
  if (!artifact || typeof artifact !== "object" || typeof artifact.path !== "string" || typeof artifact.sha256 !== "string") fail(`CANONICAL_BASELINE_AUTHORITY_INVALID:${entry.key}`);
  if (fileHash(root, artifact.path) !== artifact.sha256) fail(`CANONICAL_BASELINE_AUTHORITY_HASH_DRIFT:${entry.key}`);
  const authority = readJson(root, artifact.path, "CANONICAL_BASELINE_AUTHORITY");
  if (authority.schemaVersion !== 1 || authority.kind !== "DEXTER_EXPLICIT_SQL_BUDGET_INCREASE_AUTHORITY" || authority.status !== "APPROVED" || authority.approver !== "DEXTER") {
    fail(`CANONICAL_BASELINE_AUTHORITY_KIND_INVALID:${entry.key}`);
  }
  if (authority.prePackageEntry !== true || typeof authority.decisionId !== "string" || authority.ledgerId !== entry.ledgerId || authority.caseId !== entry.caseId) {
    fail(`CANONICAL_BASELINE_AUTHORITY_PREPACKAGE_INVALID:${entry.key}`);
  }
  if (authority.previousExpectedStatements !== entry.previousExpectedStatements || authority.approvedExpectedStatements !== entry.expectedStatements || typeof authority.reason !== "string" || authority.reason.trim() === "") {
    fail(`CANONICAL_BASELINE_AUTHORITY_VALUES_INVALID:${entry.key}`);
  }
  if (packageChangeSurfaces(root).includes(artifact.path)) fail(`CANONICAL_BASELINE_AUTHORITY_IN_CURRENT_PACKAGE:${entry.key}`);
}

function validateBaseline(root, ledger, baselinePath = DEFAULT_BASELINE_PATH) {
  const baseline = readJson(root, baselinePath, "CANONICAL_PERFORMANCE_BASELINE");
  if (baseline.schemaVersion !== 1 || baseline.kind !== "canonical-performance-accepted-baseline" || baseline.status !== "PASS") fail("CANONICAL_PERFORMANCE_BASELINE_INVALID");
  if (baseline.ledgerPath !== DEFAULT_LEDGER_PATH || !baseline.measurementEvidence) fail("CANONICAL_PERFORMANCE_BASELINE_BINDING_INVALID");
  if (fileHash(root, baseline.measurementEvidence.runManifestPath) !== baseline.measurementEvidence.runManifestSha256) fail("CANONICAL_PERFORMANCE_BASELINE_MEASUREMENT_HASH_DRIFT");
  const expected = ledgerCases(ledger);
  if (!Array.isArray(baseline.cases) || baseline.cases.length !== expected.length) fail("CANONICAL_PERFORMANCE_BASELINE_CASE_SET_INVALID");
  const expectedByKey = new Map(expected.map((entry) => [entry.key, entry]));
  const seen = new Set();
  for (const entry of baseline.cases) {
    const key = baselineCaseKey(entry?.ledgerId, entry?.caseId);
    const expectedEntry = expectedByKey.get(key);
    if (!expectedEntry || seen.has(key) || !Array.isArray(entry.history) || entry.history.length === 0) fail(`CANONICAL_PERFORMANCE_BASELINE_CASE_SET_INVALID:${key}`);
    seen.add(key);
    let previous = null;
    entry.history.forEach((history, index) => {
      if (!history || history.sequence !== index + 1 || !Number.isInteger(history.expectedStatements) || history.expectedStatements < 1 || history.previousExpectedStatements !== previous || !["INITIAL", "DECREASE", "INCREASE"].includes(history.changeKind) || history.approvalStatus !== "APPROVED") {
        fail(`CANONICAL_PERFORMANCE_BASELINE_HISTORY_INVALID:${key}`);
      }
      if (index === 0 && (history.changeKind !== "INITIAL" || history.previousExpectedStatements !== null)) fail(`CANONICAL_PERFORMANCE_BASELINE_INITIAL_INVALID:${key}`);
      if (history.changeKind === "DECREASE" && !(history.expectedStatements < history.previousExpectedStatements)) fail(`CANONICAL_PERFORMANCE_BASELINE_DECREASE_INVALID:${key}`);
      if (history.changeKind === "INCREASE") {
        if (!(history.expectedStatements > history.previousExpectedStatements)) fail(`CANONICAL_PERFORMANCE_BASELINE_INCREASE_INVALID:${key}`);
        validateAuthorityArtifact(root, history.authorityArtifact, {
          key,
          ledgerId: entry.ledgerId,
          caseId: entry.caseId,
          previousExpectedStatements: history.previousExpectedStatements,
          expectedStatements: history.expectedStatements,
        });
      }
      if (history.changeKind !== "INITIAL" && history.sourceEvidence === undefined) fail(`CANONICAL_PERFORMANCE_BASELINE_SOURCE_EVIDENCE_MISSING:${key}`);
      if (!history.sourceEvidence || fileHash(root, history.sourceEvidence.path) !== history.sourceEvidence.sha256) fail(`CANONICAL_PERFORMANCE_BASELINE_SOURCE_EVIDENCE_DRIFT:${key}`);
      previous = history.expectedStatements;
    });
    if (entry.latestExpectedStatements !== previous || previous !== expectedEntry.expectedStatements) fail(`CANONICAL_PERFORMANCE_BASELINE_CURRENT_MISMATCH:${key}`);
  }
  if (seen.size !== expected.length) fail("CANONICAL_PERFORMANCE_BASELINE_CASE_SET_INVALID");
  return baseline;
}

function writeAcceptedBaseline(root, evidencePath, baselinePath = DEFAULT_BASELINE_PATH) {
  const target = path.join(root, baselinePath);
  if (fs.existsSync(target)) fail("CANONICAL_PERFORMANCE_BASELINE_ALREADY_EXISTS");
  const {ledger} = validateLedger(root, DEFAULT_LEDGER_PATH);
  const measurement = measurementEvidence(root, evidencePath);
  const baseline = {
    schemaVersion: 1,
    kind: "canonical-performance-accepted-baseline",
    status: "PASS",
    ledgerPath: DEFAULT_LEDGER_PATH,
    measurementEvidence: measurement,
    cases: ledgerCases(ledger).map((entry) => ({
      ledgerId: entry.ledgerId,
      caseId: entry.caseId,
      latestExpectedStatements: entry.expectedStatements,
      history: [{
        sequence: 1,
        previousExpectedStatements: null,
        expectedStatements: entry.expectedStatements,
        changeKind: "INITIAL",
        reason: "FRESH_REMOTE_P4_MEASUREMENT",
        sourceEvidence: baselineSourceEvidence(root, entry),
        approvalStatus: "APPROVED",
      }],
    })),
  };
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, `${JSON.stringify(baseline, null, 2)}\n`);
  validateBaseline(root, ledger, baselinePath);
  process.stdout.write(`CANONICAL_PERFORMANCE_BASELINE=PASS\nCASES=${baseline.cases.length}\nMEASUREMENT_RUN=${measurement.runId}\nCLEANUP=PASS\n`);
}

function baselineSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-canonical-baseline-"));
  try {
    fs.mkdirSync(path.join(root, "apps/example/src/main/java"), {recursive: true});
    fs.mkdirSync(path.join(root, "apps/example/src/test/java"), {recursive: true});
    fs.writeFileSync(path.join(root, "apps/example/src/main/java/Example.java"), "class Example {}\n");
    fs.writeFileSync(path.join(root, "apps/example/src/test/java/ExampleTest.java"), "class ExampleTest {}\n");
    const scan = derive(root);
    const ledger = fixtureLedger(scan);
    fs.mkdirSync(path.join(root, "doc/evidence/platform/rm1/p4"), {recursive: true});
    fs.writeFileSync(path.join(root, DEFAULT_LEDGER_PATH), `${JSON.stringify(ledger, null, 2)}\n`);
    const manifestPath = ".runtime/r5/evidence/remote-testcontainers/fixture/run-manifest.json";
    fs.mkdirSync(path.dirname(path.join(root, manifestPath)), {recursive: true});
    fs.writeFileSync(path.join(root, manifestPath), `${JSON.stringify({schemaVersion: 1, kind: "r5-managed-testcontainers-run", runId: "fixture-run", task: ":apps:backend:catering-business-server:test", business: {status: "PASS"}, cleanup: {status: "PASS", reaped: true}}, null, 2)}\n`);
    const evidence = measurementEvidence(root, path.dirname(manifestPath));
    const baseline = {
      schemaVersion: 1,
      kind: "canonical-performance-accepted-baseline",
      status: "PASS",
      ledgerPath: DEFAULT_LEDGER_PATH,
      measurementEvidence: evidence,
      cases: [{
        ledgerId: "fixture-row",
        caseId: "fixture",
        latestExpectedStatements: 2,
        history: [{sequence: 1, previousExpectedStatements: null, expectedStatements: 2, changeKind: "INITIAL", reason: "FRESH_REMOTE_P4_MEASUREMENT", sourceEvidence: {path: "apps/example/src/test/java/ExampleTest.java", sha256: fileHash(root, "apps/example/src/test/java/ExampleTest.java"), anchor: "fixture"}, approvalStatus: "APPROVED"}],
      }],
    };
    const baselinePath = "baseline.json";
    fs.writeFileSync(path.join(root, baselinePath), `${JSON.stringify(baseline, null, 2)}\n`);
    validateBaseline(root, ledger, baselinePath);

    const raisedLedger = structuredClone(ledger);
    raisedLedger.rows[0].budget.cases[0].expectedStatements = 3;
    fs.writeFileSync(path.join(root, DEFAULT_LEDGER_PATH), `${JSON.stringify(raisedLedger, null, 2)}\n`);
    try { validateBaseline(root, raisedLedger, baselinePath); fail("CANONICAL_BASELINE_SELF_TEST_CURRENT_RAISE_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("CURRENT_MISMATCH")) throw error;
    }
    fs.writeFileSync(path.join(root, DEFAULT_LEDGER_PATH), `${JSON.stringify(ledger, null, 2)}\n`);
    const brokenHistory = structuredClone(baseline);
    brokenHistory.cases[0].history[0].expectedStatements = 3;
    brokenHistory.cases[0].latestExpectedStatements = 3;
    fs.writeFileSync(path.join(root, baselinePath), `${JSON.stringify(brokenHistory, null, 2)}\n`);
    try { validateBaseline(root, ledger, baselinePath); fail("CANONICAL_BASELINE_SELF_TEST_UNAUTHORIZED_SYNC_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("INITIAL") && !error.message.includes("CURRENT")) throw error;
    }
    fs.writeFileSync(path.join(root, baselinePath), `${JSON.stringify(baseline, null, 2)}\n`);
    const authorityPath = "authority.json";
    const authority = {schemaVersion: 1, kind: "DEXTER_EXPLICIT_SQL_BUDGET_AUTHORITY", status: "APPROVED", approver: "DEXTER", prePackageEntry: true, decisionId: "fixture-decision", ledgerId: "fixture-row", caseId: "fixture", previousExpectedStatements: 2, approvedExpectedStatements: 3, reason: "fixture"};
    fs.writeFileSync(path.join(root, authorityPath), `${JSON.stringify(authority, null, 2)}\n`);
    const raisedBaseline = structuredClone(baseline);
    raisedBaseline.cases[0].latestExpectedStatements = 3;
    raisedBaseline.cases[0].history.push({sequence: 2, previousExpectedStatements: 2, expectedStatements: 3, changeKind: "INCREASE", reason: "fixture", sourceEvidence: baseline.cases[0].history[0].sourceEvidence, approvalStatus: "APPROVED", authorityArtifact: {path: authorityPath, sha256: fileHash(root, authorityPath)}});
    fs.writeFileSync(path.join(root, baselinePath), `${JSON.stringify(raisedBaseline, null, 2)}\n`);
    try { validateBaseline(root, ledger, baselinePath); fail("CANONICAL_BASELINE_SELF_TEST_UNKNOWN_AUTHORITY_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("AUTHORITY_KIND_INVALID")) throw error;
    }
    const packagePath = ".runtime/compliance-control/active-package.json";
    fs.mkdirSync(path.dirname(path.join(root, packagePath)), {recursive: true});
    fs.writeFileSync(path.join(root, packagePath), JSON.stringify({allowedChangeSurfaces: [authorityPath]}));
    const validAuthority = {...authority, kind: "DEXTER_EXPLICIT_SQL_BUDGET_INCREASE_AUTHORITY"};
    fs.writeFileSync(path.join(root, authorityPath), `${JSON.stringify(validAuthority, null, 2)}\n`);
    raisedBaseline.cases[0].history[1].authorityArtifact.sha256 = fileHash(root, authorityPath);
    fs.writeFileSync(path.join(root, baselinePath), `${JSON.stringify(raisedBaseline, null, 2)}\n`);
    try { validateBaseline(root, ledger, baselinePath); fail("CANONICAL_BASELINE_SELF_TEST_SAME_PACKAGE_AUTHORITY_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("IN_CURRENT_PACKAGE")) throw error;
    }
    process.stdout.write("RED_BASELINE_CURRENT_RAISE=PASS\nRED_BASELINE_UNAUTHORIZED_SYNC=PASS\nRED_BASELINE_UNKNOWN_AUTHORITY=PASS\nRED_BASELINE_SAME_PACKAGE_AUTHORITY=PASS\n");
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
}

function writeReconciliation(root, ledgerPath = DEFAULT_LEDGER_PATH) {
  const current = derive(root);
  const ledger = loadLedgerShape(root, ledgerPath);
  const recovery = buildRecoveryReceipt(root);
  if (recovery.status !== "OLD_ROW_SET_UNRECOVERABLE") fail("CANONICAL_LEDGER_RECOVERY_REQUIRES_EXACT_DIFF_IMPLEMENTATION");

  const recoveryAbsolute = path.join(root, DEFAULT_RECOVERY_PATH);
  fs.mkdirSync(path.dirname(recoveryAbsolute), {recursive: true});
  fs.writeFileSync(recoveryAbsolute, `${JSON.stringify(recovery, null, 2)}\n`);

  const disposition = {
    schemaVersion: 1,
    kind: "canonical-performance-candidate-disposition",
    status: "PASS",
    recoveryReceiptPath: DEFAULT_RECOVERY_PATH,
    recoveryReceiptSha256: fileHash(root, DEFAULT_RECOVERY_PATH),
    sourceScan: {count: current.rows.length, fingerprint: current.fingerprint, roots: current.roots},
    closedExclusionReasons: [...EXCLUSION_REASONS].sort(),
    rows: current.rows.map((row) => dispositionForCandidate(root, ledger, row)),
  };
  const dispositionAbsolute = path.join(root, DEFAULT_DISPOSITION_PATH);
  fs.mkdirSync(path.dirname(dispositionAbsolute), {recursive: true});
  fs.writeFileSync(dispositionAbsolute, `${JSON.stringify(disposition, null, 2)}\n`);

  const refreshedLedger = {
    ...ledger,
    candidateScan: {count: current.rows.length, fingerprint: current.fingerprint},
    candidateDisposition: {path: DEFAULT_DISPOSITION_PATH, sha256: fileHash(root, DEFAULT_DISPOSITION_PATH)},
  };
  fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(refreshedLedger, null, 2)}\n`);
  validateLedger(root, ledgerPath);
  const counts = Object.fromEntries([...DISPOSITION_VALUES].sort().map((value) => [value, disposition.rows.filter((row) => row.disposition === value).length]));
  process.stdout.write(`CANONICAL_PERFORMANCE_RECONCILIATION=PASS\nCANDIDATES=${current.rows.length}\nDISPOSITIONS=${JSON.stringify(counts)}\nRECOVERY=OLD_ROW_SET_UNRECOVERABLE\nCLEANUP=PASS\n`);
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
    validateLedger(root, ledgerPath, {requireDisposition: false});
    const omitted = structuredClone(clean);
    omitted.rows[0].budget = "";
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(omitted, null, 2)}\n`);
    try { validateLedger(root, ledgerPath, {requireDisposition: false}); fail("CANONICAL_LEDGER_SELF_TEST_OMISSION_NOT_DETECTED"); } catch (error) {
      if (error.message !== "CANONICAL_LEDGER_ROW_BUDGET_INVALID:fixture-row") throw error;
    }
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(clean, null, 2)}\n`);
    fs.appendFileSync(source, "class Next { void write() { jdbcTemplate.queryForObject(\"SELECT count(*) FROM example\", Integer.class); } }\n");
    try { validateLedger(root, ledgerPath, {requireDisposition: false}); fail("CANONICAL_LEDGER_SELF_TEST_DERIVED_EDGE_CHANGE_NOT_DETECTED"); } catch (error) {
      if (error.message !== "CANONICAL_LEDGER_CANDIDATE_SCAN_DRIFT") throw error;
    }
    const second = derive(root);
    if (first.rows.length !== 3 || new Set(first.rows.map((row) => row.id)).size !== 3) fail("CANONICAL_LEDGER_SELF_TEST_SAME_LINE_EDGES_NOT_DISTINCT");
    if (first.rows.some((row) => row.identity.queryBoundarySymbol === "result.getObject") || !first.rows.some((row) => row.identity.queryBoundarySymbol === "objects.exists")) fail("CANONICAL_LEDGER_SELF_TEST_OBJECT_STORE_BOUNDARY_INVALID");
    if (second.rows.length !== first.rows.length + 1 || second.fingerprint === first.fingerprint) fail("CANONICAL_LEDGER_SELF_TEST_DERIVED_SET_NOT_CHANGED");
    const refreshed = fixtureLedger(second);
    fs.writeFileSync(path.join(root, ledgerPath), `${JSON.stringify(refreshed, null, 2)}\n`);
    validateLedger(root, ledgerPath, {requireDisposition: false});
    const recovery = {
      schemaVersion: 1,
      kind: "canonical-performance-candidate-recovery-receipt",
      expectedOldCandidateScan: EXPECTED_OLD_CANDIDATE_SCAN,
      status: "OLD_ROW_SET_UNRECOVERABLE",
      locations: FINITE_RECOVERY_LOCATIONS.map((relative) => ({path: relative, sha256: "ABSENT", result: "NOT_PRESENT_OR_NO_ROW_SET"})),
    };
    fs.writeFileSync(path.join(root, "recovery.json"), `${JSON.stringify(recovery, null, 2)}\n`);
    const disposition = {
      schemaVersion: 1,
      kind: "canonical-performance-candidate-disposition",
      status: "PASS",
      recoveryReceiptPath: "recovery.json",
      recoveryReceiptSha256: fileHash(root, "recovery.json"),
      sourceScan: {count: second.rows.length, fingerprint: second.fingerprint, roots: second.roots},
      closedExclusionReasons: [...EXCLUSION_REASONS].sort(),
      rows: second.rows.map((row) => dispositionForCandidate(root, refreshed, row)),
    };
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(disposition, null, 2)}\n`);
    validateCandidateDisposition(root, refreshed, second, "candidate-disposition.json");
    const omittedDisposition = structuredClone(disposition);
    omittedDisposition.rows.pop();
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(omittedDisposition, null, 2)}\n`);
    try { validateCandidateDisposition(root, refreshed, second, "candidate-disposition.json"); fail("CANONICAL_LEDGER_SELF_TEST_DISPOSITION_OMISSION_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("CANDIDATE_DISPOSITION_ROW_COUNT_INVALID")) throw error;
    }
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(disposition, null, 2)}\n`);
    const substituted = structuredClone(disposition);
    substituted.rows[0].sourcePath = "apps/example/src/main/java/Other.java";
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(substituted, null, 2)}\n`);
    try { validateCandidateDisposition(root, refreshed, second, "candidate-disposition.json"); fail("CANONICAL_LEDGER_SELF_TEST_SOURCE_SUBSTITUTION_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("CANDIDATE_SOURCE_SUBSTITUTION")) throw error;
    }
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(disposition, null, 2)}\n`);
    const staleFingerprint = structuredClone(disposition);
    staleFingerprint.sourceScan.fingerprint = first.fingerprint;
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(staleFingerprint, null, 2)}\n`);
    try { validateCandidateDisposition(root, refreshed, second, "candidate-disposition.json"); fail("CANONICAL_LEDGER_SELF_TEST_FINGERPRINT_ONLY_NOT_DETECTED"); } catch (error) {
      if (!error.message.includes("CANDIDATE_DISPOSITION_SCAN_DRIFT")) throw error;
    }
    baselineSelfTest();
    fs.writeFileSync(path.join(root, "candidate-disposition.json"), `${JSON.stringify(disposition, null, 2)}\n`);
    process.stdout.write("CANONICAL_PERFORMANCE_LEDGER_SELF_TEST=PASS\nRED_LEDGER_REQUIRED_FIELD=PASS\nRED_DERIVED_EDGE_CHANGE=PASS\nRED_OBJECT_STORE_BOUNDARY=PASS\nCANONICAL_PERFORMANCE_BASELINE_SELF_TEST=PASS\nCLEANUP=PASS\n");
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
}

const command = process.argv[2] || "scan";
try {
  if (command === "--self-test" || command === "self-test") selfTest();
  else if (command === "scan") process.stdout.write(`${JSON.stringify(derive(process.cwd()), null, 2)}\n`);
  else if (command === "reconcile") writeReconciliation(process.cwd(), process.argv[3] || DEFAULT_LEDGER_PATH);
  else if (command === "baseline-create") writeAcceptedBaseline(process.cwd(), process.argv[3], process.argv[4] || DEFAULT_BASELINE_PATH);
  else if (command === "baseline-check") {
    const {ledger} = validateLedger(process.cwd(), process.argv[3] || DEFAULT_LEDGER_PATH);
    const baseline = validateBaseline(process.cwd(), ledger, process.argv[4] || DEFAULT_BASELINE_PATH);
    process.stdout.write(`CANONICAL_PERFORMANCE_BASELINE=PASS\nCASES=${baseline.cases.length}\nMEASUREMENT_RUN=${baseline.measurementEvidence.runId}\nCLEANUP=PASS\n`);
  } else if (command === "baseline-self-test") baselineSelfTest();
  else if (command === "check") {
    const {ledger, current} = validateLedger(process.cwd(), process.argv[3] || DEFAULT_LEDGER_PATH);
    const baseline = validateBaseline(process.cwd(), ledger, process.argv[4] || DEFAULT_BASELINE_PATH);
    process.stdout.write(`CANONICAL_PERFORMANCE_LEDGER=PASS\nROWS=${ledger.rows.length}\nCANDIDATES=${current.rows.length}\n`);
    process.stdout.write(`CANONICAL_PERFORMANCE_BASELINE=PASS\nCASES=${baseline.cases.length}\nMEASUREMENT_RUN=${baseline.measurementEvidence.runId}\n`);
  } else fail("USAGE: canonical-ledger-scanner <scan|reconcile|check [ledger-path] [baseline-path]|baseline-create <evidence-path>|baseline-check|baseline-self-test|--self-test>");
} catch (error) { process.stderr.write(`CANONICAL_PERFORMANCE_LEDGER=FAIL\nREASON=${error.message}\n`); process.exitCode = 1; }
