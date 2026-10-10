#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import {openAsBlob} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {managedRuntime, managedSeedEnvironment, invocationKey} from './owner-command-seed-executor.mjs';
import {buildManagedDiagnosticHeaders} from './managed-diagnostic-protocol.mjs';
import {
  loadGeneratedOperationRegistry,
  materializeGeneratedOperationPath,
  resolveGeneratedOperationById,
} from '../test/seed-report.mjs';
import {createSeedHttpClient} from './seed-http-client.mjs';
import {buildTerminalUpdateSeedPlan} from './terminal-update-seed-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, '.runtime/r5'));
const fixturePath = path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
const registryPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
);
const GROUP_WORKSPACE_KEY = 'aurora';
const fail = code => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const unwrap = value => value?.result ?? value?.data ?? value;
const required = (value, code) => (value === undefined || value === null || value === '' ? fail(code) : value);
const safeRunId = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const reportFile = runId => path.join(runtimeRoot, 'seed', 'terminal-update', runId, 'post-step.json');

export function validateTerminalUpdateArtifactReadback(actual, expected) {
  const artifact = unwrap(actual);
  if (
    !artifact ||
    artifact.kind !== expected.kind ||
    artifact.applicationId !== expected.artifact.applicationId ||
    artifact.apkVersion !== expected.artifact.nativeVersion ||
    Number(artifact.nativeBuildNumber) !== Number(expected.artifact.nativeBuildNumber) ||
    artifact.jsVersion !== expected.artifact.bundleVersion ||
    artifact.runtimeVersion !== expected.artifact.runtimeVersion ||
    artifact.publicationId !== expected.artifact.publicationId ||
    artifact.zipSha256 !== expected.zipSha256 ||
    Number(artifact.byteSize) !== Number(expected.byteSize)
  ) {
    fail(`TERMINAL_UPDATE_SEED_ARTIFACT_READBACK_MISMATCH:${expected.app}:${expected.kind}`);
  }
  // The artifact detail endpoint exposes summary metadata only. The owner validates
  // the FULL/HOT relationship when a rule is created, and rule readback verifies refs.
  if (typeof artifact.artifactRef !== 'string' || !/^[0-9a-f-]{36}$/i.test(artifact.artifactRef))
    fail(`TERMINAL_UPDATE_SEED_ARTIFACT_REF_INVALID:${expected.app}:${expected.kind}`);
  return artifact;
}

export function validateTerminalUpdateRuleReadback(actual, expected, refs) {
  const rule = unwrap(actual);
  const expectedStores = (expected.storeKeys ?? []).map(key => refs.stores.get(key)).sort();
  const actualStores = Array.isArray(rule?.storeRefs) ? rule.storeRefs.map(String).sort() : [];
  if (
    !rule ||
    rule.projectRef !== refs.projectRef ||
    rule.targetMode !== expected.targetMode ||
    rule.fullArtifactRef !== refs.artifacts.get(expected.fullArtifactKey) ||
    (rule.hotArtifactRef ?? null) !== (expected.hotArtifactKey ? refs.artifacts.get(expected.hotArtifactKey) : null) ||
    rule.status !== expected.status ||
    Number(rule.nSeconds) !== expected.nSeconds ||
    (rule.hotStrategy ?? null) !== (expected.hotStrategy ?? null) ||
    (rule.mSeconds ?? null) !== expected.mSeconds ||
    JSON.stringify(actualStores) !== JSON.stringify(expectedStores) ||
    !Number.isFinite(Number(rule.createdAtEpochMillis)) ||
    Number(rule.createdAtEpochMillis) < 1
  ) {
    fail(`TERMINAL_UPDATE_SEED_RULE_READBACK_MISMATCH:${expected.key}`);
  }
  if (typeof rule.ruleRef !== 'string' || !/^[0-9a-f-]{36}$/i.test(rule.ruleRef))
    fail(`TERMINAL_UPDATE_SEED_RULE_REF_INVALID:${expected.key}`);
  return rule;
}

function readCandidate(session, type, code) {
  const candidates = Array.isArray(session?.dataNodeCandidates) ? session.dataNodeCandidates : [];
  const found = candidates.find(item => item?.dataNodeType === type && item?.dataNodeCode === code);
  if (!found?.dataNodeRef) fail(`TERMINAL_UPDATE_SEED_DATA_NODE_MISSING:${type}:${code}`);
  return found;
}

function writeReport(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
}

async function execute() {
  const {manifest, credentials} = managedRuntime();
  const environment = managedSeedEnvironment(manifest, credentials);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const runId = required(manifest.runId, 'TERMINAL_UPDATE_SEED_MANAGED_RUN_ID_REQUIRED');
  const sourceRunId = required(
    environment.R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID,
    'TERMINAL_UPDATE_SEED_SOURCE_RUN_ID_REQUIRED',
  );
  const plan = buildTerminalUpdateSeedPlan({fixture, sourceRunId});
  const registry = loadGeneratedOperationRegistry(registryPath);
  const calls = [];
  let sequence = 0;
  let firstFailure = null;
  let cleanup = 'PASS_NO_PERSISTENT_SEED_PROCESS';
  const phases = [];
  let platformCookie = null;
  const request = createSeedHttpClient({
    baseUrl: environment.V2S_DEV_HTTP_BASE_URL,
    resolveOperation: operationId => resolveGeneratedOperationById(registry, operationId),
    materializeOperationPath: materializeGeneratedOperationPath,
    buildDiagnosticHeaders: buildManagedDiagnosticHeaders,
    manifest,
    credentials,
    calls,
    correlationPrefix: 'terminal-update-seed',
    timeoutMs: 30_000,
    idempotencyKeyFor: stage => invocationKey(runId, `${stage}-${sequence++}`),
    failureFactory: code => {
      const error = new Error(code);
      error.code = code;
      return error;
    },
    onPhase: (stage, outcome, details = {}) => phases.push({stage, outcome, ...details}),
  }).request;
  const artifacts = new Map();
  const pendingStages = [];
  const rules = [];
  try {
    const platformLogin = await request(
      'platform-login',
      'platformPasswordLogin',
      {},
      {
        body: {
          accountName: 'root',
          password: required(
            credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD,
            'TERMINAL_UPDATE_SEED_PLATFORM_PASSWORD_MISSING',
          ),
        },
      },
    );
    platformCookie = required(platformLogin.cookie, 'TERMINAL_UPDATE_SEED_PLATFORM_COOKIE_MISSING');
    await request('platform-session', 'getCurrentPlatformSession', {}, {cookie: platformCookie, idempotency: false});

    for (const input of plan.artifacts) {
      const blob = await openAsBlob(input.zipPath, {type: 'application/zip'});
      const form = new FormData();
      form.set('file', blob, path.basename(input.zipPath));
      form.set('sha256', input.zipSha256);
      form.set('usage', 'TERMINAL_UPDATE_ARTIFACT');
      const stagedResult = await request(
        `artifact-stage-${input.app}-${input.kind.toLowerCase()}`,
        'stagePlatformTerminalUpdateArtifact',
        {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
        {
          cookie: platformCookie,
          form,
          expected: [201],
        },
      );
      const staged = unwrap(stagedResult.json);
      if (staged.sha256 !== input.zipSha256 || Number(staged.byteSize) !== input.byteSize)
        fail(`TERMINAL_UPDATE_SEED_STAGE_READBACK_MISMATCH:${input.app}:${input.kind}`);
      const stage = {
        stageRef: required(staged.stageRef, 'TERMINAL_UPDATE_SEED_STAGE_REF_MISSING'),
        stageBindGrant: required(staged.stageBindGrant, 'TERMINAL_UPDATE_SEED_STAGE_GRANT_MISSING'),
        input,
      };
      pendingStages.push(stage);
      const minimumFullArtifactRef = input.kind === 'HOT' ? artifacts.get(`${input.app}:FULL`)?.artifactRef : null;
      if (input.kind === 'HOT' && !minimumFullArtifactRef)
        fail(`TERMINAL_UPDATE_SEED_FULL_BEFORE_HOT_REQUIRED:${input.app}`);
      const registerBody = {
        stageRef: stage.stageRef,
        stageBindGrant: stage.stageBindGrant,
        kind: input.kind,
        ...(minimumFullArtifactRef ? {minimumFullArtifactRef} : {}),
      };
      const registered = unwrap(
        (
          await request(
            `artifact-register-${input.app}-${input.kind.toLowerCase()}`,
            'registerPlatformTerminalUpdateArtifact',
            {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
            {
              cookie: platformCookie,
              body: registerBody,
              expected: [201],
            },
          )
        ).json,
      );
      const stageIndex = pendingStages.findIndex(item => item.stageRef === stage.stageRef);
      if (stageIndex >= 0) pendingStages.splice(stageIndex, 1);
      const artifact = validateTerminalUpdateArtifactReadback(registered, input);
      const detail = unwrap(
        (
          await request(
            `artifact-detail-${input.app}-${input.kind.toLowerCase()}`,
            'getPlatformTerminalUpdateArtifactDetail',
            {groupWorkspaceKey: GROUP_WORKSPACE_KEY, artifactRef: artifact.artifactRef},
            {
              cookie: platformCookie,
              idempotency: false,
            },
          )
        ).json,
      );
      validateTerminalUpdateArtifactReadback(detail, input);
      artifacts.set(`${input.app}:${input.kind}`, artifact);
    }

    const login = unwrap(
      await request(
        'operations-login',
        'operationsWorkspacePasswordLogin',
        {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
        {
          body: {
            loginName: 'r5-account-multi-role',
            password: required(
              credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD,
              'TERMINAL_UPDATE_SEED_OPERATIONS_PASSWORD_MISSING',
            ),
          },
        },
      ),
    );
    const operationsCookie = required(login.cookie, 'TERMINAL_UPDATE_SEED_OPERATIONS_COOKIE_MISSING');
    const session = unwrap(
      (
        await request(
          'operations-session',
          'getOperationsWorkspaceSessionEntry',
          {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
          {cookie: operationsCookie, idempotency: false},
        )
      ).json,
    );
    const groupCandidates = (Array.isArray(session?.candidates) ? session.candidates : []).filter(
      item => item?.roleNodeType === 'GROUP',
    );
    if (groupCandidates.length !== 1) fail('TERMINAL_UPDATE_SEED_GROUP_ROLE_AMBIGUOUS');
    const groupContext = unwrap(
      (
        await request(
          'operations-group-context',
          'selectOperationsWorkspaceSessionContext',
          {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
          {
            cookie: operationsCookie,
            body: {
              roleAssignmentRef: groupCandidates[0].roleAssignmentRef,
              requiredContextVersion: session.contextVersion,
            },
          },
        )
      ).json,
    );
    const projectFixture = fixture.stableFixtures.organization.projects.find(item => item.key === 'project-river');
    if (!projectFixture) fail('TERMINAL_UPDATE_SEED_PROJECT_FIXTURE_MISSING');
    const projectCandidate = readCandidate(groupContext, 'PROJECT', projectFixture.code);
    const projectSelection = unwrap(
      (
        await request(
          'operations-project-select',
          'selectOperationsWorkspaceSessionDataNode',
          {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
          {
            cookie: operationsCookie,
            body: {
              dataNodeRef: projectCandidate.dataNodeRef,
              dataNodeType: 'PROJECT',
              requiredContextVersion: groupContext.contextVersion,
            },
          },
        )
      ).json,
    );
    const projectRef = required(projectCandidate.dataNodeRef, 'TERMINAL_UPDATE_SEED_PROJECT_REF_MISSING');
    const storePage = unwrap(
      (
        await request(
          'operations-project-stores',
          'getOperationsOrganizationStores',
          {groupWorkspaceKey: GROUP_WORKSPACE_KEY},
          {
            cookie: operationsCookie,
            idempotency: false,
            queryParameters: {
              expectedContextVersion: projectSelection.contextVersion,
              page: 1,
              pageSize: 100,
              sort: 'CODE',
              direction: 'ASC',
            },
          },
        )
      ).json,
    );
    const fixtureStores = fixture.stableFixtures.organization.stores;
    const storeRefs = new Map();
    for (const key of ['store-operating', 'store-preparing']) {
      const source = fixtureStores.find(item => item.key === key);
      const actual = (storePage.items ?? []).find(item => item.code === source?.code);
      if (!actual?.id || actual.name !== source?.name) fail(`TERMINAL_UPDATE_SEED_STORE_READBACK_INVALID:${key}`);
      storeRefs.set(key, actual.id);
    }
    const ruleRefs = new Map();
    for (const ruleFixture of plan.rules) {
      const hotKey = ruleFixture.hotArtifactKey ? `${ruleFixture.app}-HOT` : null;
      const fullRef = artifacts.get(`${ruleFixture.app}:FULL`)?.artifactRef;
      const hotRef = hotKey ? artifacts.get(`${ruleFixture.app}:HOT`)?.artifactRef : null;
      if (!fullRef || (hotKey && !hotRef)) fail(`TERMINAL_UPDATE_SEED_RULE_ARTIFACT_MISSING:${ruleFixture.key}`);
      const body = {
        targetMode: ruleFixture.targetMode,
        ...(ruleFixture.storeKeys.length
          ? {
              storeRefs: ruleFixture.storeKeys.map(key =>
                required(storeRefs.get(key), `TERMINAL_UPDATE_SEED_STORE_REF_MISSING:${key}`),
              ),
            }
          : {}),
        fullArtifactRef: fullRef,
        ...(hotRef ? {hotArtifactRef: hotRef} : {}),
        status: ruleFixture.status,
        nSeconds: ruleFixture.nSeconds,
        ...(hotRef ? {hotStrategy: ruleFixture.hotStrategy} : {}),
        ...(ruleFixture.mSeconds === null ? {} : {mSeconds: ruleFixture.mSeconds}),
        description: `r5-full ${ruleFixture.key}`,
      };
      const route = {groupWorkspaceKey: GROUP_WORKSPACE_KEY, projectRef};
      const create = unwrap(
        (
          await request(`rule-create-${ruleFixture.key}`, 'createOperationsProjectTerminalUpdateRule', route, {
            cookie: operationsCookie,
            queryParameters: {expectedContextVersion: projectSelection.contextVersion},
            body,
            expected: [201],
          })
        ).json,
      );
      const created = validateTerminalUpdateRuleReadback(create, ruleFixture, {
        projectRef,
        stores: storeRefs,
        artifacts: new Map([
          [ruleFixture.fullArtifactKey, fullRef],
          ...(hotRef ? [[ruleFixture.hotArtifactKey, hotRef]] : []),
        ]),
      });
      const detail = unwrap(
        (
          await request(
            `rule-detail-${ruleFixture.key}`,
            'getOperationsProjectTerminalUpdateRuleDetail',
            {...route, ruleRef: created.ruleRef},
            {
              cookie: operationsCookie,
              idempotency: false,
              queryParameters: {expectedContextVersion: projectSelection.contextVersion},
            },
          )
        ).json,
      );
      validateTerminalUpdateRuleReadback(detail, ruleFixture, {
        projectRef,
        stores: storeRefs,
        artifacts: new Map([
          [ruleFixture.fullArtifactKey, fullRef],
          ...(hotRef ? [[ruleFixture.hotArtifactKey, hotRef]] : []),
        ]),
      });
      ruleRefs.set(ruleFixture.key, created.ruleRef);
      rules.push({key: ruleFixture.key, ruleRef: created.ruleRef});
    }
    if (ruleRefs.size !== 8 || artifacts.size !== 4) fail('TERMINAL_UPDATE_SEED_READBACK_DENOMINATOR_INVALID');
    const rulePage = unwrap(
      (
        await request(
          'rule-page-readback',
          'getOperationsProjectTerminalUpdateRulePage',
          {groupWorkspaceKey: GROUP_WORKSPACE_KEY, projectRef},
          {
            cookie: operationsCookie,
            idempotency: false,
            queryParameters: {expectedContextVersion: projectSelection.contextVersion, limit: 100},
          },
        )
      ).json,
    );
    const pageRefs = new Set((rulePage.items ?? []).map(item => item.ruleRef));
    if (pageRefs.size !== 8 || [...ruleRefs.values()].some(ref => !pageRefs.has(ref)))
      fail('TERMINAL_UPDATE_SEED_RULE_PAGE_READBACK_INVALID');

    const sourceRoot = plan.sourceInputRoot;
    const sourceManifestPath = path.join(sourceRoot, 'manifest.json');
    fs.rmSync(sourceRoot, {recursive: true, force: false});
    if (fs.existsSync(sourceManifestPath)) fail('TERMINAL_UPDATE_SEED_SOURCE_EXPORT_CLEANUP_FAILED');
    cleanup = 'PASS_SOURCE_ARTIFACT_INPUTS_REMOVED';
    const output = reportFile(runId);
    writeReport(output, {
      schemaVersion: 1,
      managedDevRunId: runId,
      status: 'PASS',
      business: 'PASS',
      cleanup,
      sourceArtifactRunId: sourceRunId,
      sourceDigest: plan.sourceDigest,
      createdArtifacts: [...artifacts].map(([identity, item]) => ({
        key: fixture.stableFixtures.terminalUpdate.artifacts.find(entry => `${entry.app}:${entry.kind}` === identity)
          ?.key,
        artifactRef: item.artifactRef,
        kind: item.kind,
        applicationId: item.applicationId,
        publicationId: item.publicationId,
        zipSha256: item.zipSha256,
      })),
      createdRules: [...ruleRefs].map(([key, ruleRef]) => ({key, ruleRef})),
      roleGroup: 'WRITE_CONFIRMED',
      roleProject: 'READ_PAGE_CONFIRMED',
      roleStore: 'NOT_GRANTED',
      calls,
      phases,
    });
    process.stdout.write(
      `R5_TERMINAL_UPDATE_POST_STEP=PASS; REPORT=${output}; ARTIFACTS=${artifacts.size}; RULES=${ruleRefs.size}; CLEANUP=${cleanup}\n`,
    );
  } catch (error) {
    firstFailure = error.code ?? 'TERMINAL_UPDATE_SEED_FAILED';
    for (const stage of pendingStages) {
      try {
        await request(
          `stage-release-${stage.stageRef}`,
          'releasePlatformTerminalUpdateArtifactStage',
          {groupWorkspaceKey: GROUP_WORKSPACE_KEY, stageRef: stage.stageRef},
          {
            cookie: platformCookie,
            body: {stageBindGrant: stage.stageBindGrant},
            expected: [200, 204],
          },
        );
      } catch {
        cleanup = 'FAIL_STAGE_RELEASE';
      }
    }
    const output = reportFile(runId);
    writeReport(output, {
      schemaVersion: 1,
      managedDevRunId: runId,
      status: 'FAIL',
      business: 'FAIL',
      cleanup,
      sourceArtifactRunId: sourceRunId,
      sourceDigest: plan.sourceDigest,
      createdArtifacts: [...artifacts].map(([identity, item]) => ({
        key: fixture.stableFixtures.terminalUpdate.artifacts.find(entry => `${entry.app}:${entry.kind}` === identity)
          ?.key,
        artifactRef: item.artifactRef,
        kind: item.kind,
        applicationId: item.applicationId,
        publicationId: item.publicationId,
        zipSha256: item.zipSha256,
      })),
      createdRules: [...rules],
      firstFailure,
      calls,
      phases,
    });
    process.stderr.write(
      `R5_TERMINAL_UPDATE_POST_STEP=FAIL; FIRST_FAILURE=${firstFailure}; CLEANUP=${cleanup}; REPORT=${output}\n`,
    );
    process.exitCode = 2;
  }
}

function planOnly() {
  const sourceRunId = process.env.R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID;
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const plan = buildTerminalUpdateSeedPlan({fixture, sourceRunId});
  process.stdout.write(
    `R5_TERMINAL_UPDATE_SEED_PLAN=PASS; SOURCE_RUN=${plan.sourceRunId}; ARTIFACTS=${plan.artifacts.length}; RULES=${plan.rules.length}; SOURCE_DIGEST=${plan.sourceDigest}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--plan-only')) {
    try {
      planOnly();
    } catch (error) {
      process.stderr.write(
        `R5_TERMINAL_UPDATE_SEED_PLAN=FAIL; REASON=${error.code ?? 'TERMINAL_UPDATE_SEED_PLAN_INVALID'}\n`,
      );
      process.exitCode = 2;
    }
  } else
    execute().catch(error => {
      process.stderr.write(
        `R5_TERMINAL_UPDATE_POST_STEP=FAIL; REASON=${error.code ?? 'TERMINAL_UPDATE_SEED_FAILED'}\n`,
      );
      process.exitCode = 2;
    });
}
