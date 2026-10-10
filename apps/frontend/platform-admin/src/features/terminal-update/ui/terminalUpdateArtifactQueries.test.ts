import {describe, expect, it} from 'vitest';
import {platformMinimumFullCandidateQuery} from './terminalUpdateArtifactQueries';

describe('platform minimum FULL candidate query', () => {
  it('uses all five strict identity facts in the server query', () => {
    expect(platformMinimumFullCandidateQuery({
      applicationId: 'com.catering.console',
      nativeBuildNumber: 42,
      runtimeVersion: '2.4.0',
      publicationId: 'a'.repeat(64),
      apkSha256: 'b'.repeat(64),
    })).toEqual({
      kind: 'FULL',
      limit: 50,
      appId: 'com.catering.console',
      runtimeVersion: '2.4.0',
      minimumFullNativeBuildNumber: 42,
      minimumFullPublicationId: 'a'.repeat(64),
      minimumFullApkSha256: 'b'.repeat(64),
    });
  });

  it('does not apply candidate-only filters to the ordinary FULL listing', () => {
    expect(platformMinimumFullCandidateQuery(undefined)).toEqual({kind: 'FULL', limit: 50});
  });
});
