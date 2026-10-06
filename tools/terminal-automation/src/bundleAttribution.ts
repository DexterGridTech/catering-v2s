import {gzipSync} from 'node:zlib';
import {SourceMapConsumer, type RawSourceMap} from 'source-map';

export type AutomationBundleAttribution = Readonly<{
  readonly rawBytes: number;
  readonly gzipBytes: number;
  readonly mappedModuleCount: number;
  readonly totalBundleRawBytes: number;
  readonly totalBundleGzipBytes: number;
}>;

const belongsToAutomationBundle = (source: string): boolean =>
  source.includes('/ui/base/automation-agent/') ||
  /(?:^|\/)node_modules\/(?:rxjs|zod|dequal)\//u.test(source);

/**
 * Attributes emitted release-bundle spans to automation-agent and its selected
 * runtime dependencies. This measures actual Metro output rather than toggling
 * a runtime flag: the shared assembly statically imports and installs the agent
 * in both enabled and disabled builds.
 */
export const measureAutomationBundleAttribution = async (
  bundle: string,
  sourceMap: RawSourceMap,
): Promise<AutomationBundleAttribution> => {
  const consumer = new SourceMapConsumer(sourceMap);
  consumer.computeColumnSpans();
  const lines = bundle.split('\n');
  const sourceChunks: string[] = [];
  const mappedSources = new Set<string>();
  const selectedSourceNames = new Set<string>();
  const mappings: Array<{source: string | null; generatedLine: number; generatedColumn: number}> = [];
  consumer.eachMapping(mapping => mappings.push(mapping), undefined, SourceMapConsumer.GENERATED_ORDER);
  for (let index = 0; index < mappings.length; index += 1) {
    const mapping = mappings[index];
    if (mapping === undefined || mapping.source === null) continue;
    if (!belongsToAutomationBundle(mapping.source)) continue;
    selectedSourceNames.add(mapping.source);
    const line = lines[mapping.generatedLine - 1];
    if (line === undefined || mapping.generatedColumn < 0 || mapping.generatedColumn >= line.length) continue;
    const next = mappings[index + 1];
    const end = Math.min(
      next?.generatedLine === mapping.generatedLine ? next.generatedColumn : line.length,
      line.length,
    );
    if (end <= mapping.generatedColumn) continue;
    sourceChunks.push(line.slice(mapping.generatedColumn, end));
    mappedSources.add(mapping.source);
  }
  if (selectedSourceNames.size === 0)
    throw new Error(`TERMINAL_AUTOMATION_BUNDLE_ATTRIBUTION_SOURCES_MISSING sourceCount=${sourceMap.sources.length}`);
  if (mappedSources.size === 0 || sourceChunks.length === 0)
    throw new Error(
      `TERMINAL_AUTOMATION_BUNDLE_ATTRIBUTION_MAP_BUNDLE_MISMATCH selectedSources=${selectedSourceNames.size} ` +
        `generatedLines=${lines.length} bundleBytes=${Buffer.byteLength(bundle)}`,
    );
  const attributed = Buffer.from(sourceChunks.join(''));
  const completeBundle = Buffer.from(bundle);
  return Object.freeze({
    rawBytes: attributed.byteLength,
    gzipBytes: gzipSync(attributed).byteLength,
    mappedModuleCount: mappedSources.size,
    totalBundleRawBytes: completeBundle.byteLength,
    totalBundleGzipBytes: gzipSync(completeBundle).byteLength,
  });
};
