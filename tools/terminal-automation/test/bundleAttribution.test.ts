import {describe, expect, it} from 'vitest';
import {SourceMapGenerator} from 'source-map';
import {measureAutomationBundleAttribution} from '../src/bundleAttribution.ts';

describe('measureAutomationBundleAttribution', () => {
  it('counts emitted spans mapped to the agent and selected runtime dependencies only', async () => {
    const bundle = 'agent();rxjs();other();';
    const map = new SourceMapGenerator({file: 'index.android.bundle'});
    map.addMapping({generated: {line: 1, column: 0}, source: '/repo/ui/base/automation-agent/src/index.ts', original: {line: 1, column: 0}});
    map.addMapping({generated: {line: 1, column: 8}, source: '/repo/node_modules/rxjs/dist/index.js', original: {line: 1, column: 0}});
    map.addMapping({generated: {line: 1, column: 15}, source: '/repo/app/other.js', original: {line: 1, column: 0}});

    const result = await measureAutomationBundleAttribution(bundle, JSON.parse(map.toString()));

    expect(result.rawBytes).toBe(Buffer.byteLength('agent();rxjs();'));
    expect(result.mappedModuleCount).toBe(2);
    expect(result.totalBundleRawBytes).toBe(Buffer.byteLength(bundle));
    expect(result.gzipBytes).toBeGreaterThan(0);
    expect(result.totalBundleGzipBytes).toBeGreaterThan(0);
  });

  it('fails closed when the bundle map does not contain an automation module', async () => {
    const map = new SourceMapGenerator({file: 'index.android.bundle'});
    map.addMapping({generated: {line: 1, column: 0}, source: '/repo/app/other.js', original: {line: 1, column: 0}});

    await expect(measureAutomationBundleAttribution('other();', JSON.parse(map.toString()))).rejects.toThrow(
      'TERMINAL_AUTOMATION_BUNDLE_ATTRIBUTION_SOURCES_MISSING',
    );
  });

  it('fails closed when the source map belongs to compiled output rather than the text bundle', async () => {
    const map = new SourceMapGenerator({file: 'index.android.bundle'});
    map.addMapping({
      generated: {line: 1, column: 563_959},
      source: '/repo/ui/base/automation-agent/src/index.ts',
      original: {line: 1, column: 0},
    });

    await expect(measureAutomationBundleAttribution('\\u0000HermesBytecode;', JSON.parse(map.toString()))).rejects.toThrow(
      'TERMINAL_AUTOMATION_BUNDLE_ATTRIBUTION_MAP_BUNDLE_MISMATCH',
    );
  });
});
