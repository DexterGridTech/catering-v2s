#!/usr/bin/env node

import {spawnSync} from 'node:child_process';

const result = spawnSync(process.execPath, ['tools/verify-gates/cli.mjs', 'r11'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
