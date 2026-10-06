import type {SelectorParameterSchema, StateSelectorParameters} from '../types/selector';

const matches = (value: unknown, schema: SelectorParameterSchema): boolean => {
  if (value === undefined) return schema.optional === true;
  switch (schema.kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'enum':
      return schema.values.some(candidate => Object.is(candidate, value));
    case 'array':
      return Array.isArray(value) && value.every(item => matches(item, schema.items));
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      return (
        Object.keys(record).every(key => key in schema.properties && matches(record[key], schema.properties[key])) &&
        Object.entries(schema.properties).every(([key, property]) =>
          Object.prototype.hasOwnProperty.call(record, key) ? matches(record[key], property) : property.optional === true,
        )
      );
    }
  }
};

export const validateSelectorArguments = (
  parameters: StateSelectorParameters,
  argsTuple: readonly unknown[],
  selectorName: string,
): void => {
  const requiredCount = parameters.filter(parameter => parameter.optional !== true).length;
  if (argsTuple.length < requiredCount || argsTuple.length > parameters.length) {
    throw new Error(`RUNTIME_SELECTOR_ARGUMENT_COUNT_INVALID:${selectorName}`);
  }
  for (let index = 0; index < argsTuple.length; index += 1) {
    const schema = parameters[index];
    if (schema === undefined || !matches(argsTuple[index], schema)) {
      throw new Error(`RUNTIME_SELECTOR_ARGUMENT_INVALID:${selectorName}:${index}`);
    }
  }
};
