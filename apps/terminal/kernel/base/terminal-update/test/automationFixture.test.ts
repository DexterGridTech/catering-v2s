import {describe, expect, it} from 'vitest';
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

    const target = await fixture.sourceProvider.readTarget({selectedSpace: 'development', contextIdentity: 'fixture-run', ruleRef: 'automation-fixture-run'});
    expect(target?.applicationId).toBe('com.example.terminal');
    expect(await fixture.sourceProvider.readTarget({selectedSpace: 'development', contextIdentity: 'other-run', ruleRef: 'automation-fixture-run'})).toBeNull();
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
    const readback = await fixture.port.readAction({actionId: 'fixture-action', taskId: 'fixture-task', timeoutMs: 1_000});
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
    expect(facts.value.actual).toMatchObject({applicationId: 'com.example.wallpaper', bundleVersion: '1.0.5', entryKind: 'hot'});
  });
});
