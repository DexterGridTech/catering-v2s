export type MainSample = 'console' | 'wallpaper';
export type MainSampleShape = 'mobile' | 'dual';
export type MainSampleCase = 'normal';

export const parseMainSampleShape = (value: string | undefined): MainSampleShape => {
  if (value !== 'mobile' && value !== 'dual') throw new Error('TERMINAL_AUTOMATION_SHAPE_INVALID');
  return value;
};

export const mainSampleSurfaceForm = (shape: MainSampleShape): 'mobile' | 'laptop' =>
  shape === 'mobile' ? 'mobile' : 'laptop';

export const parseMainSample = (value: string | undefined): MainSample => {
  const sample = value ?? 'console';
  if (sample !== 'console' && sample !== 'wallpaper') throw new Error('TERMINAL_AUTOMATION_SAMPLE_INVALID');
  return sample;
};

export const mainSampleAppName = (sample: MainSample): string =>
  sample === 'console' ? 'sample-console' : 'sample-wallpaper-console';

export const mainSampleSeedKey = (shape: MainSampleShape): 'term-front' | 'term-handheld' =>
  shape === 'dual' ? 'term-front' : 'term-handheld';

type MainSampleJourneyBase = Readonly<{
  readonly shape: MainSampleShape;
  readonly runId: string;
}>;
export type MainSampleJourneyConfig = MainSampleJourneyBase &
  (
    | Readonly<{readonly sample: 'console'; readonly caseName: MainSampleCase; readonly age: 'empty' | '37'}>
    | Readonly<{readonly sample: 'wallpaper'}>
  );

const required = (values: Readonly<Record<string, string | undefined>>, key: string): string => {
  const value = values[key];
  if (value === undefined || value.length === 0) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${key}`);
  return value;
};

/** Validates business-journey inputs once so platform runners only supply their device wiring. */
export const parseMainSampleJourneyConfig = (
  values: Readonly<Record<string, string | undefined>>,
): MainSampleJourneyConfig => {
  const sample = parseMainSample(values.TERMINAL_AUTOMATION_SAMPLE);
  const shape = parseMainSampleShape(values.TERMINAL_AUTOMATION_SHAPE);
  const runId = required(values, 'TERMINAL_AUTOMATION_RUN_ID');
  const caseName = values.TERMINAL_AUTOMATION_CASE;
  const age = values.TERMINAL_AUTOMATION_AGE;

  const checkedShape = shape;
  if (sample === 'console') {
    if (caseName !== 'normal') throw new Error('TERMINAL_AUTOMATION_CASE_INVALID');
    if (age !== 'empty' && age !== '37') throw new Error('TERMINAL_AUTOMATION_AGE_INVALID');
    const checkedAge = age as 'empty' | '37';
    return Object.freeze({shape: checkedShape, runId, sample, caseName: 'normal', age: checkedAge});
  } else if (caseName !== undefined || age !== undefined) {
    throw new Error('TERMINAL_AUTOMATION_CASE_NOT_APPLICABLE');
  }
  return Object.freeze({shape: checkedShape, runId, sample});
};
