#!/usr/bin/env node

import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';
import {validateTerminalUpdateSeedFixture} from './r5-fixture-contract.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(
  repositoryRoot,
  'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json',
);
const schemaPath = path.join(repositoryRoot, 'contracts/terminal/terminal-update-artifact.schema.json');
const expectedInputs = Object.freeze([
  [
    'sample-terminal',
    'FULL',
    'sample-terminal-full.zip',
    'sample-terminal-full.json',
    'sample-terminal-full-package.json',
  ],
  ['sample-terminal', 'HOT', 'sample-terminal-hot.zip', 'sample-terminal-hot.json', null],
  [
    'sample-wallpaper-terminal',
    'FULL',
    'sample-wallpaper-terminal-full.zip',
    'sample-wallpaper-terminal-full.json',
    'sample-wallpaper-terminal-full-package.json',
  ],
  ['sample-wallpaper-terminal', 'HOT', 'sample-wallpaper-terminal-hot.zip', 'sample-wallpaper-terminal-hot.json', null],
]);

const fail = code => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const sha256File = file => {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let read;
    do {
      read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (read > 0) hash.update(buffer.subarray(0, read));
    } while (read > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
};
const json = (file, code) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fail(code);
  }
};
const inside = (base, relative, code, type = 'file') => {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) fail(code);
  const root = fs.realpathSync(base);
  const resolved = path.resolve(root, relative);
  const lexical = path.relative(root, resolved);
  if (!lexical || lexical === '..' || lexical.startsWith(`..${path.sep}`) || path.isAbsolute(lexical)) fail(code);
  const actual = fs.realpathSync(resolved);
  const realRelative = path.relative(root, actual);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) fail(code);
  if (type === 'file' ? !fs.statSync(actual).isFile() : !fs.statSync(actual).isDirectory()) fail(code);
  return actual;
};

export function buildTerminalUpdateSeedPlan({fixture, sourceRunId, root = repositoryRoot}) {
  validateTerminalUpdateSeedFixture(fixture);
  if (typeof sourceRunId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(sourceRunId))
    fail('TERMINAL_UPDATE_SEED_SOURCE_RUN_ID_INVALID');
  const repository = fs.realpathSync(root);
  const sourceRun = inside(
    repository,
    path.join('.runtime/terminal-automation', sourceRunId),
    'TERMINAL_UPDATE_SEED_SOURCE_RUN_INVALID',
    'directory',
  );
  const sourceRunDirectory = sourceRun;
  const runManifestPath = inside(
    sourceRunDirectory,
    'run-manifest.json',
    'TERMINAL_UPDATE_SEED_SOURCE_RUN_MANIFEST_INVALID',
  );
  const runManifest = json(runManifestPath, 'TERMINAL_UPDATE_SEED_SOURCE_RUN_MANIFEST_INVALID');
  if (
    runManifest.kind !== 'terminal-automation-run-manifest' ||
    runManifest.runId !== sourceRunId ||
    runManifest.execution?.phase !== 'update' ||
    runManifest.execution?.case !== 'update.artifacts' ||
    runManifest.business !== 'PASS' ||
    runManifest.cleanup !== 'PASS'
  )
    fail('TERMINAL_UPDATE_SEED_SOURCE_RUN_NOT_COMPLETE');
  const exportDirectory = inside(
    sourceRunDirectory,
    'update/seed-inputs/manifest.json',
    'TERMINAL_UPDATE_SEED_EXPORT_MISSING',
  );
  const exportRoot = path.dirname(exportDirectory);
  const exportManifest = json(exportDirectory, 'TERMINAL_UPDATE_SEED_EXPORT_INVALID');
  if (
    exportManifest.schemaVersion !== 1 ||
    exportManifest.kind !== 'terminal-update-seed-input-manifest' ||
    exportManifest.sourceRunId !== sourceRunId ||
    !Array.isArray(exportManifest.files) ||
    exportManifest.files.length !== 10
  ) {
    fail('TERMINAL_UPDATE_SEED_EXPORT_IDENTITY_INVALID');
  }
  const fileByKey = new Map();
  let measuredBytes = 0;
  const manifestPaths = new Set(exportManifest.files.map(file => file?.path));
  const actualPaths = fs.readdirSync(exportRoot).sort();
  const expectedPaths = [...manifestPaths, 'manifest.json'].sort();
  if (
    manifestPaths.size !== exportManifest.files.length ||
    JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)
  ) {
    fail('TERMINAL_UPDATE_SEED_EXPORT_FILESET_MISMATCH');
  }
  for (const file of exportManifest.files) {
    if (
      !file ||
      typeof file.key !== 'string' ||
      fileByKey.has(file.key) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.byteSize) ||
      file.byteSize < 1 ||
      typeof file.path !== 'string' ||
      path.basename(file.path) !== file.path
    ) {
      fail('TERMINAL_UPDATE_SEED_EXPORT_FILE_INVALID');
    }
    const filePath = inside(exportRoot, file.path, 'TERMINAL_UPDATE_SEED_EXPORT_PATH_INVALID');
    const stat = fs.statSync(filePath);
    if (stat.size !== file.byteSize || sha256File(filePath) !== file.sha256)
      fail(`TERMINAL_UPDATE_SEED_EXPORT_DIGEST_INVALID:${file.key}`);
    fileByKey.set(file.key, {...file, absolutePath: filePath});
    measuredBytes += stat.size;
  }
  if (measuredBytes !== exportManifest.totalBytes || measuredBytes > 1024 * 1024 * 1024)
    fail('TERMINAL_UPDATE_SEED_EXPORT_TOTAL_SIZE_INVALID');

  const schema = json(schemaPath, 'TERMINAL_UPDATE_ARTIFACT_SCHEMA_INVALID');
  const validateArtifact = new Ajv({allErrors: true, strict: false}).compile(schema);
  const artifacts = [];
  for (const [app, kind, zipName, artifactName, packageName] of expectedInputs) {
    const prefix = `${app}-${kind.toLowerCase()}`;
    const zipRecord = fileByKey.get(`${prefix}`);
    const artifactRecord = fileByKey.get(`${prefix}-manifest`);
    if (
      !zipRecord ||
      !artifactRecord ||
      zipRecord.path !== zipName ||
      artifactRecord.path !== artifactName ||
      zipRecord.app !== app ||
      zipRecord.kind !== kind ||
      artifactRecord.app !== app ||
      artifactRecord.kind !== `${kind}_MANIFEST`
    ) {
      fail(`TERMINAL_UPDATE_SEED_ARTIFACT_INPUT_MISSING:${app}:${kind}`);
    }
    const artifact = json(artifactRecord.absolutePath, 'TERMINAL_UPDATE_SEED_ARTIFACT_MANIFEST_INVALID');
    if (!validateArtifact(artifact) || artifact.platform !== 'android')
      fail(`TERMINAL_UPDATE_SEED_ARTIFACT_SCHEMA_INVALID:${app}:${kind}`);
    let packageRecord = null;
    if (packageName) {
      const packageEntry = fileByKey.get(`${prefix}-package`);
      if (
        !packageEntry ||
        packageEntry.path !== packageName ||
        packageEntry.app !== app ||
        packageEntry.kind !== `${kind}_PACKAGE`
      )
        fail(`TERMINAL_UPDATE_SEED_PACKAGE_RECORD_MISSING:${app}`);
      packageRecord = json(packageEntry.absolutePath, 'TERMINAL_UPDATE_SEED_PACKAGE_RECORD_INVALID');
      if (
        packageRecord.schemaVersion !== 1 ||
        packageRecord.publicationId !== artifact.publicationId ||
        packageRecord.zip?.path !== zipName ||
        packageRecord.zip?.sha256 !== zipRecord.sha256 ||
        packageRecord.apk?.sha256 !== artifact.apk?.sha256 ||
        packageRecord.apk?.certificateSha256 !== artifact.apk?.certificateSha256
      ) {
        fail(`TERMINAL_UPDATE_SEED_PACKAGE_RECORD_MISMATCH:${app}`);
      }
    }
    artifacts.push(
      Object.freeze({
        app,
        kind,
        zipPath: zipRecord.absolutePath,
        zipSha256: zipRecord.sha256,
        byteSize: zipRecord.byteSize,
        artifact,
        packageRecord,
      }),
    );
  }
  for (const app of ['sample-terminal', 'sample-wallpaper-terminal']) {
    const full = artifacts.find(item => item.app === app && item.kind === 'FULL');
    const hot = artifacts.find(item => item.app === app && item.kind === 'HOT');
    if (
      !full ||
      !hot ||
      full.artifact.applicationId !== hot.artifact.applicationId ||
      full.artifact.runtimeVersion !== hot.artifact.runtimeVersion ||
      hot.artifact.minimumFull?.applicationId !== full.artifact.applicationId ||
      hot.artifact.minimumFull?.nativeBuildNumber !== full.artifact.nativeBuildNumber ||
      hot.artifact.minimumFull?.runtimeVersion !== full.artifact.runtimeVersion ||
      hot.artifact.minimumFull?.publicationId !== full.artifact.publicationId ||
      hot.artifact.minimumFull?.apkSha256 !== full.artifact.apk?.sha256
    )
      fail(`TERMINAL_UPDATE_SEED_MINIMUM_FULL_MISMATCH:${app}`);
  }
  const sourceDigest = createHash('sha256')
    .update(
      JSON.stringify(
        artifacts.map(item => ({
          app: item.app,
          kind: item.kind,
          zipSha256: item.zipSha256,
          artifactPublicationId: item.artifact.publicationId,
        })),
      ),
    )
    .digest('hex');
  return Object.freeze({
    schemaVersion: 1,
    kind: 'terminal-update-seed-plan',
    status: 'PASS',
    sourceRunId,
    sourceDigest,
    sourceInputRoot: exportRoot,
    sourceInputRelativePath: path.relative(repository, exportRoot),
    artifacts,
    rules: fixture.stableFixtures.terminalUpdate.rules,
  });
}

function planOnly() {
  const sourceRunId = process.env.R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID;
  const fixture = json(fixturePath, 'TERMINAL_UPDATE_SEED_FIXTURE_INVALID');
  const plan = buildTerminalUpdateSeedPlan({fixture, sourceRunId});
  process.stdout.write(
    `R5_TERMINAL_UPDATE_SEED_PLAN=PASS; SOURCE_RUN=${plan.sourceRunId}; ARTIFACTS=${plan.artifacts.length}; RULES=${plan.rules.length}; SOURCE_DIGEST=${plan.sourceDigest}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    planOnly();
  } catch (error) {
    process.stderr.write(
      `R5_TERMINAL_UPDATE_SEED_PLAN=FAIL; REASON=${error.code ?? 'TERMINAL_UPDATE_SEED_PLAN_INVALID'}\n`,
    );
    process.exitCode = 2;
  }
}
