import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

type SourceEntry = Readonly<{readonly path: string; readonly source: string}>;

const findForbiddenVendorReferences = (entries: readonly SourceEntry[]): readonly string[] =>
  entries.flatMap(entry => {
    const findings: string[] = [];
    if (entry.path.includes('/vendor/')) findings.push(`${entry.path}:legacy-vendor-path`);
    if (entry.source.includes('react-native-css-interop/dist/'))
      findings.push(`${entry.path}:private-css-interop-deep-import`);
    return findings;
  });

const collectSourceEntries = (directory: string, result: SourceEntry[] = []): readonly SourceEntry[] => {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) collectSourceEntries(path, result);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push({path, source: readFileSync(path, 'utf8')});
  }
  return result;
};

describe('primitive vendor ownership', () => {
  it('detects both a leftover vendor file and a private css-interop import in its input', () => {
    expect(
      findForbiddenVendorReferences([
        {path: 'src/vendor/slots.tsx', source: ''},
        {
          path: 'src/foundations/nativeVariable.native.ts',
          source: "import {useUnstableNativeVariable} from 'react-native-css-interop/dist/runtime/native/api'",
        },
      ]),
    ).toEqual([
      'src/vendor/slots.tsx:legacy-vendor-path',
      'src/foundations/nativeVariable.native.ts:private-css-interop-deep-import',
    ]);
  });

  it('keeps local adapters outside vendor and uses only the css-interop package entrypoint', () => {
    const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
    const vendorRoot = `${sourceRoot}vendor`;
    const entries = collectSourceEntries(sourceRoot);
    expect(existsSync(vendorRoot) ? readdirSync(vendorRoot) : []).toEqual([]);
    expect(findForbiddenVendorReferences(entries)).toEqual([]);
  });
});
