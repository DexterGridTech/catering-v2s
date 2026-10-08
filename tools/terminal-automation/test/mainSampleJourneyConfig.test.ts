import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {mainSampleAppName, mainSampleSeedKey, mainSampleSurfaceForm, parseMainSample, parseMainSampleJourneyConfig, parseMainSampleShape} from '../src/mainSampleJourneyConfig.js';

describe('parseMainSampleJourneyConfig', () => {
  it('centralizes sample app and seed identity shared by platform runners', () => {
    expect(parseMainSample(undefined)).toBe('console');
    expect(mainSampleAppName('wallpaper')).toBe('sample-wallpaper-console');
    expect(mainSampleSeedKey('dual')).toBe('term-front');
    expect(mainSampleSeedKey('mobile')).toBe('term-handheld');
  });

  it('preserves the runner-selected Android topology and rejects missing values', () => {
    expect(parseMainSampleShape('dual')).toBe('dual');
    expect(parseMainSampleShape('mobile')).toBe('mobile');
    expect(mainSampleSurfaceForm('dual')).toBe('laptop');
    expect(mainSampleSurfaceForm('mobile')).toBe('mobile');
    expect(() => parseMainSampleShape(undefined)).toThrow('TERMINAL_AUTOMATION_SHAPE_INVALID');
  });

  it('keeps update Android build, connection, surface check, and activation on the runner-selected shape', () => {
    const source = readFileSync(new URL('../journeys/update.android.test.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\bshape\s*:\s*['"]mobile['"]/u);
    expect(source.match(/parseMainSampleShape\(process\.env\.TERMINAL_AUTOMATION_SHAPE\)/gu)).toHaveLength(4);
    expect(source).toContain('const surfaceForm = mainSampleSurfaceForm(shape)');
    expect(source).toContain('await prepareAndroidJourneySurface(connection, parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE))');
  });

  it('returns console journey data without platform-specific fields', () => {
    expect(
      parseMainSampleJourneyConfig({
        TERMINAL_AUTOMATION_SAMPLE: 'console',
        TERMINAL_AUTOMATION_SHAPE: 'dual',
        TERMINAL_AUTOMATION_RUN_ID: 'run-1',
        TERMINAL_AUTOMATION_CASE: 'normal',
        TERMINAL_AUTOMATION_AGE: '37',
      }),
    ).toEqual({sample: 'console', shape: 'dual', runId: 'run-1', caseName: 'normal', age: '37'});
  });

  it('rejects optional console case data on wallpaper journeys', () => {
    expect(() =>
      parseMainSampleJourneyConfig({
        TERMINAL_AUTOMATION_SAMPLE: 'wallpaper',
        TERMINAL_AUTOMATION_SHAPE: 'mobile',
        TERMINAL_AUTOMATION_RUN_ID: 'run-1',
        TERMINAL_AUTOMATION_CASE: 'normal',
      }),
    ).toThrow('TERMINAL_AUTOMATION_CASE_NOT_APPLICABLE');
  });

  it('rejects an age outside the admitted console fixture values', () => {
    expect(() =>
      parseMainSampleJourneyConfig({
        TERMINAL_AUTOMATION_SAMPLE: 'console',
        TERMINAL_AUTOMATION_SHAPE: 'mobile',
        TERMINAL_AUTOMATION_RUN_ID: 'run-1',
        TERMINAL_AUTOMATION_CASE: 'normal',
        TERMINAL_AUTOMATION_AGE: '99',
      }),
    ).toThrow('TERMINAL_AUTOMATION_AGE_INVALID');
  });
});
