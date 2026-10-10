import {describe, expect, it} from 'vitest';
import {terminalUpdateCandidateQuery} from './terminalUpdateCandidateQuery';

describe('terminalUpdateCandidateQuery', () => {
  it('sends the search and server cursor for later FULL candidate pages', () => {
    expect(terminalUpdateCandidateQuery({
      expectedContextVersion: 4,
      projectRef: '00000000-0000-4000-8000-000000000001' as never,
      kind: 'FULL',
      queryText: ' console ',
      cursor: 'opaque-cursor',
      limit: 50,
    })).toEqual({
      expectedContextVersion: 4,
      projectRef: '00000000-0000-4000-8000-000000000001',
      kind: 'FULL',
      queryText: 'console',
      cursor: 'opaque-cursor',
      limit: 50,
    });
  });

  it('binds HOT candidates to the chosen FULL and preserves the cursor', () => {
    expect(terminalUpdateCandidateQuery({
      expectedContextVersion: 4,
      projectRef: '00000000-0000-4000-8000-000000000001' as never,
      kind: 'HOT',
      minimumFullArtifactRef: '00000000-0000-4000-8000-000000000002' as never,
      cursor: 'hot-cursor',
      limit: 50,
    })).toEqual({
      expectedContextVersion: 4,
      projectRef: '00000000-0000-4000-8000-000000000001',
      kind: 'HOT',
      minimumFullArtifactRef: '00000000-0000-4000-8000-000000000002',
      cursor: 'hot-cursor',
      limit: 50,
    });
  });
});
