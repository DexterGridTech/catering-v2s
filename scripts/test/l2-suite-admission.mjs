import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const relative = file => path.relative(root, file).split(path.sep).join('/');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = (code, detail = '') => {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
};

function readJson(file, code) {
  if (!existsSync(file)) fail(`${code}_MISSING`, relative(file));
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail(`${code}_INVALID`, relative(file));
  }
}

function selectCaseIds(source, selector) {
  if (selector === 'approvedCaseIds') return source.approvedCaseIds;
  if (selector === 'screens[].caseId') return source.screens?.map(screen => screen.caseId);
  if (selector === 'scenarios[].cases[].caseId') {
    return source.scenarios?.flatMap(scenario => (scenario.cases ?? []).map(entry => entry.caseId));
  }
  if (selector === 'cases[].caseId') return source.cases?.map(entry => entry.caseId);
  if (selector === 'caseFixtures[].caseId') return source.caseFixtures?.map(entry => entry.caseId);
  fail('L2_ADMISSION_CASE_SELECTOR_UNSUPPORTED', selector);
}

function filesUnder(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) fail('L2_ADMISSION_UI_DIRECTORY_MISSING', relative(directory));
  const files = [];
  const visit = (current, currentRelative) => {
    for (const name of readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const childRelative = `${currentRelative}/${name}`;
      if (statSync(absolute).isDirectory()) visit(absolute, childRelative);
      else files.push(childRelative);
    }
  };
  visit(directory, relative(directory));
  return files;
}

function digestFiles(files) {
  return files.map(file => {
    const absolute = path.join(root, file);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) fail('L2_ADMISSION_CONTROL_FILE_MISSING', file);
    const bytes = readFileSync(absolute);
    return {path: file, bytes: bytes.byteLength, sha256: sha256(bytes)};
  });
}

function policyDigest(policy) {
  return sha256(`${JSON.stringify(structuredClone(policy), null, 2)}\n`);
}

function normalizeSourceEntries(policy, configuredSources) {
  return (policy.caseSourcePaths ?? configuredSources).map(entry => {
    if (Array.isArray(entry)) return {path: entry[0], label: entry[1], selector: entry[2]};
    return entry;
  });
}

function resolveCaseIds(policy, caseSourcePaths) {
  const expected = Array.isArray(policy.caseIds)
    ? [...policy.caseIds]
    : selectCaseIds(
        readJson(path.join(root, policy.caseIdsSource.path), 'L2_ADMISSION_CASE_ID_SOURCE'),
        policy.caseIdsSource.selector,
      );
  if (!Array.isArray(expected) || expected.some(value => typeof value !== 'string') || new Set(expected).size !== expected.length) {
    fail('L2_ADMISSION_CASE_DENOMINATOR_INVALID');
  }
  const sources = normalizeSourceEntries(policy, caseSourcePaths);
  const expectedSet = new Set(expected);
  for (const sourceEntry of sources) {
    const actual = selectCaseIds(
      readJson(path.join(root, sourceEntry.path), `L2_ADMISSION_${sourceEntry.label.toUpperCase()}`),
      sourceEntry.selector,
    );
    if (!Array.isArray(actual) || actual.some(value => typeof value !== 'string') || new Set(actual).size !== actual.length) {
      fail('L2_ADMISSION_CASE_SOURCE_INVALID', sourceEntry.label);
    }
    const actualSet = new Set(actual);
    const missing = expected.filter(value => !actualSet.has(value));
    const extra = actual.filter(value => !expectedSet.has(value));
    if (missing.length > 0 || (policy.caseSetMode ?? 'EXACT') === 'EXACT' && extra.length > 0) {
      fail('L2_ADMISSION_CASE_SET_MISMATCH', `${sourceEntry.label}:${missing.join(',')}:${extra.join(',')}`);
    }
    if ((policy.caseSetMode ?? 'EXACT') === 'EXACT' && JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail('L2_ADMISSION_CASE_ORDER_MISMATCH', sourceEntry.label);
    }
  }
  return expected;
}

function validatePolicy(policy, {suite, policyKind, caseSourcePaths}) {
  if (policy.kind !== policyKind || policy.suite !== suite) fail('L2_ADMISSION_POLICY_KIND_INVALID');
  const caseIds = resolveCaseIds(policy, caseSourcePaths);
  const controlPlaneFiles = policy.controlPlaneFiles;
  if (!Array.isArray(controlPlaneFiles) || controlPlaneFiles.length === 0 || new Set(controlPlaneFiles).size !== controlPlaneFiles.length) {
    fail('L2_ADMISSION_CONTROL_PLANE_INVALID');
  }
  const uiSourceDirectories = Array.isArray(policy.uiSourceDirectories)
    ? policy.uiSourceDirectories
    : typeof policy.uiSourceDirectory === 'string'
      ? [policy.uiSourceDirectory]
      : [];
  if (uiSourceDirectories.length === 0 || uiSourceDirectories.some(value => typeof value !== 'string')) fail('L2_ADMISSION_UI_DIRECTORIES_INVALID');
  if (typeof policy.designPath !== 'string' || typeof policy.reviewRecordPath !== 'string') fail('L2_ADMISSION_PATHS_INVALID');
  return {caseIds, controlPlaneFiles, uiSourceDirectories};
}

function executionManifestFiles(runtimeRoot) {
  if (!existsSync(runtimeRoot) || !statSync(runtimeRoot).isDirectory()) return [];
  return readdirSync(runtimeRoot)
    .filter(name => name.startsWith('l2-'))
    .map(name => path.join(runtimeRoot, name, 'l2-execution-manifest.json'))
    .filter(file => existsSync(file));
}

export function createL2SuiteAdmissionStrategy({suite, policyPath, policyKind, caseSourcePaths}) {
  const defaultPolicyPath = policyPath;
  const loadAdmissionPolicy = (requestedPolicyPath = defaultPolicyPath) => {
    const policy = readJson(requestedPolicyPath, 'L2_ADMISSION_POLICY');
    const normalized = validatePolicy(policy, {suite, policyKind, caseSourcePaths});
    return Object.freeze({
      policy,
      policyPath: requestedPolicyPath,
      policyDigest: policyDigest(policy),
      ...normalized,
    });
  };

  const computeAdmissionSnapshot = ({requestedPolicyPath = defaultPolicyPath, reviewRecordPath = null} = {}) => {
    const loaded = loadAdmissionPolicy(requestedPolicyPath);
    const {policy, caseIds, controlPlaneFiles, uiSourceDirectories} = loaded;
    const controlPlane = digestFiles(controlPlaneFiles);
    const uiFiles = uiSourceDirectories.flatMap(directory => filesUnder(path.join(root, directory)));
    const ui = digestFiles([...new Set(uiFiles)]);
    const design = readFileSync(path.join(root, policy.designPath), 'utf8');
    for (const marker of Object.values(policy.requiredMarkers ?? {})) {
      if (marker && !design.includes(marker)) fail('L2_SCRIPT_ADMISSION_MARKER_MISSING', marker);
    }
    const source = {
      schemaVersion: 1,
      suite,
      caseIds: [...caseIds],
      policyPath: relative(requestedPolicyPath),
      policyDigest: loaded.policyDigest,
      controlPlaneFiles: controlPlane,
      uiSourceDirectories,
      uiFiles: ui,
    };
    const admissionDigest = sha256(`${JSON.stringify(source, null, 2)}\n`);
    return Object.freeze({
      status: 'PASS',
      admissionDigest,
      policyDigest: loaded.policyDigest,
      caseIds: [...caseIds],
      controlPlaneFiles: controlPlane.map(file => file.path),
      uiSourceDirectories: [...uiSourceDirectories],
      uiSourceDirectory: uiSourceDirectories.length === 1 ? uiSourceDirectories[0] : null,
      uiFileCount: ui.length,
      fileCount: controlPlane.length + ui.length,
      byteCount: [...controlPlane, ...ui].reduce((total, file) => total + file.bytes, 0),
      source,
      reviewRecordPath: reviewRecordPath ?? policy.reviewRecordPath,
    });
  };

  const validateAdmissionRecord = ({snapshot, reviewText} = {}) => {
    if (!snapshot || typeof snapshot.admissionDigest !== 'string' || typeof reviewText !== 'string') fail('L2_SCRIPT_ADMISSION_RECORD_INVALID');
    if (!reviewText.includes('REVIEW_TARGET=L2_SCRIPT_ADMISSION')) fail('L2_SCRIPT_ADMISSION_REVIEW_TARGET_INVALID');
    if (!reviewText.includes('REVIEWER_KIND=INDEPENDENT_SUBAGENT')) fail('L2_SCRIPT_ADMISSION_REVIEWER_INVALID');
    if (!reviewText.includes('L2_ADMISSION_REVIEW_STATUS=PASS')) fail('L2_SCRIPT_ADMISSION_REVIEW_NOT_PASS');
    if (!reviewText.includes(`ADMISSION_SOURCE_DIGEST=${snapshot.admissionDigest}`)) fail('L2_SCRIPT_ADMISSION_SOURCE_DRIFT');
    return snapshot;
  };

  const validateAdmission = ({requestedPolicyPath = defaultPolicyPath, reviewRecordPath = null} = {}) => {
    const snapshot = computeAdmissionSnapshot({requestedPolicyPath, reviewRecordPath});
    const reviewPath = path.join(root, snapshot.reviewRecordPath);
    if (!existsSync(reviewPath)) fail('L2_SCRIPT_ADMISSION_REVIEW_MISSING', snapshot.reviewRecordPath);
    return validateAdmissionRecord({snapshot, reviewText: readFileSync(reviewPath, 'utf8')});
  };

  const findFailureFamilyBlock = ({runtimeRoot, admissionDigest, caseId, failureCategory} = {}) => {
    if (typeof runtimeRoot !== 'string' || typeof admissionDigest !== 'string' || typeof caseId !== 'string' || typeof failureCategory !== 'string') return null;
    for (const file of executionManifestFiles(runtimeRoot)) {
      let manifest;
      try { manifest = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
      const failed = manifest.business === 'FAIL' || manifest.status === 'FAIL';
      if (manifest.kind === `${suite}-l2-execution-manifest` && manifest.admissionDigest === admissionDigest && manifest.firstFailedCaseId === caseId && manifest.failureCategory === failureCategory && failed && manifest.cleanup === 'PASS') {
        return Object.freeze({runId: manifest.runId, manifestPath: relative(file), caseId, failureCategory});
      }
    }
    return null;
  };

  const assertFailureFamilyOpen = ({runtimeRoot, admissionDigest, activeCaseIds, focusedCaseId = null} = {}) => {
    const cases = focusedCaseId ? [focusedCaseId] : [...(activeCaseIds ?? [])];
    for (const caseId of cases) {
      for (const file of executionManifestFiles(runtimeRoot)) {
        let manifest;
        try { manifest = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
        const failed = manifest.business === 'FAIL' || manifest.status === 'FAIL';
        if (manifest.kind !== `${suite}-l2-execution-manifest` || manifest.admissionDigest !== admissionDigest || manifest.firstFailedCaseId !== caseId || !failed || manifest.cleanup !== 'PASS') continue;
        if (manifest.failureCategory) fail('L2_FAILURE_FAMILY_RETRY_BLOCKED', `${caseId}:${manifest.failureCategory}:${manifest.runId}`);
      }
    }
  };

  return Object.freeze({
    suite,
    policyPath: relative(defaultPolicyPath),
    loadAdmissionPolicy,
    computeAdmissionSnapshot,
    validateAdmission,
    validateAdmissionRecord,
    findFailureFamilyBlock,
    assertFailureFamilyOpen,
  });
}
