import {
  parseServerConfigEnvironmentJson,
  resolveServerConfigEnvironment,
} from '@catering-v2s/kernel-base-server-config';
import type packageJson from '../../package.json';

type ServerSpaces = typeof packageJson.serverSpaces;

export const resolveManagedServerSpaces = (
  defaults: ServerSpaces,
  environmentJson: string | undefined,
): ServerSpaces =>
  environmentJson === undefined
    ? defaults
    : (resolveServerConfigEnvironment(defaults, parseServerConfigEnvironmentJson(environmentJson)) as ServerSpaces);
