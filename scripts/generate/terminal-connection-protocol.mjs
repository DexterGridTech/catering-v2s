#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const contractPath = 'contracts/protocol/terminal-connection-protocol.json';
const targets = [
  'apps/terminal/kernel/base/terminal-data-client/src/generated/terminalConnectionProtocol.ts',
  'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/protocol/generated/TerminalConnectionMessages.java',
];
const requiredTopicKeys = [
  'STORE', 'PROJECT', 'REGION', 'COMMERCIAL_GROUP', 'STORE_OPERATING_RULE',
  'VALID_CONTRACT_COLLECTION', 'CONTRACT', 'SERVICE_POINT_AREA_COLLECTION',
  'SERVICE_POINT_AREA', 'SERVICE_POINT_COLLECTION', 'SERVICE_POINT',
];
const requiredMessageTypes = [
  'AUTHENTICATE', 'SESSION_READY', 'PING', 'PONG', 'TOPIC_SUBSCRIBE', 'TOPIC_UNSUBSCRIBE',
  'TOPIC_CHANGED', 'TOPIC_ACCEPT', 'REMOTE_COMMAND', 'REMOTE_REPORT', 'REMOTE_REPORT_ACK',
];

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}

function resolveInsideRoot(relativePath, root, marker = 'TDP_PROTOCOL_INPUT_PATH_ESCAPE') {
  if (typeof relativePath !== 'string' || relativePath.trim() === '' || path.isAbsolute(relativePath)) {
    fail(marker, String(relativePath));
  }
  const absolute = path.resolve(root, relativePath);
  const lexical = path.relative(root, absolute);
  if (lexical === '..' || lexical.startsWith(`..${path.sep}`)) fail(marker, relativePath);
  let real;
  try {
    real = fs.realpathSync(absolute);
  } catch {
    fail('TDP_PROTOCOL_INPUT_MISSING', relativePath);
  }
  const realRoot = fs.realpathSync(root);
  const realRelative = path.relative(realRoot, real);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`)) fail(marker, relativePath);
  return real;
}

function readContract(root) {
  const input = resolveInsideRoot(contractPath, root);
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(input, 'utf8'));
  } catch {
    fail('TDP_PROTOCOL_JSON_INVALID');
  }
  if (contract.protocolVersion !== 1 || !Array.isArray(contract.messages) || !Array.isArray(contract.topicKeys)) {
    fail('TDP_PROTOCOL_CONTRACT_INVALID');
  }
  const names = new Set();
  for (const message of contract.messages) {
    if (!message || typeof message.type !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(message.type)) {
      fail('TDP_PROTOCOL_MESSAGE_TYPE_INVALID');
    }
    if (names.has(message.type)) fail('TDP_PROTOCOL_MESSAGE_DUPLICATE', message.type);
    names.add(message.type);
    if (!['device_to_tds', 'tds_to_device'].includes(message.direction)) {
      fail('TDP_PROTOCOL_DIRECTION_INVALID', message.type);
    }
    if (message.additionalFields !== 'ignore' || !message.fields || typeof message.fields !== 'object' || Array.isArray(message.fields)) {
      fail('TDP_PROTOCOL_FIELD_SHAPE_INVALID', message.type);
    }
    for (const [field, schema] of Object.entries(message.fields)) {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(field) || !schema || !['string', 'integer', 'number', 'object'].includes(schema.type)) {
        fail('TDP_PROTOCOL_FIELD_INVALID', `${message.type}.${field}`);
      }
      if (schema.enumRef && (schema.enumRef !== 'topicKeys' || !contract.topicKeys.length)) {
        fail('TDP_PROTOCOL_ENUM_REF_INVALID', `${message.type}.${field}`);
      }
      if (schema.enum && (!Array.isArray(schema.enum) || schema.enum.length === 0 || schema.enum.some(value => typeof value !== 'string'))) {
        fail('TDP_PROTOCOL_ENUM_INVALID', `${message.type}.${field}`);
      }
    }
  }
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...requiredMessageTypes].sort())) {
    fail('TDP_PROTOCOL_MESSAGE_CLOSURE_INVALID');
  }
  if (new Set(contract.topicKeys).size !== contract.topicKeys.length ||
      JSON.stringify(contract.topicKeys) !== JSON.stringify(requiredTopicKeys)) {
    fail('TDP_PROTOCOL_TOPIC_CATALOG_INVALID');
  }
  return contract;
}

function tsType(field, schema, contract) {
  switch (schema.type) {
    case 'string':
      return schema.enumRef === 'topicKeys' ? 'TerminalTopicKey' : schema.enum ? schema.enum.map(value => JSON.stringify(value)).join(' | ') : 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'object':
      return 'Readonly<Record<string, unknown>>';
    default:
      fail('TDP_PROTOCOL_FIELD_INVALID', field);
  }
}

function javaType(schema) {
  switch (schema.type) {
    case 'string': return schema.enum ? 'String' : 'String';
    case 'integer': return 'long';
    case 'number': return 'double';
    case 'object': return 'JsonNode';
    default: fail('TDP_PROTOCOL_FIELD_INVALID');
  }
}

function className(type) {
  return type.toLowerCase().split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('');
}

function renderTs(contract) {
  const topicKeys = contract.topicKeys.map(value => `  ${JSON.stringify(value)},`).join('\n');
  const messages = contract.messages.map(message => {
    const fields = Object.entries(message.fields).map(([name, schema]) => `  readonly ${name}${schema.optional ? '?' : ''}: ${tsType(name, schema, contract)};`).join('\n');
    return `export type ${className(message.type)}Message = {\n  readonly type: ${JSON.stringify(message.type)};\n${fields}\n};`;
  }).join('\n\n');
  const members = contract.messages.map(message => `${className(message.type)}Message`).join(' |\n  ');
  return `// Generated by scripts/generate/terminal-connection-protocol.mjs. Do not edit.\n\nexport const terminalTopicKeys = [\n${topicKeys}\n] as const;\nexport type TerminalTopicKey = (typeof terminalTopicKeys)[number];\n\n${messages}\n\nexport type TerminalConnectionMessage =\n  ${members};\n`;
}

function renderJava(contract) {
  const records = contract.messages.map(message => {
    const fields = Object.entries(message.fields)
      .map(([name, schema]) => `            ${javaType(schema)} ${name}`)
      .join(',\n');
    const override = message.fields.terminalCredential
      ? `\n        @Override\n        public String toString() {\n            return "${className(message.type)}[terminalRef=" + terminalRef\n                    + ", terminalCredential=<redacted>, deviceId=" + deviceId\n                    + ", appVersion=" + appVersion + "]";\n        }\n`
      : '';
    return `    record ${className(message.type)}(\n${fields}\n    ) implements Message {\n        @Override\n        public String type() { return "${message.type}"; }${override}    }`;
  }).join('\n\n');
  const definitions = contract.messages.map(message => {
    const names = ['"type"', ...Object.keys(message.fields).map(name => JSON.stringify(name))]
      .map(name => `                ${name}`)
      .join(',\n');
    return `        Map.entry("${message.type}", Set.of(\n${names}\n        ))`;
  }).join(',\n');
  const permittedMessages = contract.messages.map(message => `        ${className(message.type)}`).join(',\n');
  return `// Generated by scripts/generate/terminal-connection-protocol.mjs. Do not edit.\npackage com.catering.v2s.terminaldataserver.protocol.generated;\n\nimport java.util.Map;\nimport java.util.Set;\nimport tools.jackson.databind.JsonNode;\n\npublic final class TerminalConnectionMessages {\n    private TerminalConnectionMessages() {}\n\n    public sealed interface Message permits\n${permittedMessages} {\n        String type();\n    }\n\n${records}\n\n    public static Map<String, Set<String>> fieldNamesByType() {\n        return Map.ofEntries(\n${definitions}\n        );\n    }\n}\n`;
}

function outputs(contract) {
  return new Map([
    [targets[0], renderTs(contract)],
    [targets[1], renderJava(contract)],
  ]);
}

function resolveOutputInsideRoot(relativePath, root) {
  if (path.isAbsolute(relativePath)) fail('TDP_PROTOCOL_OUTPUT_PATH_ESCAPE', relativePath);
  const absolute = path.resolve(root, relativePath);
  const lexical = path.relative(root, absolute);
  if (lexical === '..' || lexical.startsWith(`..${path.sep}`)) fail('TDP_PROTOCOL_OUTPUT_PATH_ESCAPE', relativePath);
  if (fs.existsSync(absolute)) {
    const real = fs.realpathSync(absolute);
    const realRelative = path.relative(fs.realpathSync(root), real);
    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`)) fail('TDP_PROTOCOL_OUTPUT_PATH_ESCAPE', relativePath);
  }
  return absolute;
}

function writeOrCheck(root, write) {
  const generated = outputs(readContract(root));
  let stale = false;
  for (const [relative, content] of generated) {
    const absolute = resolveOutputInsideRoot(relative, root);
    if (write) {
      fs.mkdirSync(path.dirname(absolute), {recursive: true});
      fs.writeFileSync(absolute, content);
    } else if (!fs.existsSync(absolute) || fs.readFileSync(absolute, 'utf8') !== content) {
      console.error(`TDP_PROTOCOL_GENERATED_DRIFT:${relative}`);
      stale = true;
    }
  }
  if (stale) process.exitCode = 1;
  else console.log(`TDP_PROTOCOL_${write ? 'WRITE' : 'CHECK'}=PASS FILES=${generated.size} TOPICS=${readContract(root).topicKeys.length}`);
}

function selfTest() {
  const contract = readContract(repoRoot);
  const missingMessage = JSON.parse(JSON.stringify(contract));
  missingMessage.messages = missingMessage.messages.filter(message => message.type !== 'REMOTE_REPORT');
  let missingMessageRejected = false;
  try {
    const current = new Set(missingMessage.messages.map(message => message.type));
    if (JSON.stringify([...current].sort()) !== JSON.stringify([...requiredMessageTypes].sort())) {
      fail('TDP_PROTOCOL_MESSAGE_CLOSURE_INVALID');
    }
  } catch (error) {
    missingMessageRejected = error.message.startsWith('TDP_PROTOCOL_MESSAGE_CLOSURE_INVALID');
  }
  if (!missingMessageRejected) fail('TDP_PROTOCOL_MESSAGE_CLOSURE_RED');
  const unknownMessage = JSON.parse(JSON.stringify(contract));
  unknownMessage.messages[unknownMessage.messages.length - 1].type = 'UNRECOGNIZED_MESSAGE';
  const unknownTypes = new Set(unknownMessage.messages.map(message => message.type));
  if (JSON.stringify([...unknownTypes].sort()) === JSON.stringify([...requiredMessageTypes].sort())) {
    fail('TDP_PROTOCOL_UNKNOWN_MESSAGE_RED');
  }
  const auth = contract.messages.find(message => message.type === 'AUTHENTICATE');
  if (!auth || !renderJava(contract).includes('terminalCredential=<redacted>')) fail('TDP_PROTOCOL_SECRET_TOSTRING_RED');
  let escaped = false;
  try { resolveInsideRoot('../outside.json', repoRoot); } catch (error) { escaped = error.message.startsWith('TDP_PROTOCOL_INPUT_PATH_ESCAPE'); }
  if (!escaped) fail('TDP_PROTOCOL_ROOT_ESCAPE_RED');
  let absoluteEscaped = false;
  try { resolveInsideRoot(path.join(os.tmpdir(), 'tdp-protocol-external.json'), repoRoot); } catch (error) {
    absoluteEscaped = error.message.startsWith('TDP_PROTOCOL_INPUT_PATH_ESCAPE');
  }
  if (!absoluteEscaped) fail('TDP_PROTOCOL_ABSOLUTE_PATH_ESCAPE_RED');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tdp-protocol-'));
  try {
    const external = path.join(path.dirname(tempRoot), `${path.basename(tempRoot)}-external`);
    fs.mkdirSync(external, {recursive: true});
    fs.symlinkSync(external, path.join(tempRoot, 'escape'));
    let symlinkEscaped = false;
    try { resolveInsideRoot('escape', tempRoot); } catch (error) { symlinkEscaped = error.message.startsWith('TDP_PROTOCOL_INPUT_PATH_ESCAPE'); }
    if (!symlinkEscaped) fail('TDP_PROTOCOL_SYMLINK_ESCAPE_RED');
    fs.rmSync(external, {recursive: true, force: true});
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
  console.log('TDP_PROTOCOL_ROOT_ESCAPE_RED=PASS');
  console.log('TDP_PROTOCOL_ABSOLUTE_PATH_ESCAPE_RED=PASS');
  console.log('TDP_PROTOCOL_SYMLINK_ESCAPE_RED=PASS');
  console.log('TDP_PROTOCOL_SECRET_TOSTRING_RED=PASS');
  console.log('TDP_PROTOCOL_MESSAGE_CLOSURE_RED=PASS');
  console.log('TDP_PROTOCOL_UNKNOWN_MESSAGE_RED=PASS');
  console.log('TDP_PROTOCOL_SELF_TEST=PASS');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) selfTest();
else if (args.includes('--write')) writeOrCheck(repoRoot, true);
else if (args.includes('--check')) writeOrCheck(repoRoot, false);
else {
  console.error('Usage: node scripts/generate/terminal-connection-protocol.mjs --check|--write|--self-test');
  process.exitCode = 2;
}
