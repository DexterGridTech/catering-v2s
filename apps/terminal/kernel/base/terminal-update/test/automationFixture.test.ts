import {describe, expect, it} from 'vitest';
import {nextArtifact} from '../src/foundations/updateDecisions';
import {createTerminalUpdateAutomationFixture} from '../src/testing';

describe('terminal update Expo automation fixture', () => {
  it('keeps app identity and scenario behavior in the base test-support package', async () => {
    const fixture = createTerminalUpdateAutomationFixture({
      runId: 'fixture-run',
      applicationId: 'com.example.terminal',
      scenario: 'update.install-result',
    });

    const facts = await fixture.port.readFacts({timeoutMs: 1_000});
    expect(facts.status).toBe('succeeded');
    if (facts.status !== 'succeeded') throw new Error('AUTOMATION_FIXTURE_FACTS_NOT_AVAILABLE');
    expect(facts.value.actual).not.toBeNull();
    if (facts.value.actual === null) throw new Error('AUTOMATION_FIXTURE_ACTUAL_FACTS_MISSING');
    expect(facts.value.actual.applicationId).toBe('com.example.terminal');

    const target = await fixture.sourceProvider.readTarget({
      selectedSpace: 'development',
      contextIdentity: 'fixture-run',
      ruleRef: 'automation-fixture-run',
    });
    expect(target?.applicationId).toBe('com.example.terminal');
    expect(
      await fixture.sourceProvider.readTarget({
        selectedSpace: 'development',
        contextIdentity: 'other-run',
        ruleRef: 'automation-fixture-run',
      }),
    ).toBeNull();
    expect(target?.full?.artifact.nativeBuildNumber).toBe(2);

    const prepared = await fixture.port.prepareArtifact({
      sourceRef: target!.full!.sourceRef,
      expectedSha256: target!.full!.expectedSha256,
      artifact: target!.full!.manifest!,
      sourcePath: '/fixtures/full.zip',
      network: {addresses: []},
      kind: 'full',
      timeoutMs: 1_000,
    });
    expect(prepared.status).toBe('succeeded');
    if (prepared.status !== 'succeeded') throw new Error('AUTOMATION_FIXTURE_PREPARE_FAILED');
    const action = await fixture.port.applyPrepared({
      actionId: 'fixture-action',
      taskId: 'fixture-task',
      preparedId: prepared.value.preparedId,
      kind: 'full',
      timeoutMs: 1_000,
    });
    expect(action.status).toBe('succeeded');
    if (action.status !== 'succeeded') throw new Error('AUTOMATION_FIXTURE_APPLY_FAILED');
    expect(action.value.state).toBe('waiting-user');
    const readback = await fixture.port.readAction({
      actionId: 'fixture-action',
      taskId: 'fixture-task',
      timeoutMs: 1_000,
    });
    expect(readback.status).toBe('succeeded');
    if (readback.status !== 'succeeded' || readback.value === null)
      throw new Error('AUTOMATION_FIXTURE_ACTION_READBACK_FAILED');
    expect(readback.value.state).toBe('user-cancelled');
    expect(readback.value.reason).toBe('ENDED_NOT_INSTALLED');
  });

  it('keeps the compatibility projection in base test support', async () => {
    const fixture = createTerminalUpdateAutomationFixture({
      runId: 'compatibility-run',
      applicationId: 'com.example.wallpaper',
      scenario: 'update.compatibility',
    });
    const facts = await fixture.port.readFacts({timeoutMs: 1_000});
    expect(facts.status).toBe('succeeded');
    if (facts.status !== 'succeeded') throw new Error('AUTOMATION_FIXTURE_FACTS_NOT_AVAILABLE');
    expect(facts.value.actual).not.toBeNull();
    if (facts.value.actual === null) throw new Error('AUTOMATION_FIXTURE_ACTUAL_FACTS_MISSING');
    expect(facts.value.actual).toMatchObject({
      applicationId: 'com.example.wallpaper',
      bundleVersion: '1.0.5',
      entryKind: 'hot',
    });
  });

  it('keeps the actual prepared FULL/HOT publication identity through apply, readback, and release', async () => {
    const fixture = createTerminalUpdateAutomationFixture({
      runId: 'identity-run',
      applicationId: 'com.example.terminal',
      scenario: 'update.owner-flow',
    });
    const initialFacts = await fixture.port.readFacts({timeoutMs: 1_000});
    expect(initialFacts).toMatchObject({
      status: 'succeeded',
      value: {embedded: {nativeBuildNumber: 1, publicationId: '1'.repeat(64)}},
    });
    const target = await fixture.sourceProvider.readTarget({
      selectedSpace: 'development',
      contextIdentity: 'identity-run',
      ruleRef: 'automation-identity-run',
    });
    if (target?.full === null || target?.full === undefined || target.hot === null)
      throw new Error('AUTOMATION_FIXTURE_TARGET_MISSING');
    expect(target.full.artifact.publicationId).not.toMatch(/^a{64}$/u);
    expect(target.hot.artifact.publicationId).not.toBe(target.full.artifact.publicationId);
    expect(target.full.apkSha256).toBe('5'.repeat(64));

    const prepare = async (kind: 'full' | 'hot') => {
      const source = target[kind];
      if (source === null) throw new Error(`AUTOMATION_FIXTURE_${kind.toUpperCase()}_SOURCE_MISSING`);
      const result = await fixture.port.prepareArtifact({
        sourceRef: source.sourceRef,
        expectedSha256: source.expectedSha256,
        artifact: source.manifest!,
        sourcePath: `/fixtures/${kind}.zip`,
        network: {addresses: []},
        kind,
        timeoutMs: 1_000,
      });
      if (result.status !== 'succeeded') throw new Error(`AUTOMATION_FIXTURE_${kind.toUpperCase()}_PREPARE_FAILED`);
      expect(result.value.artifact).toBe(source.manifest);
      return {source, preparedId: result.value.preparedId};
    };

    const full = await prepare('full');
    const fullAction = await fixture.port.applyPrepared({
      actionId: 'full-action',
      taskId: 'full-task',
      preparedId: full.preparedId,
      kind: 'full',
      timeoutMs: 1_000,
    });
    expect(fullAction).toMatchObject({status: 'succeeded', value: {publicationId: full.source.artifact.publicationId}});
    const fullReadback = await fixture.port.readAction({
      actionId: 'full-action',
      taskId: 'full-task',
      timeoutMs: 1_000,
    });
    expect(fullReadback).toMatchObject({status: 'succeeded', value: {publicationId: full.source.artifact.publicationId}});
    const afterFull = await fixture.port.readFacts({timeoutMs: 1_000});
    expect(afterFull).toMatchObject({
      status: 'succeeded',
      value: {
        actual: {publicationId: full.source.artifact.publicationId, apkSha256: target.full.apkSha256},
        embedded: {
          nativeBuildNumber: full.source.artifact.nativeBuildNumber,
          publicationId: full.source.artifact.publicationId,
        },
      },
    });
    if (afterFull.status !== 'succeeded' || afterFull.value.actual === null)
      throw new Error('AUTOMATION_FIXTURE_POST_FULL_FACTS_NOT_AVAILABLE');
    expect(
      nextArtifact({
        target,
        actual: afterFull.value.actual,
        embedded: afterFull.value.embedded,
        originalBundleVersion: '1.0.0',
      }),
    ).toMatchObject({kind: 'hot', sourceRef: target.hot.sourceRef});
    expect(await fixture.port.releasePrepared({preparedId: full.preparedId, timeoutMs: 1_000})).toMatchObject({
      status: 'succeeded',
      value: {released: true},
    });

    const hot = await prepare('hot');
    const hotAction = await fixture.port.applyPrepared({
      actionId: 'hot-action',
      taskId: 'hot-task',
      preparedId: hot.preparedId,
      kind: 'hot',
      timeoutMs: 1_000,
    });
    expect(hotAction).toMatchObject({status: 'succeeded', value: {publicationId: hot.source.artifact.publicationId}});
    expect(await fixture.port.readAction({actionId: 'hot-action', taskId: 'hot-task', timeoutMs: 1_000})).toMatchObject({
      status: 'succeeded',
      value: {publicationId: hot.source.artifact.publicationId},
    });
    expect(await fixture.port.readFacts({timeoutMs: 1_000})).toMatchObject({
      status: 'succeeded',
      value: {
        actual: {publicationId: hot.source.artifact.publicationId},
        embedded: {
          nativeBuildNumber: full.source.artifact.nativeBuildNumber,
          publicationId: full.source.artifact.publicationId,
        },
      },
    });
    const afterHot = await fixture.port.readFacts({timeoutMs: 1_000});
    if (afterHot.status !== 'succeeded' || afterHot.value.actual === null)
      throw new Error('AUTOMATION_FIXTURE_POST_HOT_FACTS_NOT_AVAILABLE');
    expect(afterHot.value.actual.apkSha256).toBe(target.full.apkSha256);
    expect(
      nextArtifact({
        target,
        actual: afterHot.value.actual,
        embedded: afterHot.value.embedded,
        originalBundleVersion: '1.0.0',
      }),
    ).toBeNull();
    expect(await fixture.port.releasePrepared({preparedId: hot.preparedId, timeoutMs: 1_000})).toMatchObject({
      status: 'succeeded',
      value: {released: true},
    });
  });

  it('rejects a different prepared identity or kind without replacing the active preparation', async () => {
    const fixture = createTerminalUpdateAutomationFixture({
      runId: 'mismatch-run',
      applicationId: 'com.example.terminal',
    });
    const target = await fixture.sourceProvider.readTarget({
      selectedSpace: 'development',
      contextIdentity: 'mismatch-run',
      ruleRef: 'automation-mismatch-run',
    });
    if (target?.full === null || target?.full === undefined) throw new Error('AUTOMATION_FIXTURE_FULL_SOURCE_MISSING');
    const preparation = await fixture.port.prepareArtifact({
      sourceRef: target.full.sourceRef,
      expectedSha256: target.full.expectedSha256,
      artifact: target.full.manifest!,
      sourcePath: '/fixtures/full.zip',
      network: {addresses: []},
      kind: 'full',
      timeoutMs: 1_000,
    });
    if (preparation.status !== 'succeeded') throw new Error('AUTOMATION_FIXTURE_PREPARE_FAILED');

    expect(
      await fixture.port.applyPrepared({
        actionId: 'wrong-kind-action',
        taskId: 'wrong-kind-task',
        preparedId: preparation.value.preparedId,
        kind: 'hot',
        timeoutMs: 1_000,
      }),
    ).toMatchObject({status: 'failed', error: {code: 'PREPARED_ARTIFACT_IDENTITY_MISMATCH'}});
    expect(
      await fixture.port.applyPrepared({
        actionId: 'wrong-id-action',
        taskId: 'wrong-id-task',
        preparedId: 'prepared:other',
        kind: 'full',
        timeoutMs: 1_000,
      }),
    ).toMatchObject({status: 'failed', error: {code: 'PREPARED_ARTIFACT_IDENTITY_MISMATCH'}});
    expect(await fixture.port.releasePrepared({preparedId: 'prepared:other', timeoutMs: 1_000})).toMatchObject({
      status: 'failed',
      error: {code: 'PREPARED_IDENTITY_MISMATCH'},
    });

    const validAction = await fixture.port.applyPrepared({
      actionId: 'valid-action',
      taskId: 'valid-task',
      preparedId: preparation.value.preparedId,
      kind: 'full',
      timeoutMs: 1_000,
    });
    expect(validAction).toMatchObject({status: 'succeeded', value: {publicationId: target.full.artifact.publicationId}});
    expect(await fixture.port.readAction({actionId: 'wrong-id-action', taskId: 'wrong-id-task', timeoutMs: 1_000})).toMatchObject({
      status: 'succeeded',
      value: null,
    });
    expect(await fixture.port.releasePrepared({preparedId: preparation.value.preparedId, timeoutMs: 1_000})).toMatchObject({
      status: 'succeeded',
      value: {released: true},
    });
  });
});
