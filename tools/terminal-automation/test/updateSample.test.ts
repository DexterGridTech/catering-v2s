import {describe, expect, it} from 'vitest';
import {terminalUpdateSampleConfig} from '../src/updateSample.ts';

describe('terminal update sample routing', () => {
  it.each([
    ['console', 'sample-console', 'com.anonymous.sampleterminal'],
    ['wallpaper', 'sample-wallpaper-console', 'com.catering.v2s.terminal.samplewallpaper'],
  ] as const)('selects the exact %s integration identity', (sample, appName, applicationId) => {
    expect(terminalUpdateSampleConfig(sample)).toMatchObject({appName, applicationId});
  });

  it('rejects an unknown sample instead of silently running another integration', () => {
    expect(() => terminalUpdateSampleConfig('unknown')).toThrow('TERMINAL_AUTOMATION_UPDATE_SAMPLE_INVALID');
  });
});
