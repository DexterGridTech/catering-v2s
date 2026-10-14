import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {assertStateJsonValue, cloneAndFreezeStateJsonValue} from '../../foundations/valueValidation';
import {setUiVariablesCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {completeUiStateWrite} from './completeWrite';
import variableActorSupport from './shared/variableActorSupport';
import type {UiVariableDeclaration, UiVariableWrite} from '../../types/variable';
import type {VariableStateFamily} from '../../foundations/variableSlices';

const {dispatchVariableAction, readRecord, requireExactKeys, requireRecord} = variableActorSupport;
type VariableRegistry = ReadonlyMap<string, UiVariableDeclaration<StateJsonValue>>;

const normalizeSetPayload = (
  value: unknown,
  registry: VariableRegistry,
): Readonly<{readonly entries: readonly UiVariableWrite<StateJsonValue>[]}> => {
  const record = requireRecord(value, 'set-ui-variables');
  requireExactKeys(record, ['entries'], 'set-ui-variables');
  if (!Array.isArray(record.entries)) throw new Error('[ui-state] set-ui-variables.entries must be an array');
  const seen = new Set<string>();
  const entries: UiVariableWrite<StateJsonValue>[] = [];
  for (const rawEntry of record.entries) {
    const entry = readRecord(rawEntry);
    if (entry === undefined) throw new Error('[ui-state] set-ui-variables entry must be an object');
    requireExactKeys(entry, ['key', 'value'], 'set-ui-variables entry');
    if (typeof entry.key !== 'string' || entry.key.trim().length === 0) {
      throw new Error('[ui-state] set-ui-variables entry key must be non-empty');
    }
    if (!registry.has(entry.key)) throw new Error(`[ui-state] unknown ui variable: ${entry.key}`);
    if (seen.has(entry.key)) throw new Error(`[ui-state] duplicate ui variable: ${entry.key}`);
    seen.add(entry.key);
    assertStateJsonValue(entry.value, `[ui-state] set-ui-variables.${entry.key}`);
    entries.push(
      Object.freeze({
        key: entry.key,
        value: cloneAndFreezeStateJsonValue(entry.value),
      }),
    );
  }
  return Object.freeze({entries: Object.freeze(entries)});
};

export const createSetUiVariablesActor = (registry: VariableRegistry, family: VariableStateFamily): ActorDefinition =>
  defineActor(moduleName, 'set-ui-variables', [
    onCommand(setUiVariablesCommand, async context => {
      const payload = normalizeSetPayload(context.command.payload, registry);
      return completeUiStateWrite(
        context,
        dispatchVariableAction(context, family, family.actions.setUiVariables(payload)),
        'variables',
      );
    }),
  ]);
