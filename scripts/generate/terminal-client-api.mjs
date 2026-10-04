#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const policyPath = 'contracts/policy/terminal-client-generation.json';

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `:${detail}` : ''}`);
  error.code = code;
  throw error;
}

function readJson(relativePath, root) {
  const absolute = resolveInsideRoot(relativePath, root, 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE');
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    if (error?.code === 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE') throw error;
    fail('TERMINAL_CLIENT_INPUT_JSON_INVALID', relativePath);
  }
}

function resolveInsideRoot(relativePath, root, marker) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '' || path.isAbsolute(relativePath)) {
    fail(marker, String(relativePath));
  }
  const absolute = path.resolve(root, relativePath);
  const lexical = path.relative(root, absolute);
  if (lexical === '..' || lexical.startsWith(`..${path.sep}`)) fail(marker, relativePath);
  let actual;
  try {
    actual = fs.realpathSync(absolute);
  } catch {
    fail('TERMINAL_CLIENT_INPUT_MISSING', relativePath);
  }
  const realRoot = fs.realpathSync(root);
  const realRelative = path.relative(realRoot, actual);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`)) fail(marker, relativePath);
  return actual;
}

function walkJsonFiles(directory, root) {
  const absolute = resolveInsideRoot(directory, root, 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE');
  return fs
    .readdirSync(absolute, {withFileTypes: true})
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const relative = path.posix.join(directory.replaceAll(path.sep, '/'), entry.name);
      if (entry.isSymbolicLink()) resolveInsideRoot(relative, root, 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE');
      if (entry.isDirectory()) return walkJsonFiles(relative, root);
      if (entry.isFile() && entry.name.endsWith('.json')) {
        resolveInsideRoot(relative, root, 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE');
        return [relative];
      }
      return [];
    });
}

function readOpenApiOperations(pathsRoot, root) {
  const operations = [];
  for (const file of walkJsonFiles(pathsRoot, root)) {
    const document = readJson(file, root);
    for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const operation = pathItem?.[method];
        if (!operation?.operationId) continue;
        const parametersByLocationAndName = new Map();
        for (const parameterList of [pathItem?.parameters ?? [], operation.parameters ?? []]) {
          const seenInList = new Set();
          for (const parameter of parameterList) {
            if (!['path', 'query', 'header'].includes(parameter?.in) || typeof parameter.name !== 'string') continue;
            const key = parameter.in + ':' + parameter.name.toLowerCase();
            if (seenInList.has(key)) fail('TERMINAL_CLIENT_PARAMETER_DUPLICATE', operation.operationId + ':' + key);
            seenInList.add(key);
            parametersByLocationAndName.set(key, parameter);
          }
        }
        const parameters = {path: [], query: [], header: []};
        for (const parameter of parametersByLocationAndName.values()) {
          parameters[parameter.in].push({
            in: parameter.in,
            name: parameter.name,
            required: parameter.in === 'path' || parameter.required === true,
            schema: parameter.schema ?? {},
          });
        }
        for (const list of Object.values(parameters)) list.sort((left, right) => left.name.localeCompare(right.name));
        const pathParameters = parameters.path;
        const routeParameters = [...route.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();
        const declaredPathParameters = pathParameters.map(parameter => parameter.name).sort();
        if (!sameSet(routeParameters, declaredPathParameters) || pathParameters.some(parameter => !parameter.required))
          fail('TERMINAL_CLIENT_PATH_PARAMETER_INVALID', operation.operationId);
        const security = operation.security ?? [];
        if (!Array.isArray(security)) fail('TERMINAL_CLIENT_SECURITY_INVALID', operation.operationId);
        const securitySchemes = [...new Set(security.flatMap(requirement => Object.keys(requirement ?? {})))].sort();
        const successfulResponses = Object.entries(operation.responses ?? {}).filter(
          ([status, response]) => /^2\d\d$/.test(status) && response?.content?.['application/json']?.schema?.$ref,
        );
        const [successStatus, successResponse] = successfulResponses[0] ?? [null, null];
        operations.push({
          operationId: operation.operationId,
          method: method.toUpperCase(),
          path: route,
          pathParameters,
          queryParameters: parameters.query,
          headerParameters: parameters.header,
          securitySchemes,
          tags: operation.tags ?? [],
          face: operation['x-consumer-faces'] ?? [],
          owner: operation['x-owner-module'] ?? null,
          auth: operation['x-authorization-mode'] ?? 'NONE',
          idempotencyPolicy: operation['x-idempotency-policy'] ?? null,
          safeRetryable: operation['x-safe-retryable'] === true,
          errors: operation['x-error-codes'] ?? [],
          requestSchema:
            operation.requestBody?.content?.['application/json']?.schema?.$ref?.split('/').at(-1) ??
            operation['x-request-schema'] ??
            null,
          responseSchema: successResponse?.content?.['application/json']?.schema?.$ref?.split('/').at(-1) ?? null,
          successStatus,
          successResponseCount: successfulResponses.length,
        });
      }
    }
  }
  const ids = operations.map(operation => operation.operationId);
  if (new Set(ids).size !== ids.length) fail('TERMINAL_CLIENT_OPERATION_DUPLICATE');
  return operations;
}

function loadModel(root = repoRoot) {
  const policy = readJson(policyPath, root);
  if (policy.schemaVersion !== 1 || policy.kind !== 'terminal-client-generation-policy')
    fail('TERMINAL_CLIENT_POLICY_INVALID');
  if (policy.face !== 'terminal' || !Array.isArray(policy.targets) || policy.targets.length === 0)
    fail('TERMINAL_CLIENT_SELECTOR_INVALID');
  const catalog = readJson(policy.operationCatalog, root);
  const catalogById = new Map((catalog.operations ?? []).map(operation => [operation.operationId, operation]));
  const openApiOperations = readOpenApiOperations(policy.openApiPathsRoot, root);
  const terminalCatalogIds = (catalog.operations ?? [])
    .filter(operation => operation.face === policy.face)
    .map(operation => operation.operationId)
    .sort();
  const schemaPaths = Array.isArray(policy.canonicalSchemas) ? policy.canonicalSchemas : [policy.canonicalSchemas];
  if (schemaPaths.length === 0 || schemaPaths.some(value => typeof value !== 'string'))
    fail('TERMINAL_CLIENT_SCHEMA_SOURCE_INVALID');
  const schemas = {};
  for (const schemaPath of schemaPaths) {
    const sourceSchemas = readJson(schemaPath, root).components?.schemas;
    if (!sourceSchemas || typeof sourceSchemas !== 'object') fail('TERMINAL_CLIENT_SCHEMA_SOURCE_INVALID', schemaPath);
    for (const [name, schema] of Object.entries(sourceSchemas)) {
      if (schemas[name] && JSON.stringify(schemas[name]) !== JSON.stringify(schema))
        fail('TERMINAL_CLIENT_SCHEMA_SOURCE_AMBIGUOUS', name);
      schemas[name] = schema;
    }
  }
  const targets = [];
  const packagePaths = new Set();
  const outputPaths = new Set();
  const assignmentCounts = new Map();
  for (const targetPolicy of policy.targets) {
    if (
      !targetPolicy ||
      typeof targetPolicy !== 'object' ||
      typeof targetPolicy.targetPackage !== 'string' ||
      !Array.isArray(targetPolicy.tags) ||
      targetPolicy.tags.length === 0 ||
      typeof targetPolicy.output !== 'string' ||
      targetPolicy.output.trim() === '' ||
      path.isAbsolute(targetPolicy.output)
    ) {
      fail('TERMINAL_CLIENT_TARGET_INVALID');
    }
    for (const field of ['includeOperationIds', 'excludeOperationIds']) {
      if (!Array.isArray(targetPolicy[field]) || targetPolicy[field].some(value => typeof value !== 'string'))
        fail('TERMINAL_CLIENT_SELECTOR_INVALID', field);
      if (new Set(targetPolicy[field]).size !== targetPolicy[field].length)
        fail('TERMINAL_CLIENT_SELECTOR_DUPLICATE', field);
    }
    if (packagePaths.has(targetPolicy.targetPackage))
      fail('TERMINAL_CLIENT_TARGET_DUPLICATE', targetPolicy.targetPackage);
    packagePaths.add(targetPolicy.targetPackage);
    if (outputPaths.has(targetPolicy.output)) fail('TERMINAL_CLIENT_OUTPUT_DUPLICATE', String(targetPolicy.output));
    outputPaths.add(targetPolicy.output);
    resolveInsideRoot(targetPolicy.targetPackage, root, 'TERMINAL_CLIENT_TARGET_ESCAPE');
    if (!targetPolicy.targetPackage.startsWith('apps/terminal/kernel/'))
      fail('TERMINAL_CLIENT_TARGET_INVALID', targetPolicy.targetPackage);
    const targetPackagePath = path.posix.join(targetPolicy.targetPackage, 'package.json');
    const targetModuleNamePath = path.posix.join(targetPolicy.targetPackage, 'src/moduleName.ts');
    const targetPackage = JSON.parse(
      fs.readFileSync(resolveInsideRoot(targetPackagePath, root, 'TERMINAL_CLIENT_TARGET_ESCAPE'), 'utf8'),
    );
    const moduleNameSource = fs.readFileSync(
      resolveInsideRoot(targetModuleNamePath, root, 'TERMINAL_CLIENT_TARGET_ESCAPE'),
      'utf8',
    );
    const ownerKind = /export const moduleKind\s*=\s*['"]owner['"]\s+as const/.test(moduleNameSource);
    const ownerName = /export const moduleName\s*=\s*['"](kernel\.[A-Za-z0-9._-]+)['"]\s+as const/.exec(
      moduleNameSource,
    )?.[1];
    if (
      !ownerKind ||
      !ownerName ||
      typeof targetPackage.name !== 'string' ||
      !targetPackage.name.startsWith('@catering-v2s/kernel-')
    )
      fail('TERMINAL_CLIENT_TARGET_NOT_OWNER', targetPolicy.targetPackage);
    const included = new Set(targetPolicy.includeOperationIds);
    const excluded = new Set(targetPolicy.excludeOperationIds);
    const selected = openApiOperations
      .filter(
        operation =>
          operation.face.includes(policy.face) &&
          targetPolicy.tags.some(tag => operation.tags.includes(tag)) &&
          (included.size === 0 || included.has(operation.operationId)) &&
          !excluded.has(operation.operationId),
      )
      .map(operation => ({...operation, pathParameters: [...operation.pathParameters]}));
    if (selected.length === 0) fail('TERMINAL_CLIENT_OPERATION_EMPTY', targetPolicy.targetPackage);
    if (included.size > 0 && selected.length !== included.size)
      fail('TERMINAL_CLIENT_OPERATION_SELECTOR_MISMATCH', targetPolicy.targetPackage);
    for (const operation of selected) {
      const catalogOperation = catalogById.get(operation.operationId);
      if (
        !catalogOperation ||
        catalogOperation.face !== policy.face ||
        catalogOperation.method !== operation.method ||
        catalogOperation.path !== operation.path
      )
        fail('TERMINAL_CLIENT_OPERATION_CATALOG_DRIFT', operation.operationId);
      if (catalogOperation.owner !== operation.owner)
        fail('TERMINAL_CLIENT_OPERATION_OWNER_DRIFT', operation.operationId);
      const idempotencyHeader = catalogOperation.idempotency?.header;
      if (!['REQUIRED', 'FORBIDDEN'].includes(idempotencyHeader) || operation.idempotencyPolicy !== idempotencyHeader)
        fail('TERMINAL_CLIENT_OPERATION_IDEMPOTENCY_DRIFT', operation.operationId);
      operation.idempotencyRequired = idempotencyHeader === 'REQUIRED';
      if (
        catalogOperation.authorizationMode !== operation.auth ||
        Boolean(catalogOperation.safeRetryable) !== operation.safeRetryable
      )
        fail('TERMINAL_CLIENT_OPERATION_SEMANTIC_DRIFT', operation.operationId);
      if (
        operation.successResponseCount !== 1 ||
        String(catalogOperation.successStatus) !== operation.successStatus ||
        !operation.responseSchema
      )
        fail('TERMINAL_CLIENT_OPERATION_SUCCESS_RESPONSE_DRIFT', operation.operationId);
      const expectedSecuritySchemes = operation.auth === 'TERMINAL_CREDENTIAL' ? ['terminalCredential'] : [];
      if (!sameSet(operation.securitySchemes, expectedSecuritySchemes))
        fail('TERMINAL_CLIENT_OPERATION_SECURITY_DRIFT', operation.operationId);
      if (!operation.requestSchema || !operation.responseSchema || operation.errors.length === 0)
        fail('TERMINAL_CLIENT_OPERATION_CONTRACT_INCOMPLETE', operation.operationId);
      if (!schemas[operation.requestSchema] || !schemas[operation.responseSchema])
        fail('TERMINAL_CLIENT_SCHEMA_MISSING', operation.operationId);
      if (targetPolicy.stripPathPrefix !== undefined) {
        const prefix = targetPolicy.stripPathPrefix;
        if (typeof prefix !== 'string' || !prefix.startsWith('/') || prefix.endsWith('/') || prefix.includes('?'))
          fail('TERMINAL_CLIENT_PATH_PREFIX_INVALID', operation.operationId);
        if (!operation.path.startsWith(`${prefix}/`))
          fail('TERMINAL_CLIENT_PATH_PREFIX_MISMATCH', operation.operationId);
        const removedNames = [...prefix.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
        if (
          new Set(removedNames).size !== removedNames.length ||
          removedNames.some(name => !operation.pathParameters.some(parameter => parameter.name === name))
        )
          fail('TERMINAL_CLIENT_PATH_PREFIX_PARAMETER_MISMATCH', operation.operationId);
        operation.generatedPath = operation.path.slice(prefix.length);
        operation.pathParameters = operation.pathParameters.filter(parameter => !removedNames.includes(parameter.name));
        const generatedRouteParameters = [...operation.generatedPath.matchAll(/\{([^}]+)\}/g)]
          .map(match => match[1])
          .sort();
        const generatedDeclaredParameters = operation.pathParameters.map(parameter => parameter.name).sort();
        if (!sameSet(generatedRouteParameters, generatedDeclaredParameters))
          fail('TERMINAL_CLIENT_GENERATED_PATH_PARAMETER_MISMATCH', operation.operationId);
      } else {
        operation.generatedPath = operation.path;
      }
      assignmentCounts.set(operation.operationId, (assignmentCounts.get(operation.operationId) ?? 0) + 1);
    }
    targets.push({
      policy: targetPolicy,
      targetPackage,
      moduleName: ownerName,
      selected: selected.sort((a, b) => a.operationId.localeCompare(b.operationId)),
      schemas,
    });
  }
  const assignedIds = [...assignmentCounts.keys()].sort();
  const duplicatedAssignment = [...assignmentCounts].find(([, count]) => count !== 1);
  if (duplicatedAssignment) fail('TERMINAL_CLIENT_OPERATION_DUPLICATE_ASSIGNMENT', duplicatedAssignment[0]);
  if (!sameSet(terminalCatalogIds, assignedIds)) fail('TERMINAL_CLIENT_OPERATION_FACE_CLOSURE');
  return {policy, targets, schemas};
}

function sameSet(left, right) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
}

function identifier(value) {
  return value.replace(/[^A-Za-z0-9_$]/g, '_');
}

function schemaType(schema, name, seen) {
  const declaredTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = declaredTypes.find(value => value !== 'null');
  const nullable = schema.nullable === true || declaredTypes.includes('null');
  const wrapNullable = value => (nullable ? `${value} | null` : value);
  if (Array.isArray(schema.allOf))
    return wrapNullable(
      schema.allOf.map((child, index) => schemaType(child, `${name}AllOf${index}`, seen)).join(' & '),
    );
  if (Array.isArray(schema.oneOf))
    return wrapNullable(
      schema.oneOf.map((child, index) => schemaType(child, `${name}OneOf${index}`, seen)).join(' | '),
    );
  if (Array.isArray(schema.anyOf))
    return wrapNullable(
      schema.anyOf.map((child, index) => schemaType(child, `${name}AnyOf${index}`, seen)).join(' | '),
    );
  if (schema.$ref) {
    const ref = schema.$ref.split('/').at(-1);
    if (!seen.has(ref)) fail('TERMINAL_CLIENT_SCHEMA_CLOSURE_MISSING', ref);
    return wrapNullable(ref);
  }
  if (Array.isArray(schema.enum)) return wrapNullable(schema.enum.map(value => JSON.stringify(value)).join(' | '));
  if (type === 'array') return wrapNullable(`readonly ${schemaType(schema.items ?? {}, `${name}Item`, seen)}[]`);
  if (type === 'string') return wrapNullable('string');
  if (type === 'integer' || type === 'number') return wrapNullable('number');
  if (type === 'boolean') return wrapNullable('boolean');
  if (type === 'object') {
    const members = Object.entries(schema.properties ?? {}).map(
      ([key, property]) =>
        `  readonly ${JSON.stringify(key)}${(schema.required ?? []).includes(key) ? '' : '?'}: ${schemaType(property, `${name}_${identifier(key)}`, seen)};`,
    );
    if (schema.additionalProperties === true) members.push('  readonly [key: string]: JsonValue;');
    else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
      members.push(
        `  readonly [key: string]: ${schemaType(schema.additionalProperties, `${name}AdditionalProperty`, seen)};`,
      );
    if (members.length === 0 && schema.additionalProperties !== true)
      return wrapNullable('Readonly<Record<string, never>>');
    return wrapNullable(`{
${members.join('\n')}
}`);
  }
  fail('TERMINAL_CLIENT_SCHEMA_TYPE_UNSUPPORTED', `${name}:${JSON.stringify(schema)}`);
}

function schemaClosure(selected, schemas) {
  const closure = new Set();
  const visit = (schema, context) => {
    if (!schema || typeof schema !== 'object') return;
    if (typeof schema.$ref === 'string') {
      const prefix = '#/components/schemas/';
      if (!schema.$ref.startsWith(prefix))
        fail('TERMINAL_CLIENT_SCHEMA_REFERENCE_UNSUPPORTED', `${context}:${schema.$ref}`);
      const name = schema.$ref.slice(prefix.length);
      if (!Object.hasOwn(schemas, name)) fail('TERMINAL_CLIENT_SCHEMA_MISSING', `${context}:${name}`);
      if (closure.has(name)) return;
      closure.add(name);
      visit(schemas[name], name);
      return;
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) visit(child, `${context}.${key}`);
    if (schema.items) visit(schema.items, `${context}[]`);
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
      visit(schema.additionalProperties, `${context}.*`);
    for (const key of ['allOf', 'oneOf', 'anyOf'])
      for (const [index, child] of (schema[key] ?? []).entries()) visit(child, `${context}.${key}[${index}]`);
  };
  for (const operation of selected) {
    visit({$ref: `#/components/schemas/${operation.requestSchema}`}, operation.operationId);
    visit({$ref: `#/components/schemas/${operation.responseSchema}`}, operation.operationId);
    for (const parameter of [
      ...operation.pathParameters,
      ...operation.queryParameters,
      ...operation.headerParameters,
    ]) {
      if (!parameter.name || (parameter.in === 'path' && !parameter.required))
        fail('TERMINAL_CLIENT_PATH_PARAMETER_INVALID', operation.operationId);
      visit(parameter.schema, operation.operationId + '.' + parameter.name);
    }
  }
  return [...closure].sort();
}

function render(model) {
  const {policy, selected, schemas} = model;
  const usedSchemas = schemaClosure(selected, schemas);
  const typeNames = new Set(usedSchemas);
  const types = usedSchemas
    .map(name => `export type ${name} = ${schemaType(schemas[name], name, typeNames)};`)
    .join('\n\n');
  const validatorSchemaDefinitions = JSON.stringify(Object.fromEntries(usedSchemas.map(name => [name, schemas[name]])));
  const requests = selected
    .map(operation => {
      const renderParameters = (items, location) =>
        items
          .map(
            parameter =>
              'readonly ' +
              JSON.stringify(parameter.name) +
              (parameter.required ? '' : '?') +
              ': ' +
              schemaType(
                parameter.schema,
                operation.operationId + '_' + location + '_' + identifier(parameter.name),
                typeNames,
              ),
          )
          .join('; ');
      const pathParameters = renderParameters(operation.pathParameters, 'path');
      const queryParameters = renderParameters(operation.queryParameters, 'query');
      const headerParameters = renderParameters(operation.headerParameters, 'header');
      const authorizationHeader =
        operation.auth === 'TERMINAL_CREDENTIAL' &&
        !operation.headerParameters.some(parameter => parameter.name.toLowerCase() === 'authorization')
          ? (headerParameters ? headerParameters + '; ' : '') + 'readonly "Authorization": string'
          : headerParameters;
      const requestParts = [
        'readonly pathParameters: { ' + pathParameters + ' }',
        'readonly queryParameters: ' +
          (queryParameters ? '{ ' + queryParameters + ' }' : 'Readonly<Record<string, never>>'),
        'readonly headers: ' +
          (authorizationHeader ? '{ ' + authorizationHeader + ' }' : 'Readonly<Record<string, never>>'),
        'readonly body: ' + operation.requestSchema,
      ];
      return '  ' + operation.operationId + ': { ' + requestParts.join('; ') + ' };';
    })
    .join('\n');
  const responseMap = selected.map(operation => `  ${operation.operationId}: ${operation.responseSchema};`).join('\n');
  const operationRows = selected
    .map(
      operation => `  ${JSON.stringify(operation.operationId)}: {
    operationId: ${JSON.stringify(operation.operationId)},
    method: ${JSON.stringify(operation.method)},
    path: ${JSON.stringify(operation.generatedPath)},
    owner: ${JSON.stringify(operation.owner)},
    authorizationMode: ${JSON.stringify(operation.auth)},
    idempotencyRequired: ${operation.idempotencyRequired},
    safeRetryable: ${operation.safeRetryable},
    successStatus: ${operation.successStatus},
    errorCodes: ${JSON.stringify(operation.errors)},
    requestSchema: ${JSON.stringify(operation.requestSchema)},
    responseSchema: ${JSON.stringify(operation.responseSchema)},
  },`,
    )
    .join('\n');
  const validators = `type TerminalJsonSchema = Readonly<{
  readonly $ref?: string;
  readonly type?: string | readonly string[];
  readonly nullable?: boolean;
  readonly enum?: readonly unknown[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, TerminalJsonSchema>>;
  readonly items?: TerminalJsonSchema;
  readonly additionalProperties?: boolean | TerminalJsonSchema;
  readonly allOf?: readonly TerminalJsonSchema[];
  readonly anyOf?: readonly TerminalJsonSchema[];
  readonly oneOf?: readonly TerminalJsonSchema[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
  readonly format?: string;
}>;
const terminalResponseSchemas = JSON.parse(${JSON.stringify(validatorSchemaDefinitions)}) as Readonly<Record<string, TerminalJsonSchema>>;

function matchesStringSchema(schema: TerminalJsonSchema, value: unknown): boolean {
  if (typeof value !== "string") return false;
  return (schema.minLength === undefined || value.length >= schema.minLength)
    && (schema.maxLength === undefined || value.length <= schema.maxLength)
    && (schema.pattern === undefined || new RegExp(schema.pattern).test(value))
    && (schema.format !== "uuid" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function matchesNumberSchema(schema: TerminalJsonSchema, value: unknown, integer: boolean): boolean {
  if (typeof value !== "number") return false;
  return (!integer || Number.isInteger(value))
    && (schema.minimum === undefined || value >= schema.minimum)
    && (schema.maximum === undefined || value <= schema.maximum);
}

function matchesArraySchema(schema: TerminalJsonSchema, value: unknown, depth: number): boolean {
  if (!Array.isArray(value)) return false;
  return (schema.minItems === undefined || value.length >= schema.minItems)
    && (schema.maxItems === undefined || value.length <= schema.maxItems)
    && (schema.items === undefined || value.every(item => matchesTerminalSchema(schema.items!, item, depth + 1)));
}

function matchesObjectSchema(schema: TerminalJsonSchema, value: unknown, depth: number): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const properties = schema.properties ?? {};
  const additionalProperties = schema.additionalProperties;
  if ((schema.required ?? []).some(key => !Object.hasOwn(record, key))) return false;
  if (Object.entries(properties).some(([key, child]) => Object.hasOwn(record, key)
    && !matchesTerminalSchema(child, record[key], depth + 1))) return false;
  if (additionalProperties === false
    && Object.keys(record).some(key => !Object.hasOwn(properties, key))) return false;
  if (typeof additionalProperties === "object"
    && Object.entries(record).some(([key, item]) => !Object.hasOwn(properties, key)
      && !matchesTerminalSchema(additionalProperties, item, depth + 1))) return false;
  return true;
}

function matchesTerminalSchema(schema: TerminalJsonSchema, value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  const declaredTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (value === null) return schema.nullable === true || declaredTypes.includes("null");
  if (schema.$ref) {
    const referenceName = schema.$ref.split("/").at(-1) ?? "";
    const referenceSchema = terminalResponseSchemas[referenceName];
    return referenceSchema !== undefined && matchesTerminalSchema(referenceSchema, value, depth + 1);
  }
  if (schema.enum && !schema.enum.some(candidate => Object.is(candidate, value))) return false;
  if (schema.allOf && !schema.allOf.every(child => matchesTerminalSchema(child, value, depth + 1))) return false;
  if (schema.anyOf && !schema.anyOf.some(child => matchesTerminalSchema(child, value, depth + 1))) return false;
  if (schema.oneOf && schema.oneOf.filter(child => matchesTerminalSchema(child, value, depth + 1)).length !== 1) return false;
  const nonNullTypes = declaredTypes.filter(type => type !== "null");
  const type = nonNullTypes.length === 1 ? nonNullTypes[0] : undefined;
  if (type === "string") return matchesStringSchema(schema, value);
  if (type === "integer" || type === "number") return matchesNumberSchema(schema, value, type === "integer");
  if (type === "boolean") return typeof value === "boolean";
  if (type === "array") return matchesArraySchema(schema, value, depth);
  if (type === "object" || schema.properties || schema.additionalProperties !== undefined)
    return matchesObjectSchema(schema, value, depth);
  return type === undefined || type === "null";
}

${usedSchemas
  .map(
    name => `export function is${name}(value: unknown): value is ${name} {
  return matchesTerminalSchema(terminalResponseSchemas[${JSON.stringify(name)}], value);
}`,
  )
  .join('\n\n')}`;
  const methods = selected
    .map(
      operation =>
        `    ${operation.operationId}: (request: TerminalRequestMap[${JSON.stringify(operation.operationId)}]) => execute(${JSON.stringify(operation.operationId)}, request),`,
    )
    .join('\n');
  return `// Generated from ${policyPath} and canonical terminal contract sources; do not edit.

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {readonly [key: string]: JsonValue};

${types}

export type TerminalOperationId = ${selected.map(operation => JSON.stringify(operation.operationId)).join(' | ')};
export const TERMINAL_OPERATION_IDS = ${JSON.stringify(selected.map(operation => operation.operationId))} as const;
export type TerminalRequestMap = {
${requests}
};
export type TerminalResponseMap = {
${responseMap}
};
export type TerminalBusinessErrorCode<I extends TerminalOperationId> = typeof terminalOperationContracts[I]["errorCodes"][number];
export type TerminalBusinessProblem = Readonly<{
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errorCode: string;
  readonly correlationId: string;
  readonly [key: string]: JsonValue;
}>;
export type TerminalExecutionResult =
  | {readonly kind: "response"; readonly status: number; readonly body: unknown; readonly contentType?: string}
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure"; readonly code: string};
export type TerminalOperationDescriptor<I extends TerminalOperationId = TerminalOperationId> = typeof terminalOperationContracts[I];
export type TerminalRequestExecutor = <I extends TerminalOperationId>(descriptor: TerminalOperationDescriptor<I>, request: TerminalRequestMap[I]) => Promise<TerminalExecutionResult>;
export type TerminalOperationResult<I extends TerminalOperationId> =
  | {readonly kind: "success"; readonly status: number; readonly body: TerminalResponseMap[I]}
  | {readonly kind: "business-rejection"; readonly status: number; readonly errorCode: TerminalBusinessErrorCode<I>; readonly problem: TerminalBusinessProblem}
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure" | "unknown-business-rejection"; readonly code: string};
export const terminalOperationContracts = {
${operationRows}
} as const;

${validators}

export function createTerminalApiClient(executeRequest: TerminalRequestExecutor) {
  const execute = async <I extends TerminalOperationId>(operationId: I, request: TerminalRequestMap[I]): Promise<TerminalOperationResult<I>> => {
    const descriptor = terminalOperationContracts[operationId];
    const result = await executeRequest(descriptor, request);
    if (result.kind === "failure") return result;
    if (result.status >= 200 && result.status < 300) {
      if (result.status !== descriptor.successStatus || !validateTerminalResponse(descriptor.responseSchema, result.body)) {
        return {kind: "failure", category: "delivered-failure", code: "TERMINAL_RESPONSE_SCHEMA_INVALID"};
      }
      return {kind: "success", status: result.status, body: result.body as TerminalResponseMap[I]};
    }
    if (result.status >= 400 && result.status < 500 && isTerminalBusinessProblem(result.body, result.status)) {
      if (descriptor.errorCodes.includes(result.body.errorCode as never)) {
        return {kind: "business-rejection", status: result.status, errorCode: result.body.errorCode as TerminalBusinessErrorCode<I>, problem: result.body};
      }
      return {kind: "failure", category: "unknown-business-rejection", code: result.body.errorCode};
    }
    return {kind: "failure", category: "delivered-failure", code: "HTTP_DELIVERED_FAILURE"};
  };
  return {
${methods}
  } as const;
}

function validateTerminalResponse(schemaName: string, value: unknown): boolean {
  switch (schemaName) {
${selected
  .filter(operation => selected.some(candidate => candidate.responseSchema === operation.responseSchema))
  .map(
    operation => `    case ${JSON.stringify(operation.responseSchema)}: return is${operation.responseSchema}(value);`,
  )
  .filter((row, index, rows) => rows.indexOf(row) === index)
  .join('\n')}
    default: return false;
  }
}

function isTerminalBusinessProblem(value: unknown, status: number): value is TerminalBusinessProblem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.status === status && typeof record.type === "string" &&
    typeof record.title === "string" && record.title.length > 0 && typeof record.detail === "string" &&
    typeof record.errorCode === "string" && record.errorCode.length > 0 &&
    typeof record.correlationId === "string" && record.correlationId.length >= 8;
}
`;
}

function outputPath(root, target) {
  const output = target.policy.output;
  const targetPackage = target.policy.targetPackage;
  if (typeof output !== 'string' || output.trim() === '' || path.isAbsolute(output))
    fail('TERMINAL_CLIENT_OUTPUT_PATH_ESCAPE', String(output));
  const absolute = path.resolve(root, output);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) fail('TERMINAL_CLIENT_OUTPUT_PATH_ESCAPE', output);
  if (!output.startsWith(`${targetPackage}/src/generated/`)) fail('TERMINAL_CLIENT_OUTPUT_PATH_ESCAPE', output);
  let parent = path.dirname(absolute);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  const actualParent = fs.realpathSync(parent);
  const actualRelative = path.relative(fs.realpathSync(root), actualParent);
  if (actualRelative === '..' || actualRelative.startsWith(`..${path.sep}`))
    fail('TERMINAL_CLIENT_OUTPUT_PATH_ESCAPE', output);
  if (fs.existsSync(absolute)) resolveInsideRoot(output, root, 'TERMINAL_CLIENT_OUTPUT_PATH_ESCAPE');
  return absolute;
}

export function check(root = repoRoot) {
  const model = loadModel(root);
  const outputs = model.targets.map(target => {
    const file = outputPath(root, target);
    if (!fs.existsSync(file)) fail('TERMINAL_CLIENT_GENERATED_MISSING', target.policy.output);
    if (fs.readFileSync(file, 'utf8') !== render(target)) fail('TERMINAL_CLIENT_GENERATED_DRIFT', target.policy.output);
    return Object.freeze({
      output: target.policy.output,
      operationIds: Object.freeze(target.selected.map(row => row.operationId)),
    });
  });
  return Object.freeze({
    operationIds: Object.freeze(model.targets.flatMap(target => target.selected.map(row => row.operationId)).sort()),
    operations: Object.freeze(
      model.targets
        .flatMap(target => target.selected)
        .map(row =>
          Object.freeze({
            operationId: row.operationId,
            method: row.method,
            path: row.path,
            owner: row.owner,
            authorizationMode: row.auth,
            idempotencyRequired: row.idempotencyRequired,
            safeRetryable: row.safeRetryable,
            consumerFaces: Object.freeze([model.policy.face]),
          }),
        ),
    ),
    outputs: Object.freeze(outputs),
    output: outputs.length === 1 ? outputs[0].output : undefined,
  });
}

export function write(root = repoRoot) {
  const model = loadModel(root);
  for (const target of model.targets) {
    const file = outputPath(root, target);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, render(target));
  }
  return check(root);
}

export function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-client-api-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-client-api-outside-'));
  try {
    const singleTarget = {
      targetPackage: 'apps/terminal/kernel/base/terminal-data-client',
      tags: ['terminal-binding'],
      includeOperationIds: ['activateTerminal', 'cancelTerminalActivation'],
      excludeOperationIds: [],
      stripPathPrefix: '/api/terminal/group-workspaces/{groupWorkspaceKey}',
      output: 'apps/terminal/kernel/base/terminal-data-client/src/generated/api.ts',
    };
    const policy = {
      schemaVersion: 1,
      kind: 'terminal-client-generation-policy',
      face: 'terminal',
      operationCatalog: 'catalog.json',
      openApiPathsRoot: 'paths',
      canonicalSchemas: 'schemas.json',
      targets: [singleTarget],
    };
    const writePolicy = value => fs.writeFileSync(path.join(root, policyPath), JSON.stringify(value));
    const createPackage = (relativePath, packageName, moduleName, kind = 'owner') => {
      const directory = path.join(root, relativePath);
      fs.mkdirSync(path.join(directory, 'src'), {recursive: true});
      fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name: packageName}));
      fs.writeFileSync(
        path.join(directory, 'src/moduleName.ts'),
        `export const moduleName = '${moduleName}' as const;\nexport const moduleKind = '${kind}' as const;\n`,
      );
    };
    fs.mkdirSync(path.join(root, 'contracts/policy'), {recursive: true});
    fs.mkdirSync(path.join(root, 'apps/terminal/kernel/base/terminal-data-client/src/generated'), {recursive: true});
    fs.mkdirSync(path.join(root, 'paths'), {recursive: true});
    createPackage(
      'apps/terminal/kernel/base/terminal-data-client',
      '@catering-v2s/kernel-base-terminal-data-client',
      'kernel.base.terminal-data-client',
    );
    createPackage(
      'apps/terminal/kernel/base/another-owner',
      '@catering-v2s/kernel-base-another-owner',
      'kernel.base.another-owner',
    );
    createPackage(
      'apps/terminal/kernel/base/contracts',
      '@catering-v2s/kernel-base-contracts',
      'kernel.base.contracts',
      'toolkit',
    );
    const targetPackageFile = path.join(root, singleTarget.targetPackage, 'package.json');
    const targetModuleNameFile = path.join(root, singleTarget.targetPackage, 'src/moduleName.ts');
    const validTargetPackage = fs.readFileSync(targetPackageFile, 'utf8');
    const validTargetModuleName = fs.readFileSync(targetModuleNameFile, 'utf8');
    const outsidePackageFile = path.join(outside, 'package.json');
    const outsideModuleNameFile = path.join(outside, 'moduleName.ts');
    fs.writeFileSync(outsidePackageFile, JSON.stringify({name: '@catering-v2s/kernel-outside'}));
    fs.writeFileSync(
      outsideModuleNameFile,
      "export const moduleName = 'kernel.outside' as const;\nexport const moduleKind = 'owner' as const;\n",
    );
    writePolicy(policy);
    const operation = {
      operationId: 'activateTerminal',
      method: 'POST',
      path: '/api/terminal/group-workspaces/{groupWorkspaceKey}/activation',
      tags: ['terminal-binding'],
      'x-consumer-faces': ['terminal'],
      'x-owner-module': 'terminal-binding',
      'x-authorization-mode': 'NONE',
      'x-idempotency-policy': 'FORBIDDEN',
      'x-safe-retryable': true,
      'x-error-codes': ['E_TEST'],
      security: [],
      parameters: [
        {name: 'groupWorkspaceKey', in: 'path', required: true, schema: {type: 'string'}},
        {name: 'mode', in: 'query', required: false, schema: {type: 'string'}},
        {name: 'X-Test', in: 'header', required: true, schema: {type: 'string'}},
      ],
      requestBody: {content: {'application/json': {schema: {$ref: '#/components/schemas/Request'}}}},
      responses: {200: {content: {'application/json': {schema: {$ref: '#/components/schemas/Response'}}}}},
    };
    const secondOperation = {
      ...operation,
      operationId: 'cancelTerminalActivation',
      path: '/api/terminal/group-workspaces/{groupWorkspaceKey}/terminals/{terminalRef}/activation/cancel',
      'x-authorization-mode': 'TERMINAL_CREDENTIAL',
      security: [{terminalCredential: []}],
      parameters: [
        {name: 'groupWorkspaceKey', in: 'path', required: true, schema: {type: 'string'}},
        {name: 'terminalRef', in: 'path', required: true, schema: {type: 'string'}},
        {name: 'mode', in: 'query', required: false, schema: {type: 'string'}},
        {name: 'X-Test', in: 'header', required: true, schema: {type: 'string'}},
      ],
    };
    fs.writeFileSync(
      path.join(root, 'paths/terminal.json'),
      JSON.stringify({
        paths: {
          [operation.path]: {post: operation},
          [secondOperation.path]: {post: secondOperation},
        },
      }),
    );
    const catalogOperation = operation => ({
      operationId: operation.operationId,
      face: 'terminal',
      method: 'POST',
      path: operation.path,
      owner: 'terminal-binding',
      authorizationMode: operation['x-authorization-mode'],
      safeRetryable: true,
      successStatus: '200',
      idempotency: {header: 'FORBIDDEN'},
    });
    fs.writeFileSync(
      path.join(root, 'catalog.json'),
      JSON.stringify({operations: [operation, secondOperation].map(catalogOperation)}),
    );
    fs.writeFileSync(
      path.join(root, 'schemas.json'),
      JSON.stringify({
        components: {
          schemas: {
            Request: {
              type: 'object',
              additionalProperties: true,
              required: ['name'],
              properties: {name: {type: 'string'}},
            },
            Response: {
              type: 'object',
              additionalProperties: false,
              required: ['id'],
              properties: {id: {type: 'string'}},
            },
          },
        },
      }),
    );
    const assertTargetFileSymlinkRejected = (targetPath, outsidePath, label, restoreContents) => {
      fs.rmSync(targetPath);
      fs.symlinkSync(outsidePath, targetPath);
      try {
        loadModel(root);
        fail(`TERMINAL_CLIENT_RED_${label}_SYMLINK_ESCAPE_NOT_DETECTED`);
      } catch (error) {
        if (error.code !== 'TERMINAL_CLIENT_TARGET_ESCAPE') throw error;
      } finally {
        fs.rmSync(targetPath);
        fs.writeFileSync(targetPath, restoreContents);
      }
    };
    assertTargetFileSymlinkRejected(targetPackageFile, outsidePackageFile, 'TARGET_PACKAGE', validTargetPackage);
    assertTargetFileSymlinkRejected(
      targetModuleNameFile,
      outsideModuleNameFile,
      'TARGET_MODULE_NAME',
      validTargetModuleName,
    );
    const model = loadModel(root);
    const generatedById = new Map(model.targets[0].selected.map(row => [row.operationId, row]));
    if (
      generatedById.get('activateTerminal')?.generatedPath !== '/activation' ||
      generatedById.get('cancelTerminalActivation')?.generatedPath !== '/terminals/{terminalRef}/activation/cancel' ||
      generatedById.get('activateTerminal')?.pathParameters.length !== 0 ||
      !sameSet(generatedById.get('cancelTerminalActivation')?.pathParameters.map(parameter => parameter.name) ?? [], [
        'terminalRef',
      ])
    )
      fail('TERMINAL_CLIENT_RED_GENERATED_PREFIX_CONTRACT_NOT_ENFORCED');
    const output = singleTarget.output;
    write(root);
    check(root);
    const generatedWithMissingOperation = fs
      .readFileSync(path.join(root, output), 'utf8')
      .replace(/TERMINAL_OPERATION_IDS = \[[^\]]*\]/, 'TERMINAL_OPERATION_IDS = []');
    fs.writeFileSync(path.join(root, output), generatedWithMissingOperation);
    try {
      check(root);
      fail('TERMINAL_CLIENT_RED_GENERATED_DRIFT_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_GENERATED_DRIFT') throw error;
    }
    write(root);
    const splitTargets = [
      {...singleTarget, includeOperationIds: ['activateTerminal']},
      {
        targetPackage: 'apps/terminal/kernel/base/another-owner',
        tags: ['terminal-binding'],
        includeOperationIds: ['cancelTerminalActivation'],
        excludeOperationIds: [],
        output: 'apps/terminal/kernel/base/another-owner/src/generated/api.ts',
      },
    ];
    writePolicy({...policy, targets: splitTargets});
    const splitResult = write(root);
    if (
      splitResult.outputs.length !== 2 ||
      !sameSet(splitResult.outputs[0].operationIds, ['activateTerminal']) ||
      !sameSet(splitResult.outputs[1].operationIds, ['cancelTerminalActivation'])
    )
      fail('TERMINAL_CLIENT_RED_MULTIPLE_TARGET_ASSIGNMENT_NOT_SUPPORTED');
    check(root);

    const duplicateTargets = {
      ...policy,
      targets: [
        {...singleTarget, includeOperationIds: ['activateTerminal']},
        {
          targetPackage: 'apps/terminal/kernel/base/another-owner',
          tags: ['terminal-binding'],
          includeOperationIds: ['activateTerminal'],
          excludeOperationIds: [],
          output: 'apps/terminal/kernel/base/another-owner/src/generated/api.ts',
        },
      ],
    };
    writePolicy(duplicateTargets);
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_DUPLICATE_ASSIGNMENT_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_OPERATION_DUPLICATE_ASSIGNMENT') throw error;
    }
    const wrongTarget = {
      ...policy,
      targets: [
        {
          ...singleTarget,
          includeOperationIds: ['activateTerminal'],
          targetPackage: 'apps/terminal/kernel/base/contracts',
          output: 'apps/terminal/kernel/base/contracts/src/generated/api.ts',
        },
      ],
    };
    writePolicy(wrongTarget);
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_NON_OWNER_TARGET_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_TARGET_NOT_OWNER') throw error;
    }
    const selectorMismatch = {
      ...policy,
      targets: [{...singleTarget, includeOperationIds: ['activateTerminal', 'missingOperation']}],
    };
    writePolicy(selectorMismatch);
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_SELECTOR_MISMATCH_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_OPERATION_SELECTOR_MISMATCH') throw error;
    }
    const escapedOutput = {...policy, targets: [{...singleTarget, output: '../outside.ts'}]};
    writePolicy(escapedOutput);
    try {
      outputPath(root, loadModel(root).targets[0]);
      fail('TERMINAL_CLIENT_RED_OUTPUT_ESCAPE_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_OUTPUT_PATH_ESCAPE') throw error;
    }
    const noOperation = JSON.parse(fs.readFileSync(path.join(root, 'paths/terminal.json'), 'utf8'));
    noOperation.paths[operation.path].post.tags = ['other'];
    fs.writeFileSync(path.join(root, 'paths/terminal.json'), JSON.stringify(noOperation));
    writePolicy(policy);
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_ZERO_NOT_DETECTED');
    } catch (error) {
      if (
        ![
          'TERMINAL_CLIENT_OPERATION_EMPTY',
          'TERMINAL_CLIENT_OPERATION_FACE_CLOSURE',
          'TERMINAL_CLIENT_OPERATION_SELECTOR_MISMATCH',
        ].includes(error.code)
      )
        throw error;
    }
    noOperation.paths[operation.path].post.tags = ['terminal-binding'];
    noOperation.paths[operation.path].post['x-consumer-faces'] = ['operations-admin'];
    fs.writeFileSync(path.join(root, 'paths/terminal.json'), JSON.stringify(noOperation));
    writePolicy(policy);
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_WRONG_FACE_NOT_DETECTED');
    } catch (error) {
      if (
        ![
          'TERMINAL_CLIENT_OPERATION_EMPTY',
          'TERMINAL_CLIENT_OPERATION_FACE_CLOSURE',
          'TERMINAL_CLIENT_OPERATION_SELECTOR_MISMATCH',
        ].includes(error.code)
      )
        throw error;
    }
    const escapedPolicy = {...policy, operationCatalog: '../outside.json'};
    writePolicy(escapedPolicy);
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_ROOT_ESCAPE_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE') throw error;
    }
    const outsideCatalog = path.join(outside, 'catalog.json');
    fs.writeFileSync(outsideCatalog, '{}');
    fs.symlinkSync(outsideCatalog, path.join(root, 'linked-catalog.json'));
    writePolicy({...policy, operationCatalog: 'linked-catalog.json'});
    try {
      loadModel(root);
      fail('TERMINAL_CLIENT_RED_SYMLINK_ESCAPE_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'TERMINAL_CLIENT_INPUT_PATH_ESCAPE') throw error;
    }
    process.stdout.write(
      'TERMINAL_CLIENT_API_SELF_TEST=PASS\nRED_ZERO_SELECTOR=PASS\nRED_WRONG_FACE=PASS\nRED_GENERATED_DRIFT=PASS\nRED_MULTIPLE_TARGET_ASSIGNMENT=PASS\nRED_DUPLICATE_ASSIGNMENT=PASS\nRED_NON_OWNER_TARGET=PASS\nRED_SELECTOR_MISMATCH=PASS\nRED_OUTPUT_ESCAPE=PASS\nRED_ROOT_ESCAPE=PASS\nRED_SYMLINK_ESCAPE=PASS\nRED_TARGET_PACKAGE_SYMLINK_ESCAPE=PASS\nRED_TARGET_MODULE_NAME_SYMLINK_ESCAPE=PASS\n',
    );
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
    fs.rmSync(outside, {recursive: true, force: true});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--self-test') selfTest();
    else if (args.length === 1 && args[0] === '--check') {
      const result = check();
      process.stdout.write(
        `TERMINAL_CLIENT_API_CHECK=PASS\nOPERATIONS=${result.operationIds.join(',')}\nOUTPUTS=${result.outputs.map(output => output.output).join(',')}\n`,
      );
    } else if (args.length === 1 && args[0] === '--write') {
      const result = write();
      process.stdout.write(
        `TERMINAL_CLIENT_API_WRITE=PASS\nOPERATIONS=${result.operationIds.join(',')}\nOUTPUTS=${result.outputs.map(output => output.output).join(',')}\n`,
      );
    } else fail('TERMINAL_CLIENT_API_ARGUMENT_INVALID');
  } catch (error) {
    process.stderr.write(`${error.code || 'TERMINAL_CLIENT_API_FAIL'}:${error.message}\n`);
    process.exitCode = 1;
  }
}
