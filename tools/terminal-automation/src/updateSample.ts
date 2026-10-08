export type TerminalUpdateSample = 'console' | 'wallpaper';

export type TerminalUpdateSampleConfig = Readonly<{
  integrationPath: 'sample-console' | 'sample-wallpaper-console';
  appName: 'sample-console' | 'sample-wallpaper-console';
  applicationId: 'com.anonymous.sampleterminal' | 'com.catering.v2s.terminal.samplewallpaper';
}>;

const configurations: Readonly<Record<TerminalUpdateSample, TerminalUpdateSampleConfig>> = Object.freeze({
  console: Object.freeze({
    integrationPath: 'sample-console',
    appName: 'sample-console',
    applicationId: 'com.anonymous.sampleterminal',
  }),
  wallpaper: Object.freeze({
    integrationPath: 'sample-wallpaper-console',
    appName: 'sample-wallpaper-console',
    applicationId: 'com.catering.v2s.terminal.samplewallpaper',
  }),
});

export const terminalUpdateSampleConfig = (sample: string): TerminalUpdateSampleConfig => {
  if (sample !== 'console' && sample !== 'wallpaper') throw new Error('TERMINAL_AUTOMATION_UPDATE_SAMPLE_INVALID');
  return configurations[sample];
};
