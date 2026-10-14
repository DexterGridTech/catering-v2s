import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {clearUiVariablesCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {completeUiStateWrite} from './completeWrite';
import variableActorSupport from './shared/variableActorSupport';
import type {UiVariableDeclaration} from '../../types/variable';
import type {VariableStateFamily} from '../../foundations/variableSlices';

const {dispatchVariableAction, requireExactKeys, requireRecord} = variableActorSupport;
type VariableRegistry = ReadonlyMap<string, UiVariableDeclaration<StateJsonValue>>;

const normalizeClearPayload = (
  value: unknown,
  registry: VariableRegistry,
): Readonly<{readonly keys: readonly string[]}> => {
  const record = requireRecord(value, 'clear-ui-variables');
  requireExactKeys(record, ['keys'], 'clear-ui-variables');
  if (!Array.isArray(record.keys)) throw new Error('[ui-state] clear-ui-variables.keys must be an array');
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of record.keys) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('[ui-state] clear-ui-variables key must be non-empty');
    }
    if (!registry.has(key)) throw new Error(`[ui-state] unknown ui variable: ${key}`);
    if (seen.has(key)) throw new Error(`[ui-state] duplicate ui variable: ${key}`);
    seen.add(key);
    keys.push(key);
  }
  return Object.freeze({keys: Object.freeze(keys)});
};

export const createClearUiVariablesActor = (registry: VariableRegistry, family: VariableStateFamily): ActorDefinition =>
  defineActor(moduleName, 'clear-ui-variables', [
    onCommand(clearUiVariablesCommand, async context => {
      const payload = normalizeClearPayload(context.command.payload, registry);
      return completeUiStateWrite(
        context,
        dispatchVariableAction(context, family, family.actions.clearUiVariables(payload)),
        'variables',
      );
    }),
  ]);
