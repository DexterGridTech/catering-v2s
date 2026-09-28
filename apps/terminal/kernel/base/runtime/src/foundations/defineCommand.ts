import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  commandDefinitionBrand,
  type CommandDefinition,
  type CommandIntent,
  type DefineCommandInput,
} from '../types/command';
import {defaultCommandTimeoutMs} from '../types/limits';
import {assertNonEmptyString} from './assertNonEmptyString';

export const defineCommand = <TPayload extends StateJsonValue = StateJsonValue>(
  moduleName: string,
  input: DefineCommandInput,
): CommandDefinition<TPayload> => {
  assertNonEmptyString(moduleName, '', 'Runtime command module name');
  assertNonEmptyString(input.name, '', 'Runtime command name');
  if (input.name.includes('.')) {
    throw new Error(`Runtime command name must be a bare name: ${input.name}`);
  }

  const timeoutMs = input.timeoutMs ?? defaultCommandTimeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Runtime command timeout must be a finite positive number: ${input.name}`);
  }

  const definition: CommandDefinition<TPayload> = {
    moduleName,
    commandName: `${moduleName}.${input.name}`,
    visibility: input.visibility,
    timeoutMs,
    allowNoActor: input.allowNoActor ?? false,
    allowReentry: input.allowReentry ?? false,
    defaultTarget: input.defaultTarget ?? 'local',
    [commandDefinitionBrand]: (payload: TPayload): TPayload => payload,
  };

  return Object.freeze(definition);
};

export const createCommand = <TPayload extends StateJsonValue>(
  definition: CommandDefinition<TPayload>,
  payload: TPayload,
): CommandIntent<TPayload> => Object.freeze({definition, payload});
