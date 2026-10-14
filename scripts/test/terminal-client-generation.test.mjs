import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {check, selfTest} from '../generate/terminal-client-api.mjs';

test('terminal API generation closes the face/tag operation set and rejects policy drift', () => {
  const result = check();
  const expectedOperationIds = [
    'activateTerminal',
    'cancelTerminalActivation',
    'issueTerminalUpdateArtifactDownloadGrant',
    'registerTerminalRemoteControl',
    'reportTerminalRemoteControl',
    'submitTerminalUpdateReport',
    'terminalReadContract',
    'terminalReadProjectUpdateRuleSnapshotPage',
    'terminalReadServicePoint',
    'terminalReadServicePointArea',
    'terminalReadStoreActiveContracts',
    'terminalReadStoreBasic',
    'terminalReadStoreOrganizationPath',
    'terminalReadStoreServicePointAreas',
    'terminalReadStoreServicePoints',
  ];
  assert.deepEqual(result.operationIds, expectedOperationIds);
  assert.deepEqual(
    result.outputs.map(output => output.operationIds),
    [
      ['activateTerminal', 'cancelTerminalActivation'],
      [
        'terminalReadContract',
        'terminalReadServicePoint',
        'terminalReadServicePointArea',
        'terminalReadStoreActiveContracts',
        'terminalReadStoreBasic',
        'terminalReadStoreServicePointAreas',
        'terminalReadStoreServicePoints',
      ],
      ['terminalReadProjectUpdateRuleSnapshotPage', 'terminalReadStoreOrganizationPath'],
      ['issueTerminalUpdateArtifactDownloadGrant', 'submitTerminalUpdateReport'],
      ['registerTerminalRemoteControl', 'reportTerminalRemoteControl'],
    ],
  );
  for (const output of result.outputs) {
    const source = fs.readFileSync(output.output, 'utf8');
    assert.doesNotMatch(source, /^import\s/m);
    assert.match(source, /errorCodes:/);
    assert.match(source, /idempotencyRequired:/);
    assert.match(source, /readonly queryParameters:/);
    assert.match(source, /category: "unknown-business-rejection"/);
    assert.match(source, /TerminalOperationDescriptor/);
    assert.match(source, /createTerminalApiClient/);
    assert.match(source, /buildTerminalHttpCommandRequest/);
    assert.match(source, /TerminalExecutionMetadata/);
  }
  const generatedApi = fs.readFileSync(result.outputs[0].output, 'utf8');
  assert.doesNotMatch(generatedApi, /readonly "Authorization": string/);
  assert.doesNotMatch(generatedApi, /readonly "X-Terminal-Ref": string/);
  assert.doesNotMatch(generatedApi, /readonly "X-Terminal-Device-Id": string/);
  assert.match(generatedApi, /readonly "deviceId": string/);
  assert.match(generatedApi, /isTerminalActivationResult/);
  assert.match(generatedApi, /"cancelTerminalActivation": \{[\s\S]*?authorizationMode: "TERMINAL_CREDENTIAL"/);
  const generatedProtocol = fs.readFileSync(
    new URL(
      '../../apps/terminal/kernel/base/terminal-data-client/src/generated/terminalConnectionProtocol.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(generatedProtocol, /export type AuthenticateMessage = \{[\s\S]*?readonly deviceId: string/);
  assert.doesNotMatch(result.operationIds.join(','), /downloadTerminalUpdateArtifact/);
  selfTest();
});
