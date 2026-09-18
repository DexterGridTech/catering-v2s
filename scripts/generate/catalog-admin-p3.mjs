#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const generator = path.join(root, 'scripts/generate/edge-codegen.mjs');
const requestedArgs = process.argv.slice(2);
const args = requestedArgs.length === 0 ? ['--write'] : requestedArgs;
const result = spawnSync(process.execPath, [generator, ...args], {stdio: 'inherit'});

if (result.error) {
  process.stderr.write(`CATALOG_ADMIN_P3_DELEGATION_FAILED:${result.error.message}\n`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  process.stdout.write(`CATALOG_ADMIN_P3_DELEGATED=PASS TARGET=edge-codegen MODE=${args.join(',')}\n`);
}
