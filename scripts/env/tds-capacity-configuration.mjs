import {readFileSync} from 'node:fs';
import path from 'node:path';

export const TDS_CAPACITY_CONFIG_RELATIVE_PATH = 'scripts/env/tds-dev-capacity.json';
const configPath = path.resolve(import.meta.dirname, '../../', TDS_CAPACITY_CONFIG_RELATIVE_PATH);

const positiveInteger = value => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  return typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= 2147483647;
};

export const validateTdsCapacityConfiguration = configuration => {
  const rssBudgetMiB = Number(configuration?.rssBudgetMiB);
  const maxUnauthenticatedConnections = Number(configuration?.maxUnauthenticatedConnections);
  const maxTrackedSessions = Number(configuration?.maxTrackedSessions);
  if (
    configuration?.schemaVersion !== 1 ||
    !positiveInteger(configuration.rssBudgetMiB) ||
    !positiveInteger(configuration.maxUnauthenticatedConnections) ||
    !positiveInteger(configuration.maxTrackedSessions) ||
    maxUnauthenticatedConnections + maxTrackedSessions > 2147483647
  ) {
    throw new Error('TDS_CAPACITY_CONFIG_INVALID');
  }

  return Object.freeze({
    schemaVersion: 1,
    rssBudgetMiB,
    maxUnauthenticatedConnections: String(maxUnauthenticatedConnections),
    maxTrackedSessions: String(maxTrackedSessions),
    source: TDS_CAPACITY_CONFIG_RELATIVE_PATH,
  });
};

export const loadTdsCapacityConfiguration = () => {
  let source;
  try {
    source = readFileSync(configPath, 'utf8');
  } catch {
    throw new Error('TDS_CAPACITY_CONFIG_MISSING');
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('TDS_CAPACITY_CONFIG_INVALID');
  }
  return validateTdsCapacityConfiguration(parsed);
};
