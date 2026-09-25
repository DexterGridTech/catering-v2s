#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRelative = 'contracts/catalog/store-terminal-rules.json';
const schemaRelative = 'contracts/catalog/store-terminal-rules.schema.json';
const outputFiles = Object.freeze({
  java: 'apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/generated/StoreTerminalRules.java',
  typescript: 'apps/frontend/operations-admin/src/app/api/generated/storeTerminalRules.ts',
  openapi: 'contracts/openapi/components/store-terminal/store-terminal-rules.generated.json',
});

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function readJson(relative) {
  return JSON.parse(read(relative));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fail(reason) {
  throw new Error(`STORE_TERMINAL_RULES_INVALID:${reason}`);
}

function uniqueKeys(rows, label) {
  const result = new Map();
  for (const row of rows) {
    if (result.has(row.key)) fail(`duplicate-${label}-key:${row.key}`);
    result.set(row.key, row);
  }
  return result;
}

function assertReferences(rows, field, targets, label) {
  for (const row of rows) {
    for (const key of row[field]) {
      if (!targets.has(key)) fail(`unknown-${label}:${row.key}:${key}`);
    }
  }
}

function compileSchema(schema) {
  const ajv = new Ajv2020({allErrors: true, strict: true, validateFormats: false});
  try {
    return ajv.compile(schema);
  } catch (error) {
    fail(`schema-invalid:${error.message}`);
  }
}

function validate(source, schema, schemaValidator = compileSchema(schema)) {
  if (!schemaValidator(source)) {
    const pathAndKeyword = schemaValidator.errors
      .map(({instancePath, keyword}) => `${instancePath || '/'}:${keyword}`)
      .join(',');
    fail(`schema:${pathAndKeyword}`);
  }

  const deviceTypes = uniqueKeys(source.deviceTypes, 'device-type');
  const functions = uniqueKeys(source.functions, 'function');
  const ranges = uniqueKeys(source.ranges, 'range');
  const scenes = uniqueKeys(source.scenes, 'scene');
  const paperSpecs = uniqueKeys(source.paperSpecs, 'paper-spec');
  const connectionMethods = uniqueKeys(source.connectionMethods, 'connection-method');
  const orderTypes = uniqueKeys(source.orderTypes, 'order-type');
  const printerBrands = uniqueKeys(source.printerBrands, 'printer-brand');
  const printerModels = uniqueKeys(source.printerModels, 'printer-model');

  assertReferences(source.functions, 'supportedDeviceTypeKeys', deviceTypes, 'device-type');
  assertReferences(source.functions, 'allowedRangeKeys', ranges, 'range');
  assertReferences(source.scenes, 'allowedPaperSpecKeys', paperSpecs, 'paper-spec');
  assertReferences(source.printerModels, 'paperSpecKeys', paperSpecs, 'paper-spec');
  assertReferences(source.printerModels, 'allowedConnectionMethodKeys', connectionMethods, 'connection-method');

  for (const scene of source.scenes) {
    if (!functions.has(scene.functionKey)) fail(`unknown-scene-function:${scene.key}:${scene.functionKey}`);
  }
  for (const rule of source.functions) {
    if (rule.key === 'QUEUE_CALL' && rule.allowedRangeKeys.length !== 0) {
      fail(`queue-call-must-have-no-ranges:${rule.key}`);
    }
    if (rule.key !== 'QUEUE_CALL' && rule.allowedRangeKeys.length === 0) {
      fail(`function-must-have-range-domain:${rule.key}`);
    }
  }
  for (const model of source.printerModels) {
    if (!printerBrands.has(model.brandKey)) fail(`unknown-printer-brand:${model.key}:${model.brandKey}`);
    if (model.evidenceUri !== null) {
      let evidence;
      try {
        evidence = new URL(model.evidenceUri);
      } catch {
        fail(`invalid-evidence-uri:${model.key}`);
      }
      if (evidence.protocol !== 'https:') fail(`invalid-evidence-protocol:${model.key}`);
    }
  }
  return Object.freeze({
    deviceTypes,
    functions,
    ranges,
    scenes,
    paperSpecs,
    connectionMethods,
    orderTypes,
    printerBrands,
    printerModels,
  });
}

function javaString(value) {
  const chunks = [];
  let chunk = '';
  for (const character of String(value)) {
    const escaped = JSON.stringify(character).slice(1, -1);
    if (chunk && Buffer.byteLength(`${chunk}${escaped}`, 'utf8') > 60) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += escaped;
  }
  chunks.push(chunk);
  return chunks.map((part, index) =>
    `${index === 0 ? '' : ' '.repeat(28)}"${part}"${index < chunks.length - 1 ? ' +' : ''}`,
  ).join('\n');
}

function javaLineLengthViolations(source) {
  return source.split(/\r?\n/)
    .flatMap((line, index) => {
      const byteLength = Buffer.byteLength(line, 'utf8');
      return byteLength > 120 ? [{line: index + 1, byteLength, content: line}] : [];
    });
}

function fitsJavaLineLimit(source) {
  return javaLineLengthViolations(source).length === 0;
}

function javaList(values) {
  return `List.of(${values.map(javaString).join(', ')})`;
}

function javaDouble(value) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function javaParameter(parameter) {
  if (parameter === null) return 'null';
  return `new ConnectionParameter(${javaString(parameter.key)}, ${javaString(parameter.label)}, ${javaString(parameter.valueKind)}, ${parameter.required}, ${parameter.pattern === undefined ? 'null' : javaString(parameter.pattern)}, ${parameter.minLength ?? 'null'}, ${parameter.maxLength ?? 'null'}, ${parameter.rejectUnicodeControlCharacters === true})`;
}

function javaSource(source, hash) {
  const indent = count => ' '.repeat(count);
  const javaCall = (name, args, callIndent = 12) => {
    const flat = `${indent(callIndent)}new ${name}(${args.join(', ')})`;
    if (fitsJavaLineLimit(`${flat},`)) return flat;

    const continuation = `${indent(callIndent + 8)}${args.join(', ')}`;
    const formattedArgs = fitsJavaLineLimit(continuation)
      ? continuation
      : args.map(argument => `${indent(callIndent + 8)}${argument}`).join(',\n');
    return `${indent(callIndent)}new ${name}(\n${formattedArgs})`;
  };
  const javaRecord = (name, components) => {
    const flat = `    public record ${name}(${components.join(', ')}) {}`;
    if (fitsJavaLineLimit(flat)) return flat;
    return `    public record ${name}(\n${components.map(component => `            ${component}`).join(',\n')}) {}`;
  };
  const rows = (name, constant, values, render) => {
    const rendered = values.map(render);
    const inline = `    public static final List<${name}> ${constant} = List.of(${rendered.join(', ')});`;
    if (fitsJavaLineLimit(inline)) return inline;

    const declaration = `    public static final List<${name}> ${constant} =`;
    const singleLineList = `${indent(12)}List.of(${rendered.join(', ')});`;
    if (rendered.every(row => !row.includes('\n')) && fitsJavaLineLimit(singleLineList)) {
      return `${declaration}\n${singleLineList}`;
    }
    const compactRows = rendered.map(row => row.trimStart()).join(', ');
    const compactList = `${declaration} List.of(\n            ${compactRows});`;
    if (rendered.every(row => !row.includes('\n')) && fitsJavaLineLimit(compactList)) {
      return compactList;
    }
    const multilineRows = rendered.map(row => `${row.startsWith('            ') ? '' : '            '}${row}`);
    return `${declaration} List.of(\n${multilineRows.join(',\n')});`;
  };
  const definitions = [
    rows(
      'DeviceType',
      'DEVICE_TYPES',
      source.deviceTypes,
      row => `new DeviceType(${javaString(row.key)}, ${javaString(row.label)}, ${javaString(row.description)})`,
    ),
    rows(
      'FunctionRule',
      'FUNCTION_RULES',
      source.functions,
      row => javaCall('FunctionRule', [
        javaString(row.key),
        javaString(row.label),
        javaList(row.supportedDeviceTypeKeys),
        row.maxPerTerminal === null ? 'null' : row.maxPerTerminal,
        javaList(row.allowedRangeKeys),
      ]),
    ),
    rows(
      'RangeRule',
      'RANGE_RULES',
      source.ranges,
      row => `new RangeRule(${javaString(row.key)}, ${javaString(row.label)})`,
    ),
    rows(
      'SceneRule',
      'SCENE_RULES',
      source.scenes,
      row => javaCall('SceneRule', [
        javaString(row.key),
        javaString(row.label),
        javaString(row.functionKey),
        javaList(row.allowedPaperSpecKeys),
      ]),
    ),
    rows(
      'PaperSpec',
      'PAPER_SPECS',
      source.paperSpecs,
      row => javaCall('PaperSpec', [
        javaString(row.key),
        javaString(row.label),
        javaString(row.kind),
        javaDouble(row.widthMm),
        row.lengthMm === null ? 'null' : javaDouble(row.lengthMm),
      ]),
    ),
    rows(
      'ConnectionMethod',
      'CONNECTION_METHODS',
      source.connectionMethods,
      row => {
        const args = [
          javaString(row.key),
          javaString(row.label),
          javaParameter(row.parameter),
        ];
        const flat = `            new ConnectionMethod(${args.join(', ')})`;
        if (fitsJavaLineLimit(`${flat},`)) return flat;
        if (row.parameter === null) {
          return `            new ConnectionMethod(\n                    ${args[0]},\n                    ${args[1]},\n                    null)`;
        }
        const parameterArgs = [
          javaString(row.parameter.key),
          javaString(row.parameter.label),
          javaString(row.parameter.valueKind),
          String(row.parameter.required),
          row.parameter.pattern === undefined ? 'null' : javaString(row.parameter.pattern),
          row.parameter.minLength ?? 'null',
          row.parameter.maxLength ?? 'null',
          String(row.parameter.rejectUnicodeControlCharacters === true),
        ];
        const parameter = `new ConnectionParameter(${parameterArgs.join(', ')})`;
        const formattedParameter = fitsJavaLineLimit(`${indent(20)}${parameter}`)
          ? parameter
          : `new ConnectionParameter(\n${parameterArgs.map(argument => `${indent(28)}${argument}`).join(',\n')})`;
        return `            new ConnectionMethod(\n                    ${args[0]},\n                    ${args[1]},\n                    ${formattedParameter})`;
      },
    ),
    rows(
      'OrderType',
      'ORDER_TYPES',
      source.orderTypes,
      row => `new OrderType(${javaString(row.key)}, ${javaString(row.label)})`,
    ),
    rows(
      'PrinterBrand',
      'PRINTER_BRANDS',
      source.printerBrands,
      row => `new PrinterBrand(${javaString(row.key)}, ${javaString(row.label)})`,
    ),
    rows(
      'PrinterModel',
      'PRINTER_MODELS',
      source.printerModels,
      row => javaCall('PrinterModel', [
        javaString(row.key),
        javaString(row.brandKey),
        javaString(row.label),
        javaList(row.paperSpecKeys),
        javaList(row.allowedConnectionMethodKeys),
        row.evidenceUri === null ? 'null' : javaString(row.evidenceUri),
      ]),
    ),
  ].join('\n\n');
  const rangeKeyConstants = source.ranges
    .map(row => `    public static final String RANGE_${row.key} = ${javaString(row.key)};`)
    .join('\n');

  const generated = `// GENERATED FILE. DO NOT EDIT. sourceSha256=${hash}
package com.catering.v2s.storeterminal.domain.generated;

import java.util.List;

public final class StoreTerminalRules {
    public static final String SOURCE_SHA256 = ${JSON.stringify(hash)};

${[
  javaRecord('DeviceType', ['String key', 'String label', 'String description']),
  javaRecord('FunctionRule', ['String key', 'String label', 'List<String> supportedDeviceTypeKeys', 'Integer maxPerTerminal', 'List<String> allowedRangeKeys']),
  javaRecord('RangeRule', ['String key', 'String label']),
  javaRecord('SceneRule', ['String key', 'String label', 'String functionKey', 'List<String> allowedPaperSpecKeys']),
  javaRecord('PaperSpec', ['String key', 'String label', 'String kind', 'double widthMm', 'Double lengthMm']),
  javaRecord('ConnectionParameter', ['String key', 'String label', 'String valueKind', 'boolean required', 'String pattern', 'Integer minLength', 'Integer maxLength', 'boolean rejectUnicodeControlCharacters']),
  javaRecord('ConnectionMethod', ['String key', 'String label', 'ConnectionParameter parameter']),
  javaRecord('OrderType', ['String key', 'String label']),
  javaRecord('PrinterBrand', ['String key', 'String label']),
  javaRecord('PrinterModel', ['String key', 'String brandKey', 'String label', 'List<String> paperSpecKeys', 'List<String> allowedConnectionMethodKeys', 'String evidenceUri']),
].join('\n\n')}

${rangeKeyConstants}

    // spotless:off
${definitions}
    // spotless:on

    private StoreTerminalRules() {}

    public static List<SceneRule> scenesForFunction(String functionKey) {
        return SCENE_RULES.stream()
                .filter(scene -> scene.functionKey().equals(functionKey))
                .toList();
    }

    public static boolean functionSupportsDevice(String functionKey, String deviceTypeKey) {
        return FUNCTION_RULES.stream()
                .filter(rule -> rule.key().equals(functionKey))
                .findFirst()
                .map(rule -> rule.supportedDeviceTypeKeys().contains(deviceTypeKey))
                .orElse(false);
    }

    public static boolean printerModelSupportsPaper(String modelKey, String paperSpecKey) {
        return PRINTER_MODELS.stream()
                .filter(model -> model.key().equals(modelKey))
                .findFirst()
                .map(model -> model.paperSpecKeys().contains(paperSpecKey))
                .orElse(false);
    }

    public static boolean printerModelSupportsConnection(String modelKey, String connectionMethodKey) {
        return PRINTER_MODELS.stream()
                .filter(model -> model.key().equals(modelKey))
                .findFirst()
                .map(model -> model.allowedConnectionMethodKeys().contains(connectionMethodKey))
                .orElse(false);
    }
}
`;
  const violations = javaLineLengthViolations(generated);
  if (violations.length > 0) {
    fail(`java-line-exceeds-120-utf8-bytes:${JSON.stringify(violations)}`);
  }
  return generated;
}

function tsSource(source, hash) {
  const literal = value => JSON.stringify(value, null, 2);
  const sections = [
    ['DEVICE_TYPES', source.deviceTypes],
    ['FUNCTIONS', source.functions],
    ['RANGES', source.ranges],
    ['SCENES', source.scenes],
    ['PAPER_SPECS', source.paperSpecs],
    ['CONNECTION_METHODS', source.connectionMethods],
    ['ORDER_TYPES', source.orderTypes],
    ['PRINTER_BRANDS', source.printerBrands],
    ['PRINTER_MODELS', source.printerModels],
  ]
    .map(([name, values]) => `export const STORE_TERMINAL_${name} = ${literal(values)} as const;`)
    .join('\n\n');
  const rangeKeyConstants = source.ranges
    .map(row => `  ${row.key}: ${JSON.stringify(row.key)},`)
    .join('\n');

  return `// GENERATED FILE. DO NOT EDIT. sourceSha256=${hash}
export const STORE_TERMINAL_RULES_SOURCE_SHA256 = ${JSON.stringify(hash)} as const;

${sections}

export const STORE_TERMINAL_RANGE_KEYS = {
${rangeKeyConstants}
} as const;

export type StoreTerminalDeviceTypeKey = typeof STORE_TERMINAL_DEVICE_TYPES[number]['key'];
export type StoreTerminalFunctionKey = typeof STORE_TERMINAL_FUNCTIONS[number]['key'];
export type StoreTerminalRangeKey = typeof STORE_TERMINAL_RANGES[number]['key'];
export type StoreTerminalSceneKey = typeof STORE_TERMINAL_SCENES[number]['key'];
export type StoreTerminalPaperSpecKey = typeof STORE_TERMINAL_PAPER_SPECS[number]['key'];
export type StoreTerminalConnectionMethodKey = typeof STORE_TERMINAL_CONNECTION_METHODS[number]['key'];
export type StoreTerminalOrderTypeKey = typeof STORE_TERMINAL_ORDER_TYPES[number]['key'];
export type StoreTerminalPrinterBrandKey = typeof STORE_TERMINAL_PRINTER_BRANDS[number]['key'];
export type StoreTerminalPrinterModelKey = typeof STORE_TERMINAL_PRINTER_MODELS[number]['key'];

export function storeTerminalScenesForFunction(functionKey: StoreTerminalFunctionKey) {
  return STORE_TERMINAL_SCENES.filter(scene => scene.functionKey === functionKey);
}

export function storeTerminalModelSupportsPaper(modelKey: StoreTerminalPrinterModelKey, paperSpecKey: StoreTerminalPaperSpecKey) {
  const model = STORE_TERMINAL_PRINTER_MODELS.find(model => model.key === modelKey);
  return model
    ? (model.paperSpecKeys as readonly StoreTerminalPaperSpecKey[]).includes(paperSpecKey)
    : false;
}

export function storeTerminalModelSupportsConnection(modelKey: StoreTerminalPrinterModelKey, methodKey: StoreTerminalConnectionMethodKey) {
  const model = STORE_TERMINAL_PRINTER_MODELS.find(model => model.key === modelKey);
  return model
    ? (model.allowedConnectionMethodKeys as readonly StoreTerminalConnectionMethodKey[]).includes(methodKey)
    : false;
}
`;
}

function openApiSource(source, hash) {
  const enumSchema = rows => ({
    type: 'string',
    enum: rows.map(row => row.key),
    'x-enum-labels': Object.fromEntries(rows.map(row => [row.key, row.label])),
    ...(rows.every(row => row.description === undefined)
      ? {}
      : {'x-enum-descriptions': Object.fromEntries(rows.map(row => [row.key, row.description]))}),
  });
  return `${JSON.stringify(
    {
      generated: true,
      sourceSha256: hash,
      components: {
        schemas: {
          StoreTerminalDeviceTypeKey: enumSchema(source.deviceTypes),
          StoreTerminalFunctionKey: enumSchema(source.functions),
          StoreTerminalRangeKey: enumSchema(source.ranges),
          StoreTerminalSceneKey: enumSchema(source.scenes),
          StoreTerminalPaperSpecKey: enumSchema(source.paperSpecs),
          StoreTerminalConnectionMethodKey: enumSchema(source.connectionMethods),
          StoreTerminalOrderTypeKey: enumSchema(source.orderTypes),
          StoreTerminalPrinterBrandKey: enumSchema(source.printerBrands),
          StoreTerminalPrinterModelKey: enumSchema(source.printerModels),
        },
      },
    },
    null,
    2,
  )}\n`;
}

function outputs() {
  const sourceText = read(sourceRelative);
  const source = JSON.parse(sourceText);
  const schema = readJson(schemaRelative);
  const schemaValidator = compileSchema(schema);
  validate(source, schema, schemaValidator);
  const hash = sha256(sourceText);
  return new Map([
    [outputFiles.java, javaSource(source, hash)],
    [outputFiles.typescript, tsSource(source, hash)],
    [outputFiles.openapi, openApiSource(source, hash)],
  ]);
}

function writeOutputs(generated) {
  for (const [relative, value] of generated) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), {recursive: true});
    fs.writeFileSync(absolute, value);
  }
}

function checkOutputs(generated) {
  for (const [relative, expected] of generated) {
    const absolute = path.join(root, relative);
    const actual = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
    if (actual !== expected) fail(`generated-output-drift:${relative}`);
  }
  process.stdout.write(`STORE_TERMINAL_RULES_CHECK=PASS outputs=${generated.size}\n`);
}

function selfTest() {
  const source = readJson(sourceRelative);
  const schema = readJson(schemaRelative);
  const schemaValidator = compileSchema(schema);
  const mutations = [
    [
      'schema-empty-paper-specs',
      copy => {
        copy.printerModels[0].paperSpecKeys = [];
      },
    ],
    [
      'schema-empty-connection-methods',
      copy => {
        copy.printerModels[0].allowedConnectionMethodKeys = [];
      },
    ],
    [
      'schema-extra-property',
      copy => {
        copy.functions[0].unexpected = true;
      },
    ],
    [
      'duplicate-function-key',
      copy => {
        copy.functions[1].key = copy.functions[0].key;
      },
    ],
    [
      'queue-call-range-added',
      copy => {
        copy.functions.find(rule => rule.key === 'QUEUE_CALL').allowedRangeKeys = ['PRODUCTION_TAG'];
      },
    ],
    [
      'non-queue-empty-range-domain',
      copy => {
        copy.functions.find(rule => rule.key === 'KDS').allowedRangeKeys = [];
      },
    ],
    [
      'unknown-scene-function',
      copy => {
        copy.scenes[0].functionKey = 'UNKNOWN_FUNCTION';
      },
    ],
    [
      'unknown-model-paper-spec',
      copy => {
        copy.printerModels[0].paperSpecKeys = ['UNKNOWN_PAPER'];
      },
    ],
    [
      'unknown-model-brand',
      copy => {
        copy.printerModels[0].brandKey = 'UNKNOWN_BRAND';
      },
    ],
    [
      'invalid-evidence-uri',
      copy => {
        copy.printerModels[0].evidenceUri = 'not a URI';
      },
    ],
    [
      'network-parameter-kind-mismatch',
      copy => {
        const network = copy.connectionMethods.find(method => method.key === 'NETWORK').parameter;
        network.valueKind = 'IDENTIFIER';
        network.minLength = 1;
        network.maxLength = 160;
        network.rejectUnicodeControlCharacters = true;
        delete network.pattern;
      },
    ],
    [
      'cloud-parameter-key-mismatch',
      copy => {
        copy.connectionMethods.find(method => method.key === 'CLOUD').parameter.key = 'deviceIdentifier';
      },
    ],
    [
      'usb-parameter-key-mismatch',
      copy => {
        copy.connectionMethods.find(method => method.key === 'USB').parameter.key = 'deviceId';
      },
    ],
    [
      'bluetooth-parameter-key-mismatch',
      copy => {
        copy.connectionMethods.find(method => method.key === 'BLUETOOTH').parameter.key = 'ipAddress';
      },
    ],
    [
      'built-in-parameter-added',
      copy => {
        copy.connectionMethods.find(method => method.key === 'BUILT_IN').parameter = {
          key: 'deviceIdentifier',
          label: '设备标识',
          valueKind: 'IDENTIFIER',
          required: true,
          minLength: 1,
          maxLength: 160,
          rejectUnicodeControlCharacters: true,
        };
      },
    ],
  ];
  for (const [name, mutate] of mutations) {
    const copy = structuredClone(source);
    mutate(copy);
    let rejected = false;
    try {
      validate(copy, schema, schemaValidator);
    } catch {
      rejected = true;
    }
    if (!rejected) fail(`self-test-not-rejected:${name}`);
    process.stdout.write(`STORE_TERMINAL_RULES_RED_${name.toUpperCase().replaceAll('-', '_')}=PASS\n`);
  }
  validate(source, schema, schemaValidator);
  const generated = new Map([
    [outputFiles.java, javaSource(source, 'test-hash')],
    [outputFiles.typescript, tsSource(source, 'test-hash')],
    [outputFiles.openapi, openApiSource(source, 'test-hash')],
  ]);
  if (generated.size !== 3 || [...generated.values()].some(value => value.length === 0))
    fail('self-test-valid-positive-generation');
  process.stdout.write(
    `STORE_TERMINAL_RULES_SELF_TEST=PASS redMutations=${mutations.length} LEGAL_POSITIVE=PASS outputs=${generated.size}\n`,
  );
}

function main(argv) {
  const args = new Set(argv);
  const supported = new Set(['--write', '--check', '--self-test']);
  for (const arg of args) if (!supported.has(arg)) fail(`unsupported-argument:${arg}`);
  if (args.has('--write') && args.has('--check')) fail('write-and-check-are-exclusive');
  if (args.has('--self-test')) selfTest();
  if (args.has('--check')) checkOutputs(outputs());
  else if (args.has('--write') || args.size === 0) {
    const generated = outputs();
    writeOutputs(generated);
    process.stdout.write(`STORE_TERMINAL_RULES_GENERATED=PASS outputs=${generated.size}\n`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

export {compileSchema, main, outputs, validate};
