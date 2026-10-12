#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const contractPath = 'contracts/protocol/terminal-remote-control-protocol.json';
const outputPaths = [
  'apps/terminal/kernel/base/remote-control/src/generated/terminalRemoteControlProtocol.ts',
  'apps/frontend/operations-admin/src/app/api/generated/terminalRemoteControlProtocol.ts',
];
const requiredMessages = [
  ['SCREEN_READY', 'endpoint_to_controller_and_master'],
  ['POINTER', 'controller_to_endpoint'],
  ['INPUT_RESULT', 'endpoint_to_controller'],
  ['KEEPALIVE', 'controller_to_endpoints'],
  ['KEEPALIVE_ACK', 'endpoint_to_controller'],
  ['SESSION_END', 'session_member_to_members'],
];

function fail(code) {
  throw new Error(code);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function resolveInputInsideRoot(relativePath, root) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '' || path.isAbsolute(relativePath)) {
    fail('TERMINAL_REMOTE_PROTOCOL_INPUT_PATH_ESCAPE');
  }
  const absolute = path.resolve(root, relativePath);
  if (!isInside(root, absolute)) fail('TERMINAL_REMOTE_PROTOCOL_INPUT_PATH_ESCAPE');
  try {
    const realRoot = fs.realpathSync(root);
    const realInput = fs.realpathSync(absolute);
    if (!isInside(realRoot, realInput)) fail('TERMINAL_REMOTE_PROTOCOL_INPUT_PATH_ESCAPE');
    return realInput;
  } catch (error) {
    if (error?.message === 'TERMINAL_REMOTE_PROTOCOL_INPUT_PATH_ESCAPE') throw error;
    fail('TERMINAL_REMOTE_PROTOCOL_INPUT_MISSING');
  }
}

function resolveOutputInsideRoot(relativePath, root) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '' || path.isAbsolute(relativePath)) {
    fail('TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATH_ESCAPE');
  }
  const absolute = path.resolve(root, relativePath);
  const realRoot = fs.realpathSync(root);
  if (!isInside(realRoot, absolute)) fail('TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATH_ESCAPE');

  let ancestor = path.dirname(absolute);
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) fail('TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATH_INVALID');
    ancestor = parent;
  }
  const realAncestor = fs.realpathSync(ancestor);
  if (!isInside(realRoot, realAncestor)) fail('TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATH_ESCAPE');
  if (fs.existsSync(absolute) && !isInside(realRoot, fs.realpathSync(absolute))) {
    fail('TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATH_ESCAPE');
  }
  return absolute;
}

function validSchema(schema, fieldName) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) ||
      !['uuid', 'string', 'integer', 'number'].includes(schema.type)) {
    fail('TERMINAL_REMOTE_PROTOCOL_FIELD_INVALID');
  }
  if (schema.enum !== undefined &&
      (!Array.isArray(schema.enum) || schema.enum.length === 0 ||
        schema.enum.some(value => typeof value !== 'string') || new Set(schema.enum).size !== schema.enum.length)) {
    fail('TERMINAL_REMOTE_PROTOCOL_ENUM_INVALID');
  }
  if (schema.optional !== undefined && typeof schema.optional !== 'boolean') {
    fail('TERMINAL_REMOTE_PROTOCOL_OPTIONAL_INVALID');
  }
  if (schema.nullable !== undefined && typeof schema.nullable !== 'boolean') {
    fail('TERMINAL_REMOTE_PROTOCOL_NULLABLE_INVALID');
  }
  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'const']) {
    if (schema[key] !== undefined && typeof schema[key] !== 'number') fail('TERMINAL_REMOTE_PROTOCOL_BOUND_INVALID');
  }
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) {
    fail('TERMINAL_REMOTE_PROTOCOL_BOUND_INVALID');
  }
  if (schema.minLength !== undefined && schema.maxLength !== undefined && schema.minLength > schema.maxLength) {
    fail('TERMINAL_REMOTE_PROTOCOL_BOUND_INVALID');
  }
  if (schema.type === 'uuid' && (schema.enum || schema.nullable || schema.optional || schema.minimum || schema.maximum)) {
    fail('TERMINAL_REMOTE_PROTOCOL_UUID_SCHEMA_INVALID');
  }
  if (schema.type === 'string' && (schema.minimum !== undefined || schema.maximum !== undefined || schema.const !== undefined)) {
    fail('TERMINAL_REMOTE_PROTOCOL_STRING_SCHEMA_INVALID');
  }
  if (['integer', 'number'].includes(schema.type) && (schema.enum || schema.nullable || schema.minLength !== undefined || schema.maxLength !== undefined)) {
    fail('TERMINAL_REMOTE_PROTOCOL_NUMBER_SCHEMA_INVALID');
  }
  if (fieldName === 'reason' && schema.type !== 'string') fail('TERMINAL_REMOTE_PROTOCOL_REASON_SCHEMA_INVALID');
}

function readContract(root) {
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(resolveInputInsideRoot(contractPath, root), 'utf8'));
  } catch (error) {
    if (error?.message?.startsWith('TERMINAL_REMOTE_PROTOCOL_')) throw error;
    fail('TERMINAL_REMOTE_PROTOCOL_JSON_INVALID');
  }
  if (contract?.protocolVersion !== 1 || contract.topic !== 'ter.remote-control.v1' ||
      contract.maxMessageBytes !== 4096 || contract.envelope?.additionalFields !== 'ignore' ||
      !contract.envelope?.fields || Array.isArray(contract.envelope.fields) || !Array.isArray(contract.messages)) {
    fail('TERMINAL_REMOTE_PROTOCOL_CONTRACT_INVALID');
  }
  const envelopeNames = Object.keys(contract.envelope.fields);
  if (JSON.stringify(envelopeNames) !== JSON.stringify(['v', 'sessionId', 'seq'])) {
    fail('TERMINAL_REMOTE_PROTOCOL_ENVELOPE_INVALID');
  }
  for (const [name, schema] of Object.entries(contract.envelope.fields)) validSchema(schema, name);
  if (contract.envelope.fields.v.const !== 1 || contract.envelope.fields.sessionId.type !== 'uuid' ||
      contract.envelope.fields.seq.type !== 'integer' || contract.envelope.fields.seq.minimum !== 1) {
    fail('TERMINAL_REMOTE_PROTOCOL_ENVELOPE_INVALID');
  }

  if (contract.messages.length !== requiredMessages.length) fail('TERMINAL_REMOTE_PROTOCOL_MESSAGE_CLOSURE_INVALID');
  for (const [index, [type, direction]] of requiredMessages.entries()) {
    const message = contract.messages[index];
    if (message?.type !== type || message.direction !== direction || message.additionalFields !== 'ignore' ||
        message.body?.additionalFields !== 'ignore' || !message.body.fields ||
        typeof message.body.fields !== 'object' || Array.isArray(message.body.fields)) {
      fail('TERMINAL_REMOTE_PROTOCOL_MESSAGE_CLOSURE_INVALID');
    }
    for (const [name, schema] of Object.entries(message.body.fields)) {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) fail('TERMINAL_REMOTE_PROTOCOL_FIELD_NAME_INVALID');
      validSchema(schema, name);
    }
  }
  return contract;
}

function tsType(schema) {
  let type;
  if (schema.type === 'uuid' || schema.type === 'string') {
    type = schema.enum ? schema.enum.map(value => JSON.stringify(value)).join(' | ') : 'string';
  } else {
    type = 'number';
  }
  return schema.nullable ? `${type} | null` : type;
}

function typeName(type) {
  return type.toLowerCase().split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('');
}

function renderContract(contract) {
  const types = contract.messages.map(message => {
    const bodyFields = Object.entries(message.body.fields).map(([name, schema]) =>
      `  readonly ${name}${schema.optional ? '?' : ''}: ${tsType(schema)};`).join('\n');
    const name = typeName(message.type);
    return `export type ${name}Body = Readonly<{\n${bodyFields}\n}>;\n\n` +
      `export type ${name}Message = RemoteControlEnvelope<${JSON.stringify(message.type)}, ${name}Body>;`;
  }).join('\n\n');
  const members = contract.messages.map(message => `  ${typeName(message.type)}Message`).join(' |\n');
  const messageTypes = contract.messages.map(message => `  ${JSON.stringify(message.type)},`).join('\n');
  return `// Generated by scripts/generate/terminal-remote-control-protocol.mjs. Do not edit.\n\n` +
    `export const remoteControlTopic = ${JSON.stringify(contract.topic)} as const;\n` +
    `export const remoteControlProtocolMaxMessageBytes = ${contract.maxMessageBytes} as const;\n` +
    `export const remoteControlMessageTypes = [\n${messageTypes}\n] as const;\n` +
    `export type RemoteControlMessageType = (typeof remoteControlMessageTypes)[number];\n\n` +
    `export type RemoteControlEnvelope<T extends RemoteControlMessageType, B> = Readonly<{\n` +
    `  readonly v: 1;\n  readonly type: T;\n  readonly sessionId: string;\n  readonly seq: number;\n  readonly body: B;\n}>;\n\n` +
    `${types}\n\nexport type RemoteControlMessage =\n${members};\n`;
}

export function selfTest(root = repoRoot) {
  const contract = readContract(root);
  const missing = structuredClone(contract);
  missing.messages.pop();
  let closureRejected = false;
  try {
    if (missing.messages.length !== requiredMessages.length) fail('TERMINAL_REMOTE_PROTOCOL_MESSAGE_CLOSURE_INVALID');
  } catch (error) {
    closureRejected = error?.message === 'TERMINAL_REMOTE_PROTOCOL_MESSAGE_CLOSURE_INVALID';
  }
  if (!closureRejected) fail('TERMINAL_REMOTE_PROTOCOL_MESSAGE_CLOSURE_RED');

  const outside = path.join(os.tmpdir(), `terminal-remote-protocol-${process.pid}-outside`);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-remote-protocol-'));
  try {
    fs.mkdirSync(outside, {recursive: true});
    fs.symlinkSync(outside, path.join(tempRoot, 'escape'));
    let symlinkRejected = false;
    try { resolveInputInsideRoot('escape', tempRoot); } catch (error) {
      symlinkRejected = error?.message === 'TERMINAL_REMOTE_PROTOCOL_INPUT_PATH_ESCAPE';
    }
    if (!symlinkRejected) fail('TERMINAL_REMOTE_PROTOCOL_SYMLINK_ESCAPE_RED');
    let absoluteRejected = false;
    try { resolveInputInsideRoot(outside, tempRoot); } catch (error) {
      absoluteRejected = error?.message === 'TERMINAL_REMOTE_PROTOCOL_INPUT_PATH_ESCAPE';
    }
    if (!absoluteRejected) fail('TERMINAL_REMOTE_PROTOCOL_ABSOLUTE_PATH_RED');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
    fs.rmSync(outside, {recursive: true, force: true});
  }
  return Object.freeze({messages: contract.messages.length, generatedBytes: Buffer.byteLength(renderContract(contract)), rootEscape: 'PASS'});
}

function run(mode) {
  if (!['--write', '--check', '--self-test'].includes(mode)) fail('TERMINAL_REMOTE_PROTOCOL_USAGE');
  if (mode === '--self-test') {
    const result = selfTest();
    process.stdout.write(`TERMINAL_REMOTE_PROTOCOL_SELF_TEST=PASS MESSAGES=${result.messages} ROOT_ESCAPE=${result.rootEscape}\n`);
    return;
  }
  const generated = renderContract(readContract(repoRoot));
  const targets = outputPaths.map(outputPath => ({
    outputPath,
    target: resolveOutputInsideRoot(outputPath, repoRoot),
  }));
  if (mode === '--write') {
    for (const {outputPath, target} of targets) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, generated);
      process.stdout.write(`TERMINAL_REMOTE_PROTOCOL_WRITE=PASS FILE=${outputPath}\n`);
    }
    return;
  }
  for (const {outputPath, target} of targets) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) {
      process.stderr.write(`TERMINAL_REMOTE_PROTOCOL_GENERATED_DRIFT=${outputPath}\n`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode !== 1) {
    process.stdout.write(`TERMINAL_REMOTE_PROTOCOL_CHECK=PASS FILES=${outputPaths.length}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv[2]); }
  catch (error) {
    process.stderr.write(`${error?.message?.startsWith('TERMINAL_REMOTE_PROTOCOL_') ? error.message : 'TERMINAL_REMOTE_PROTOCOL_FAILED'}\n`);
    process.exitCode = 1;
  }
}

