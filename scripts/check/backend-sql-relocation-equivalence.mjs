#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {resolveGradleCommand} from '../lib/gradle-runtime.mjs';

const repositoryRoot = path.resolve(process.cwd());
const args = process.argv.slice(2);
const baselineIndex = args.indexOf('--baseline');
if (baselineIndex < 0 || !args[baselineIndex + 1]) {
  process.stderr.write(
    'Usage: node scripts/check/backend-sql-relocation-equivalence.mjs --baseline <pre-B3-source-root>\n',
  );
  process.exit(2);
}

const baselineRoot = path.resolve(args[baselineIndex + 1]);
const currentRoot = path.resolve(
  args.indexOf('--current') >= 0 ? args[args.indexOf('--current') + 1] : repositoryRoot,
);
const evidenceRoot = path.join(currentRoot, '.runtime/r5/evidence/readability-b3');
const runId = [
  'backend-sql-relocation-equivalence',
  new Date().toISOString().replace(/[-:.TZ]/g, ''),
  String(process.pid),
].join('-');
const runRoot = path.join(evidenceRoot, 'runs', runId);
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'catering-v2s-b3-equivalence-'));
const events = [];
const JDBC_SINK_PATTERN =
  /\/\/ (?:InterfaceMethod|Method) [^ ]*JdbcTemplate\.(queryForObject|queryForList|queryForRowSet|batchUpdate|query|update|execute):/;
const state = {
  schemaVersion: 1,
  kind: 'backend-sql-relocation-equivalence-run-manifest',
  runId,
  status: 'RUNNING',
  startedAt: new Date().toISOString(),
  baselineRoot,
  currentRoot,
  authorizationBoundary:
    'B3 static/compiled equivalence evidence only; no DEV, seed, reset, UAT, browser L2, deployment or runtime execution.',
  stages: events,
  cleanupStatus: 'PENDING',
};

fs.mkdirSync(runRoot, {recursive: true});

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function digest(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function relativeTo(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function walkFiles(root, predicate, output = []) {
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) walkFiles(filePath, predicate, output);
    else if (entry.isFile() && predicate(filePath)) output.push(filePath);
  }
  return output;
}

function shouldCopy(relativePath) {
  if (!relativePath) return true;
  return !relativePath
    .split(path.sep)
    .some(segment => ['.git', '.gradle', 'build', 'node_modules', '.runtime'].includes(segment));
}

function copySnapshot(sourceRoot, targetRoot) {
  fs.cpSync(sourceRoot, targetRoot, {
    recursive: true,
    force: true,
    filter(source) {
      return shouldCopy(path.relative(sourceRoot, source));
    },
  });
}

function productionJavaFiles(root) {
  const serverRoot = path.join(root, 'apps/backend/catering-business-server');
  return walkFiles(
    serverRoot,
    filePath =>
      filePath.endsWith('.java') &&
      !filePath.includes(path.sep + 'build' + path.sep) &&
      (filePath.includes(path.sep + 'modules' + path.sep) ||
        filePath.includes(path.sep + 'src' + path.sep + 'main' + path.sep + 'java' + path.sep)),
  ).sort();
}

function holders(root) {
  return productionJavaFiles(root).filter(
    filePath =>
      filePath.includes(path.sep + 'application' + path.sep + 'persistence' + path.sep) &&
      path.basename(filePath).endsWith('Sql.java'),
  );
}

function isSqlHolderPath(relativePath) {
  return (
    relativePath.includes('/application/persistence/') &&
    relativePath.endsWith('Sql.java')
  );
}

function sourceManifest(root) {
  const files = productionJavaFiles(root);
  const entries = files.map(filePath => {
    const content = fs.readFileSync(filePath);
    return {
      path: relativeTo(root, filePath),
      sha256: digest(content),
      bytes: content.length,
    };
  });
  const canonical = entries.map(entry => entry.path + '\0' + entry.sha256 + '\0').join('');
  return {
    root: 'apps/backend/catering-business-server',
    fileCount: entries.length,
    filesSha256: digest(canonical),
    entries,
  };
}

function sourceDiff(before, after) {
  const left = new Map(before.entries.map(entry => [entry.path, entry]));
  const right = new Map(after.entries.map(entry => [entry.path, entry]));
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  return paths
    .filter(relative => {
      const a = left.get(relative);
      const b = right.get(relative);
      return !a || !b || a.sha256 !== b.sha256;
    })
    .map(relative => ({
      path: relative,
      kind: !left.has(relative) ? 'ADDED' : !right.has(relative) ? 'REMOVED' : 'MODIFIED',
      before: left.get(relative) || null,
      after: right.get(relative) || null,
    }));
}

function changedModuleNames(changes) {
  return [
    ...new Set(
      changes
        .map(change => change.path.match(/^apps\/backend\/catering-business-server\/modules\/([^/]+)\//)?.[1])
        .filter(Boolean),
    ),
  ].sort();
}

function classFiles(root, moduleNames) {
  return moduleNames
    .flatMap(moduleName => {
      const classRoot = path.join(
        root,
        'apps/backend/catering-business-server/modules',
        moduleName,
        'build/classes/java/main',
      );
      return walkFiles(classRoot, filePath => filePath.endsWith('.class'));
    })
    .sort();
}

function classManifest(root, moduleNames) {
  const entries = classFiles(root, moduleNames).map(filePath => {
    const content = fs.readFileSync(filePath);
    return {
      path: relativeTo(root, filePath),
      sha256: digest(content),
      bytes: content.length,
    };
  });
  return {
    modules: moduleNames,
    roots: [...new Set(
      entries.map(entry => entry.path.split('/build/classes/java/main/')[0] + '/build/classes/java/main'),
    )].sort(),
    fileCount: entries.length,
    entries,
  };
}

function holderSourceShape(root, relativePath) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  return {
    path: relativePath,
    sha256: digest(source),
    importCount: (source.match(/^import\s+/gm) || []).length,
    stringFieldDeclarationCount:
      source.match(/^\s*public\s+static\s+final\s+String\s+[A-Za-z_$][\w$]*\s*=/gm)?.length || 0,
    hasPublicFinalClass: /public\s+final\s+class\s+[A-Za-z_$][\w$]*/.test(source),
    hasSpringJdbcOrRepositoryImport: /\b(?:springframework|JdbcTemplate|Repository)\b/.test(
      source.match(/^import\s+[^;]+;/gm)?.join('\n') || '',
    ),
  };
}

function holderBytecodeProof(root, holderPaths, javap) {
  const entries = holderPaths.map(relativePath => {
    const source = holderSourceShape(root, relativePath);
    const classFile = relativePath
      .replace('/src/main/java/', '/build/classes/java/main/')
      .replace(/\.java$/, '.class');
    const section = javap.sections.find(value => value.classFile === classFile);
    const summary = section?.raw.match(/\bfields: (\d+), methods: (\d+), attributes:/);
    const fieldCount = summary ? Number(summary[1]) : null;
    const methodCount = summary ? Number(summary[2]) : null;
    const stringFieldCount =
      section?.raw.match(/^  (?:public|private|protected) static final java\.lang\.String [A-Za-z_$][\w$]*;$/gm)
        ?.length || 0;
    const constantValueCount = section?.raw.match(/^[ \t]+ConstantValue:/gm)?.length || 0;
    const issues = [];
    if (!section) issues.push('HOLDER_CLASS_NOT_IN_JAVAP');
    if (source.importCount !== 0) issues.push('HOLDER_HAS_IMPORTS');
    if (source.hasSpringJdbcOrRepositoryImport) issues.push('HOLDER_HAS_EXECUTION_IMPORT');
    if (!source.hasPublicFinalClass) issues.push('HOLDER_NOT_PUBLIC_FINAL_CLASS');
    if (fieldCount === null || fieldCount !== source.stringFieldDeclarationCount) {
      issues.push('HOLDER_FIELD_SHAPE_NOT_ALL_PUBLIC_STATIC_FINAL_STRING');
    }
    if (stringFieldCount !== source.stringFieldDeclarationCount) {
      issues.push('HOLDER_BYTECODE_STRING_FIELD_COUNT_MISMATCH');
    }
    if (constantValueCount !== stringFieldCount) {
      issues.push('HOLDER_FIELD_MISSING_CONSTANT_VALUE');
    }
    // A pure holder has only the compiler-generated constructor.  Any
    // <clinit> or helper method would make the text relocation executable.
    if (methodCount !== 1) issues.push('HOLDER_HAS_EXECUTION_METHOD');
    return {
      ...source,
      classFile,
      fieldCount,
      stringFieldCount,
      constantValueCount,
      methodCount,
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      issues,
    };
  });
  const failed = entries.filter(entry => entry.status !== 'PASS');
  return {
    status: failed.length === 0 && entries.length === holderPaths.length ? 'PASS' : 'FAIL',
    proofMode: 'PURE_COMPILE_TIME_STRING_CONSTANT_HOLDERS',
    holderCount: entries.length,
    fieldCount: entries.reduce((sum, entry) => sum + (entry.fieldCount || 0), 0),
    constantValueCount: entries.reduce((sum, entry) => sum + entry.constantValueCount, 0),
    methodCountByClass: [...new Set(entries.map(entry => entry.methodCount))].sort(),
    entries,
  };
}

function normalizeJavap(text, snapshotRoot) {
  const lines = text.replace(/\r\n?/g, '\n').replaceAll(snapshotRoot, '<SNAPSHOT_ROOT>').split('\n');
  const normalized = [];
  let skippingLineNumbers = false;
  let tableIndent = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    if (trimmed === 'LineNumberTable:') {
      skippingLineNumbers = true;
      tableIndent = indent;
      continue;
    }
    if (skippingLineNumbers) {
      if (trimmed === '' || indent > tableIndent) continue;
      skippingLineNumbers = false;
    }
    normalized.push(line);
  }
  return normalized
    .join('\n')
    .replace(/#\d+/g, '#')
    .replace(/^Last modified:.*$/gm, 'Last modified: <removed>')
    .trimEnd();
}

function splitClassSections(text, snapshotRoot) {
  const matches = [...text.matchAll(/^Classfile (.+)$/gm)];
  return matches.map((match, index) => {
    const end = matches[index + 1]?.index ?? text.length;
    const absolute = match[1].trim();
    return {
      classFile: relativeTo(snapshotRoot, absolute),
      raw: text.slice(match.index, end),
      normalized: normalizeJavap(text.slice(match.index, end), snapshotRoot),
    };
  });
}

function runLogged(stage, command, commandArgs, cwd) {
  const logPath = path.join(runRoot, 'logs', String(events.length + 1).padStart(2, '0') + '-' + stage + '.log');
  fs.mkdirSync(path.dirname(logPath), {recursive: true});
  const event = {
    stage,
    command: [command, ...commandArgs],
    cwd: relativeTo(repositoryRoot, cwd),
    startedAt: new Date().toISOString(),
    logPath: relativeTo(currentRoot, logPath),
    status: 'RUNNING',
  };
  events.push(event);
  writeJson(path.join(runRoot, 'run-manifest.json'), state);
  try {
    const output = execFileSync(command, commandArgs, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 300 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fs.writeFileSync(logPath, output);
    event.status = 'PASS';
    event.exitCode = 0;
    event.finishedAt = new Date().toISOString();
    writeJson(path.join(runRoot, 'run-manifest.json'), state);
    return output;
  } catch (error) {
    const output = String(error.stdout || '') + String(error.stderr || '');
    fs.writeFileSync(logPath, output);
    event.status = 'FAIL';
    event.exitCode = typeof error.status === 'number' ? error.status : null;
    event.error = error.message;
    event.finishedAt = new Date().toISOString();
    writeJson(path.join(runRoot, 'run-manifest.json'), state);
    throw error;
  }
}

function javapBatch(stage, root, files) {
  const outputPath = path.join(runRoot, stage + '.javap.txt');
  const sections = [];
  const batchSize = 48;
  const batches = [];
  fs.writeFileSync(outputPath, '');
  for (let start = 0; start < files.length; start += batchSize) {
    const batchFiles = files.slice(start, start + batchSize);
    const output = runLogged(
      stage + '-javap-' + String(batches.length + 1).padStart(2, '0'),
      'javap',
      ['-c', '-p', '-v', ...batchFiles],
      root,
    );
    fs.appendFileSync(outputPath, output + '\n');
    const batchSections = splitClassSections(output, root);
    sections.push(...batchSections);
    batches.push({
      ordinal: batches.length + 1,
      fileCount: batchFiles.length,
      firstFile: relativeTo(root, batchFiles[0]),
      lastFile: relativeTo(root, batchFiles[batchFiles.length - 1]),
      rawBytes: Buffer.byteLength(output),
      normalizedSha256: digest(batchSections.map(section => section.normalized).join('\n')),
    });
  }
  return {
    command: 'javap -c -p -v <common-class-files>',
    artifact: relativeTo(currentRoot, outputPath),
    rawOutputSha256: digest(fs.readFileSync(outputPath)),
    classCount: sections.length,
    sections,
    batches,
  };
}

function bytecodeMetadata(javap) {
  const sinkLedger = [];
  let methodCount = 0;
  let invokedynamicClassCount = 0;
  for (const section of javap.sections) {
    const methods = methodRecords(section);
    methodCount += methods.length;
    if (methods.some(method => method.instructions.some(instruction => instruction.code.startsWith('invokedynamic')))) {
      invokedynamicClassCount += 1;
    }
    for (const method of methods) {
      let invocationOrdinal = 0;
      for (const instruction of method.instructions) {
        const match = instruction.text.match(JDBC_SINK_PATTERN);
        if (!match) continue;
        sinkLedger.push({
          classFile: section.classFile,
          method: method.signature,
          sinkKind: match[1],
          invocationOrdinal,
          instruction: instruction.text,
        });
        invocationOrdinal += 1;
      }
    }
  }
  sinkLedger.sort((left, right) =>
    left.classFile.localeCompare(right.classFile) ||
    left.method.localeCompare(right.method) ||
    left.invocationOrdinal - right.invocationOrdinal,
  );
  return {methodCount, invokedynamicClassCount, sinkLedger};
}

function normalizeMethodSignature(signature) {
  return signature.replace(/\s+/g, ' ').trim();
}

function normalizeInstructionText(raw, offsetToOrdinal) {
  const commentIndex = raw.indexOf('//');
  const rawCode = commentIndex >= 0 ? raw.slice(0, commentIndex) : raw;
  const rawComment = commentIndex >= 0 ? raw.slice(commentIndex).trim() : '';
  let code = rawCode.replace(/\s+/g, ' ').trim().replace(/\bldc_w\b/g, 'ldc').replace(/#\d+/g, '#');
  const branch = code.match(/^(if\w+|goto(?:_w)?|jsr(?:_w)?)\s+(-?\d+)(.*)$/);
  if (branch) {
    const target = Number(branch[2]);
    code = `${branch[1]} @${offsetToOrdinal.get(target) ?? `missing:${target}`}${branch[3]}`;
  }
  const comment = rawComment.replace(/#\d+/g, '#');
  return comment ? `${code} ${comment}` : code;
}

function methodCode(block) {
  const lines = block.split('\n');
  const codeIndex = lines.findIndex(line => line.trim() === 'Code:');
  if (codeIndex < 0) return {header: '', instructions: [], exceptionTable: []};
  const codeLines = lines.slice(codeIndex + 1);
  const candidates = codeLines
    .map((line, index) => {
      const match = line.match(/^(\s+)(\d+):\s+(.*)$/);
      return match
        ? {
            lineIndex: index,
            colonColumn: match[1].length + match[2].length,
            offset: Number(match[2]),
            raw: match[3],
          }
        : null;
    })
    .filter(Boolean);
  if (candidates.length === 0) return {header: '', instructions: [], exceptionTable: []};
  // javap right-aligns bytecode offsets, so the colon column changes when an
  // offset grows from one to two or three digits.  Using that column as the
  // instruction boundary silently dropped most instructions (and therefore
  // caller/sink edges).  Switch labels are the only numeric `offset:` lines
  // whose payload starts with another numeric target; real JVM opcodes start
  // with an alphabetic mnemonic.  Keep every real opcode regardless of its
  // offset width and exclude only switch-label rows.
  const topLevel = candidates.filter(candidate => !/^\s*-?\d+\b/.test(candidate.raw));
  const offsetToOrdinal = new Map(topLevel.map((candidate, ordinal) => [candidate.offset, ordinal]));
  const instructions = topLevel.map((candidate, ordinal) => {
    const nextLineIndex = topLevel[ordinal + 1]?.lineIndex ?? codeLines.length;
    const text = normalizeInstructionText(candidate.raw, offsetToOrdinal);
    if (!/^(tableswitch|lookupswitch)\b/.test(text)) {
      // The bytecode operand is a constant-pool index, not the bootstrap
      // method index.  javap exposes the latter in the trailing
      // `InvokeDynamic #<bootstrap>:...` comment.
      const invokedynamic = candidate.raw.match(/\/\/ InvokeDynamic #(\d+):/);
      return {
        ordinal,
        offset: candidate.offset,
        code: text.split(' //')[0],
        text,
        invokedynamicBootstrapIndex: invokedynamic ? Number(invokedynamic[1]) : null,
      };
    }
    const cases = [];
    for (const line of codeLines.slice(candidate.lineIndex + 1, nextLineIndex)) {
      const match = line.match(/^\s*(default|-?\d+):\s+(-?\d+)\s*$/);
      if (!match) continue;
      const target = Number(match[2]);
      cases.push(`${match[1]}=@${offsetToOrdinal.get(target) ?? `missing:${target}`}`);
    }
    const switchText = `${text} ${cases.join(',')}`;
    return {
      ordinal,
      offset: candidate.offset,
      code: switchText.split(' //')[0],
      text: switchText,
      invokedynamicBootstrapIndex: null,
    };
  });
  const header = codeLines.find(line => /^\s*stack=/.test(line))?.trim() || '';
  const exceptionTable = [];
  const exceptionIndex = codeLines.findIndex(line => line.trim() === 'Exception table:');
  if (exceptionIndex >= 0) {
    for (const line of codeLines.slice(exceptionIndex + 1)) {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) {
        if (line.trim() && !/^\s+(from|to|target|type)/.test(line)) break;
        continue;
      }
      exceptionTable.push({
        from: offsetToOrdinal.get(Number(match[1])) ?? `missing:${match[1]}`,
        to: offsetToOrdinal.get(Number(match[2])) ?? `missing:${match[2]}`,
        target: offsetToOrdinal.get(Number(match[3])) ?? `missing:${match[3]}`,
        type: match[4].trim().replace(/#\d+/g, '#'),
      });
    }
  }
  return {header, instructions, exceptionTable};
}

function methodRecords(section) {
  const declarations = [
    ...section.raw.matchAll(/^  (?=[^\n]*\([^\n]*\);$)([^\n]+)$/gm),
  ];
  return declarations.map((declaration, index) => {
    const end = declarations[index + 1]?.index ?? section.raw.length;
    const block = section.raw.slice(declaration.index, end);
    const code = methodCode(block);
    return {
      signature: normalizeMethodSignature(declaration[1]),
      header: code.header,
      instructions: code.instructions,
      exceptionTable: code.exceptionTable,
      semanticText: JSON.stringify({
        signature: normalizeMethodSignature(declaration[1]),
        header: code.header,
        instructions: code.instructions.map(instruction => instruction.text),
        exceptionTable: code.exceptionTable,
      }),
    };
  });
}

function bootstrapFingerprint(section) {
  if (!section?.raw) return '';
  const lines = section.raw.split('\n');
  const start = lines.findIndex(line => line.trim() === 'BootstrapMethods:');
  if (start < 0) return '';
  const selected = [lines[start].trim()];
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    selected.push(line.trim().replace(/#\d+/g, '#'));
  }
  return selected.join('\n');
}

function bootstrapInvocationTargets(section) {
  if (!section?.raw) return new Map();
  const lines = section.raw.split('\n');
  const start = lines.findIndex(line => line.trim() === 'BootstrapMethods:');
  if (start < 0) return new Map();
  const targets = new Map();
  let bootstrapIndex = null;
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    const entry = line.match(/^\s{2}(\d+):\s/);
    if (entry) bootstrapIndex = Number(entry[1]);
    const target = line.match(
      /REF_invoke(?:Static|Virtual|Interface|Special)\s+([\w/$]+)\.([^:(]+):(\([^)]*\).*)/,
    );
    if (!target || bootstrapIndex === null) continue;
    const className = target[1].replaceAll('/', '.');
    // The first method handle in a bootstrap entry is commonly the JDK
    // LambdaMetafactory/StringConcatFactory bootstrap itself.  Only retain
    // application-level handles, which are the actual lambda/method-reference
    // edges needed to connect an outer method to a JDBC sink helper.
    if (className.startsWith('java.lang.invoke.') || className.startsWith('java.lang.runtime.')) {
      continue;
    }
    targets.set(bootstrapIndex, {
      className,
      methodName: target[2],
      descriptor: target[3],
      edgeKind: 'INVOKEDYNAMIC_BOOTSTRAP_METHOD_HANDLE',
    });
  }
  return targets;
}

function interfaceImplementers(javap) {
  const implementers = new Map();
  for (const section of javap.sections) {
    const declaration = section.raw
      .split('\n')
      .find(line => /\b(?:class|interface)\s+[\w.$]+/.test(line));
    if (!declaration) continue;
    const classMatch = declaration.match(/\bclass\s+([\w.$]+)(?:\s+extends\s+[\w.$]+)?(?:\s+implements\s+(.+))?$/);
    if (!classMatch) continue;
    const className = classMatch[1];
    for (const interfaceName of (classMatch[2] || '').split(/,\s*/).map(value => value.trim()).filter(Boolean)) {
      const values = implementers.get(interfaceName) || [];
      values.push(className);
      implementers.set(interfaceName, values);
    }
  }
  for (const values of implementers.values()) values.sort();
  return implementers;
}

function methodLedger(javap) {
  return javap.sections.flatMap(section =>
    methodRecords(section).map(method => ({
      classFile: section.classFile,
      signature: method.signature,
      instructionCount: method.instructions.length,
      instructionSha256: digest(method.semanticText),
      exceptionTable: method.exceptionTable,
    })),
  );
}

function moduleNameFromClassFile(classFile) {
  return classFile.match(/\/modules\/([^/]+)\/build\/classes\/java\/main\//)?.[1] || 'UNKNOWN_MODULE';
}

function classNameFromClassFile(classFile) {
  const match = classFile.match(/\/build\/classes\/java\/main\/(.+)\.class$/);
  return match ? match[1].replaceAll('/', '.') : classFile;
}

function methodNameFromSignature(signature) {
  const declaration = signature.slice(0, signature.indexOf('(')).trim();
  return declaration.split(/\s+/).at(-1) || '<unknown>';
}

function invocationTarget(instruction, ownerClass) {
  const match = instruction.text.match(
    /\/\/ (?:InterfaceMethod|Method) ([\w/$]+)\.([^:(]+):(\([^)]*\).*)$/,
  );
  if (match) {
    return {
        className: match[1].replaceAll('/', '.'),
        methodName: match[2],
        descriptor: match[3],
    };
  }
  const localMatch = instruction.text.match(
    /\/\/ (?:InterfaceMethod|Method) ([^:(]+):(\([^)]*\).*)$/,
  );
  return localMatch
    ? {className: ownerClass, methodName: localMatch[1], descriptor: localMatch[2]}
    : null;
}

function stringLiteralInstructions(instructions) {
  return instructions.flatMap(instruction => {
    const match = instruction.text.match(/\/\/ String (.*)$/);
    return match
      ? [{instructionOrdinal: instruction.ordinal, value: match[1]}]
      : [];
  });
}

function branchMatrix(method) {
  return method.instructions.flatMap(instruction => {
    const code = instruction.code;
    if (/^(if\w+|goto(?:_w)?|jsr(?:_w)?)\b/.test(code)) {
      return [{instructionOrdinal: instruction.ordinal, shape: code}];
    }
    if (/^(tableswitch|lookupswitch)\b/.test(code)) {
      return [{instructionOrdinal: instruction.ordinal, shape: code}];
    }
    return [];
  });
}

function localSlotReferences(instructions) {
  return instructions.flatMap(instruction => {
    const references = [];
    for (const match of instruction.code.matchAll(
      /\b(aload|astore|iload|istore|lload|lstore|fload|fstore|dload|dstore)(?:_(\d+)|\s+(\d+))\b/g,
    )) {
      references.push({
        instructionOrdinal: instruction.ordinal,
        opcode: match[1],
        slot: Number(match[2] ?? match[3]),
      });
    }
    return references;
  });
}

function invocationIndex(javap) {
  const index = new Map();
  const implementers = interfaceImplementers(javap);
  for (const section of javap.sections) {
    const bootstrapTargets = bootstrapInvocationTargets(section);
    for (const method of methodRecords(section)) {
      for (const instruction of method.instructions) {
        const target =
          invocationTarget(instruction, classNameFromClassFile(section.classFile)) ||
          (instruction.invokedynamicBootstrapIndex === null
            ? null
            : bootstrapTargets.get(instruction.invokedynamicBootstrapIndex) || null);
        if (!target) continue;
        const targetKeys = [
          `${target.className}|${target.methodName}`,
          ...(implementers.get(target.className) || []).map(
            implementer => `${implementer}|${target.methodName}`,
          ),
        ];
        for (const key of [...new Set(targetKeys)]) {
          const callers = index.get(key) || [];
          callers.push({
            callerClass: classNameFromClassFile(section.classFile),
            callerClassFile: section.classFile,
            callerMethod: method.signature,
            callInstructionOrdinal: instruction.ordinal,
            targetDescriptor: target.descriptor,
            edgeKind: target.edgeKind || 'DIRECT_BYTECODE_METHOD_INVOCATION',
            callerMethodSemanticSha256: digest(method.semanticText),
            callerBranchMatrix: branchMatrix(method),
            callerPreCallInstructions: method.instructions
              .filter(candidate => candidate.ordinal < instruction.ordinal)
              .slice(-96)
              .map(candidate => ({ordinal: candidate.ordinal, code: candidate.code})),
            callerLocalSlotReferences: localSlotReferences(
              method.instructions
                .filter(candidate => candidate.ordinal < instruction.ordinal)
                .slice(-96),
            ),
          });
          index.set(key, callers);
        }
      }
    }
  }
  for (const callers of index.values()) {
    callers.sort((left, right) =>
      left.callerClassFile.localeCompare(right.callerClassFile) ||
      left.callerMethod.localeCompare(right.callerMethod) ||
      left.callInstructionOrdinal - right.callInstructionOrdinal,
    );
  }
  return index;
}

function executionPointLedger(javap) {
  const callersByTarget = invocationIndex(javap);
  const entries = [];
  for (const section of javap.sections) {
    for (const method of methodRecords(section)) {
      const sinks = method.instructions
        .map(instruction => ({instruction, match: instruction.text.match(JDBC_SINK_PATTERN)}))
        .filter(entry => entry.match);
      sinks.forEach((entry, invocationOrdinal) => {
        const sinkInstruction = entry.instruction;
        const previousSinkOrdinal = sinks[invocationOrdinal - 1]?.instruction.ordinal ?? -1;
        const preSinkInstructions = method.instructions.filter(
          instruction => instruction.ordinal > previousSinkOrdinal && instruction.ordinal < sinkInstruction.ordinal,
        );
        const resolvedStringLiterals = stringLiteralInstructions(preSinkInstructions);
        const constructionInstructions = preSinkInstructions.filter(instruction =>
          /\b(ldc|invokedynamic|invokevirtual|invokeinterface|invokestatic|new|dup|aastore|anewarray|getstatic|getfield|replace|append|toString)\b/.test(
            instruction.code,
          ),
        );
        const ownerClass = classNameFromClassFile(section.classFile);
        const methodFamily = methodNameFromSignature(method.signature);
        const logicalIdentity = [
          moduleNameFromClassFile(section.classFile),
          ownerClass,
          methodFamily,
          entry.match[1],
          String(invocationOrdinal),
        ].join('|');
        const executionPointId = `ep-${digest(logicalIdentity).slice(0, 20)}`;
        const branchShapes = branchMatrix(method);
        const branchCases = branchShapes.flatMap((branch, branchOrdinal) => {
          const targets = [...branch.shape.matchAll(/(?:default|-?\d+)=@[^,]+|@(?:\d+|missing:\d+)/g)].map(
            match => match[0],
          );
          const edges = targets.length ? targets : ['target'];
          return [
            `bc-${branchOrdinal}-fallthrough`,
            ...edges.map((edge, edgeOrdinal) => `bc-${branchOrdinal}-target-${edgeOrdinal}-${edge}`),
          ];
        });
        const branchCaseIds = branchCases.length ? branchCases : ['NO_BRANCH'];
        const callerKey = `${ownerClass}|${methodFamily}`;
        const callerEvidence = (callersByTarget.get(callerKey) || []).map(caller => ({
          ...caller,
          callerPreCallSemanticSha256: digest(JSON.stringify(caller.callerPreCallInstructions)),
        }));
        entries.push({
          stableKey: [
            moduleNameFromClassFile(section.classFile),
            ownerClass,
            methodFamily,
            executionPointId,
            entry.match[1],
            String(invocationOrdinal),
            branchCaseIds.join(','),
          ].join('|'),
          logicalKey: {
            module: moduleNameFromClassFile(section.classFile),
            ownerClass,
            methodFamily,
            executionPointId,
            sinkKind: entry.match[1],
            invocationOrdinal,
            branchCaseIds,
            idRules: 'no source line, relative path or temporary snapshot class name',
          },
          module: moduleNameFromClassFile(section.classFile),
          classFile: section.classFile,
          ownerClass,
          methodFamily,
          method: method.signature,
          sinkKind: entry.match[1],
          invocationOrdinal,
          sinkInstructionOrdinal: sinkInstruction.ordinal,
          sinkInstruction: sinkInstruction.text,
          branchMatrix: branchShapes,
          branchCases,
          effectiveSql: {
            proofMode: 'COMPILED_DATA_FLOW_EQUIVALENCE',
            resolvedStringLiterals,
            fragmentOrder: resolvedStringLiterals.map(literal => literal.instructionOrdinal),
            constructionInstructions: constructionInstructions.map(instruction => ({
              instructionOrdinal: instruction.ordinal,
              code: instruction.code,
            })),
            constructionSha256: digest(JSON.stringify(constructionInstructions.map(instruction => instruction.code))),
            sourceToSink: {
              sinkOwner: ownerClass,
              sinkMethod: method.signature,
              callerEvidence,
              status:
                resolvedStringLiterals.length > 0
                  ? 'DIRECT_PRE_SINK_STRING_SEQUENCE'
                  : callerEvidence.length > 0
                    ? 'CALLER_ARGUMENT_DATA_FLOW_RECORDED'
                    : 'UNRESOLVED_NO_CALLER_EVIDENCE',
            },
          },
          parameterExpression: {
            proofMode: 'PRE_SINK_BYTECODE_SEGMENT_EQUIVALENCE',
            instructionRange: {
              firstOrdinal: preSinkInstructions[0]?.ordinal ?? null,
              lastOrdinal: preSinkInstructions.at(-1)?.ordinal ?? null,
            },
            localSlotReferences: localSlotReferences(preSinkInstructions),
            segmentSha256: digest(JSON.stringify(preSinkInstructions.map(instruction => instruction.text))),
          },
          methodSemanticSha256: digest(method.semanticText),
        });
      });
    }
  }
  return entries.sort((left, right) => left.stableKey.localeCompare(right.stableKey));
}

function compareExecutionPointLedgers(before, after) {
  const beforeByKey = new Map(before.map(entry => [entry.stableKey, entry]));
  const afterByKey = new Map(after.map(entry => [entry.stableKey, entry]));
  const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])].sort();
  const mismatches = [];
  for (const stableKey of keys) {
    const left = beforeByKey.get(stableKey);
    const right = afterByKey.get(stableKey);
    if (!left || !right) {
      mismatches.push({stableKey, beforePresent: Boolean(left), afterPresent: Boolean(right)});
      continue;
    }
    const comparable = value => ({
      stableKey: value.stableKey,
      logicalKey: value.logicalKey,
      module: value.module,
      classFile: value.classFile,
      ownerClass: value.ownerClass,
      methodFamily: value.methodFamily,
      method: value.method,
      sinkKind: value.sinkKind,
      invocationOrdinal: value.invocationOrdinal,
      sinkInstructionOrdinal: value.sinkInstructionOrdinal,
      sinkInstruction: value.sinkInstruction,
      branchMatrix: value.branchMatrix,
      branchCases: value.branchCases,
      effectiveSql: value.effectiveSql,
      parameterExpression: value.parameterExpression,
      methodSemanticSha256: value.methodSemanticSha256,
    });
    if (JSON.stringify(comparable(left)) !== JSON.stringify(comparable(right))) {
      mismatches.push({
        stableKey,
        beforeSha256: digest(JSON.stringify(comparable(left))),
        afterSha256: digest(JSON.stringify(comparable(right))),
      });
    }
  }
  return {
    status: mismatches.length === 0 && before.length === after.length ? 'PASS' : 'FAIL',
    beforeCount: before.length,
    afterCount: after.length,
    mismatchCount: mismatches.length,
    mismatches,
    stableKeyShape:
      'module|ownerClass|methodFamily|executionPointId|sinkKind|invocationOrdinal|branchCaseIds',
    branchCaseModel:
      'compiled-control-flow-edges; this proves before/after branch shape and does not claim runtime fixture coverage',
    proofLimit:
      'This is compiled instruction/data-flow equivalence; it is not runtime SQL capture and does not expose sensitive parameter values.',
  };
}

function normalizedClassIdentity(before, after) {
  const left = new Map(before.sections.map(section => [section.classFile, section.normalized]));
  const right = new Map(after.sections.map(section => [section.classFile, section.normalized]));
  const classFiles = [...new Set([...left.keys(), ...right.keys()])].sort();
  const mismatches = classFiles
    .filter(classFile => left.get(classFile) !== right.get(classFile))
    .map(classFile => ({
      classFile,
      beforeSha256: left.has(classFile) ? digest(left.get(classFile)) : null,
      afterSha256: right.has(classFile) ? digest(right.get(classFile)) : null,
    }));
  return {
    status: mismatches.length === 0 ? 'PASS' : 'FAIL',
    commonClassCount: classFiles.length,
    mismatchCount: mismatches.length,
    mismatches,
    rule: 'common normalized javap sections must be byte-for-byte identical after line-number/path normalization',
  };
}

function sourceDataFlowProof({
  changes,
  comparison,
  executionPointComparison,
  beforeJavap,
  afterJavap,
  beforeExecutionPoints,
  afterExecutionPoints,
  holderProof,
}) {
  const sourceBoundaryIssues = changes
    .filter(change => {
      if (change.kind === 'ADDED') return !isSqlHolderPath(change.path);
      // CP-A rewrites existing SQL holders in place; the holder proof below
      // validates that they remain pure compile-time String holders.  Existing
      // Java source may also change only at the call site to rename the
      // referenced holder fields.  Reject removals and unrelated change kinds,
      // but do not reject the very holder modifications this proof covers.
      return change.kind !== 'MODIFIED';
    })
    .map(change => ({path: change.path, kind: change.kind}));
  const classIdentity = normalizedClassIdentity(beforeJavap, afterJavap);
  const identityPass =
    sourceBoundaryIssues.length === 0 &&
    holderProof.status === 'PASS' &&
    comparison.methodInstructionMismatchCount === 0 &&
    comparison.methodSetMismatchCount === 0 &&
    comparison.bootstrapMismatchCount === 0 &&
    comparison.sinkLedgerEqual &&
    executionPointComparison.status === 'PASS';
  const beforeByKey = new Map(beforeExecutionPoints.map(point => [point.stableKey, point]));
  const pointClosures = afterExecutionPoints.map(point => {
    const before = beforeByKey.get(point.stableKey);
    const closed = identityPass && Boolean(before);
    return {
      stableKey: point.stableKey,
      module: point.module,
      ownerClass: point.ownerClass,
      methodFamily: point.methodFamily,
      method: point.method,
      sinkKind: point.sinkKind,
      branchCaseIds: point.logicalKey.branchCaseIds,
      beforeMethodSemanticSha256: before?.methodSemanticSha256 || null,
      afterMethodSemanticSha256: point.methodSemanticSha256,
      beforeParameterSegmentSha256: before?.parameterExpression.segmentSha256 || null,
      afterParameterSegmentSha256: point.parameterExpression.segmentSha256,
      callerEvidenceStatus: point.effectiveSql.sourceToSink.status,
      status: closed ? 'CLOSED_BY_STATIC_DATA_FLOW' : 'OPEN',
      proof:
        'B3 changed only pure compile-time String constants and references; common executable classes, methods, sinks, branches and parameter segments are identical before/after.',
    };
  });
  return {
    status: identityPass && pointClosures.every(point => point.status === 'CLOSED_BY_STATIC_DATA_FLOW') ? 'PASS' : 'FAIL',
    proofMode: 'COMPLETE_STATIC_DATA_FLOW_BY_PURE_CONSTANT_HOLDER_AND_COMPILED_IDENTITY',
    runtimeCaptureRequired: false,
    runtimeCaptureReason:
      'B3 is text-only: no executable method or transaction code changed; effective SQL and bind construction are proven by identical compiled executable classes plus pure compile-time String holder values. This proof mode is not valid for B4–B16 execution relocation.',
    sourceBoundary: {
      status: sourceBoundaryIssues.length === 0 ? 'PASS' : 'FAIL',
      rule: 'only added application/persistence/*Sql.java holders and modified existing Java source are in the B3 source set; no source removal or unrelated added source is allowed',
      issues: sourceBoundaryIssues,
    },
    classIdentity,
    classIdentityRole:
      'INFORMATIONAL_ONLY: holder relocation may change class-level constant-pool and metadata sections; executable method identity is the B3 gate.',
    holderProof: {
      status: holderProof.status,
      holderCount: holderProof.holderCount,
      fieldCount: holderProof.fieldCount,
      constantValueCount: holderProof.constantValueCount,
      methodCountByClass: holderProof.methodCountByClass,
    },
    executableIdentity: {
      commonClassCount: comparison.commonClassCount,
      methodInstructionMismatchCount: comparison.methodInstructionMismatchCount,
      methodSetMismatchCount: comparison.methodSetMismatchCount,
      bootstrapMismatchCount: comparison.bootstrapMismatchCount,
      sinkLedgerEqual: comparison.sinkLedgerEqual,
      executionPointComparison: executionPointComparison.status,
    },
    beforeExecutionPointCount: beforeExecutionPoints.length,
    afterExecutionPointCount: afterExecutionPoints.length,
    existingCallerIndexUnresolvedCount: pointClosures.filter(
      point => point.callerEvidenceStatus === 'UNRESOLVED_NO_CALLER_EVIDENCE',
    ).length,
    pointClosures,
    limits: [
      'The callerEvidenceStatus is retained as an information field; absence of a caller edge is not treated as a proof failure when the owning method and all executable data flow are byte-identical.',
      'No sensitive bind values are recorded.',
      'This closes B3 text-only equivalence only; B4–B16 must use before/after runtime capture or a separately complete proof after execution moves.',
    ],
  };
}

function compare(before, after) {
  const left = new Map(before.sections.map(section => [section.classFile, section]));
  const right = new Map(after.sections.map(section => [section.classFile, section]));
  const classFiles = [...new Set([...left.keys(), ...right.keys()])].sort();
  const methodMismatches = [];
  const methodSetMismatches = [];
  const classesWithMethodMismatch = new Set();
  let beforeMethodCount = 0;
  let afterMethodCount = 0;
  for (const classFile of classFiles) {
    const beforeMethods = left.has(classFile) ? methodRecords(left.get(classFile)) : [];
    const afterMethods = right.has(classFile) ? methodRecords(right.get(classFile)) : [];
    beforeMethodCount += beforeMethods.length;
    afterMethodCount += afterMethods.length;
    const beforeBySignature = new Map(beforeMethods.map(method => [method.signature, method]));
    const afterBySignature = new Map(afterMethods.map(method => [method.signature, method]));
    const signatures = [...new Set([...beforeBySignature.keys(), ...afterBySignature.keys()])].sort();
    for (const signature of signatures) {
      const beforeMethod = beforeBySignature.get(signature);
      const afterMethod = afterBySignature.get(signature);
      if (!beforeMethod || !afterMethod) {
        methodSetMismatches.push({classFile, signature, beforePresent: Boolean(beforeMethod), afterPresent: Boolean(afterMethod)});
        classesWithMethodMismatch.add(classFile);
        continue;
      }
      if (beforeMethod.semanticText !== afterMethod.semanticText) {
        methodMismatches.push({
          classFile,
          signature,
          beforeSha256: digest(beforeMethod.semanticText),
          afterSha256: digest(afterMethod.semanticText),
        });
        classesWithMethodMismatch.add(classFile);
      }
    }
  }
  const beforeMeta = bytecodeMetadata(before);
  const afterMeta = bytecodeMetadata(after);
  const beforeSinks = JSON.stringify(beforeMeta.sinkLedger);
  const afterSinks = JSON.stringify(afterMeta.sinkLedger);
  const bootstrapMismatches = classFiles.filter(classFile =>
    bootstrapFingerprint(left.get(classFile) || {}) !== bootstrapFingerprint(right.get(classFile) || ''),
  );
  return {
    status:
      methodMismatches.length === 0 &&
      methodSetMismatches.length === 0 &&
      bootstrapMismatches.length === 0 &&
      before.classCount === after.classCount &&
      beforeMethodCount === afterMethodCount &&
      beforeSinks === afterSinks
        ? 'PASS'
        : 'FAIL',
    commonClassCount: classFiles.length,
    semanticClassMismatchCount: classesWithMethodMismatch.size,
    methodInstructionMismatchCount: methodMismatches.length,
    methodSetMismatchCount: methodSetMismatches.length,
    methodMismatches,
    methodSetMismatches,
    beforeMethodCount,
    afterMethodCount,
    methodCountEqual: beforeMethodCount === afterMethodCount,
    beforeInvokedynamicClassCount: beforeMeta.invokedynamicClassCount,
    afterInvokedynamicClassCount: afterMeta.invokedynamicClassCount,
    bootstrapMismatchCount: bootstrapMismatches.length,
    bootstrapMismatches,
    beforeSinkInvocationCount: beforeMeta.sinkLedger.length,
    afterSinkInvocationCount: afterMeta.sinkLedger.length,
    sinkLedgerEqual: beforeSinks === afterSinks,
    sinkLedgerSha256Before: digest(beforeSinks),
    sinkLedgerSha256After: digest(afterSinks),
  };
}

async function main() {
  if (!fs.existsSync(baselineRoot)) throw new Error('BASELINE_NOT_FOUND:' + baselineRoot);
  if (!fs.existsSync(currentRoot)) throw new Error('CURRENT_NOT_FOUND:' + currentRoot);
  const beforeRoot = path.join(temporaryRoot, 'before');
  const afterRoot = path.join(temporaryRoot, 'after');
  copySnapshot(baselineRoot, beforeRoot);
  copySnapshot(currentRoot, afterRoot);
  const beforeSource = sourceManifest(beforeRoot);
  const afterSource = sourceManifest(afterRoot);
  const changes = sourceDiff(beforeSource, afterSource);
  const moduleNames = changedModuleNames(changes);
  const beforeHolders = holders(beforeRoot).map(filePath => relativeTo(beforeRoot, filePath));
  const afterHolders = holders(afterRoot).map(filePath => relativeTo(afterRoot, filePath));
  writeJson(path.join(runRoot, 'source-before.json'), {...beforeSource, holderCount: beforeHolders.length, holderFiles: beforeHolders});
  writeJson(path.join(runRoot, 'source-after.json'), {...afterSource, holderCount: afterHolders.length, holderFiles: afterHolders});
  writeJson(path.join(runRoot, 'source-diff.json'), changes);
  state.snapshot = {
    baselineRoot,
    currentRoot,
    baselineHolderCount: beforeHolders.length,
    currentHolderCount: afterHolders.length,
    baselineSourceFileCount: beforeSource.fileCount,
    currentSourceFileCount: afterSource.fileCount,
    changedSourceFileCount: changes.length,
    changedNonHolderSourceFileCount: changes.filter(change => !change.path.includes('/application/persistence/')).length,
    addedSqlHolderSourceFileCount: changes.filter(
      change => change.kind === 'ADDED' && change.path.includes('/application/persistence/') && change.path.endsWith('Sql.java'),
    ).length,
  };
  writeJson(path.join(runRoot, 'run-manifest.json'), state);

  const beforeGradle = resolveGradleCommand({root: beforeRoot}).command;
  const afterGradle = resolveGradleCommand({root: afterRoot}).command;
  runLogged(
    'compile-before',
    beforeGradle,
    ['clean', ':apps:backend:catering-business-server:compileJava', '--no-daemon'],
    beforeRoot,
  );
  runLogged(
    'compile-after',
    afterGradle,
    ['clean', ':apps:backend:catering-business-server:compileJava', '--no-daemon'],
    afterRoot,
  );
  const beforeClasses = classManifest(beforeRoot, moduleNames);
  const afterClasses = classManifest(afterRoot, moduleNames);
  writeJson(path.join(runRoot, 'class-before.json'), beforeClasses);
  writeJson(path.join(runRoot, 'class-after.json'), afterClasses);
  const beforeClassPaths = new Set(beforeClasses.entries.map(entry => entry.path));
  const commonClassPaths = afterClasses.entries
    .map(entry => entry.path)
    .filter(relative => beforeClassPaths.has(relative))
    .sort();
  const beforeJavap = javapBatch(
    'before',
    beforeRoot,
    commonClassPaths.map(relative => path.join(beforeRoot, relative)),
  );
  const afterJavap = javapBatch(
    'after',
    afterRoot,
    commonClassPaths.map(relative => path.join(afterRoot, relative)),
  );
  const afterHolderJavap = javapBatch(
    'after-holders',
    afterRoot,
    afterHolders.map(relative =>
      path.join(
        afterRoot,
        relative.replace('/src/main/java/', '/build/classes/java/main/').replace(/\.java$/, '.class'),
      ),
    ),
  );
  const holderProof = holderBytecodeProof(afterRoot, afterHolders, afterHolderJavap);
  const comparison = compare(beforeJavap, afterJavap);
  const beforeMeta = bytecodeMetadata(beforeJavap);
  const afterMeta = bytecodeMetadata(afterJavap);
  const beforeExecutionPoints = executionPointLedger(beforeJavap);
  const afterExecutionPoints = executionPointLedger(afterJavap);
  const executionPointComparison = compareExecutionPointLedgers(
    beforeExecutionPoints,
    afterExecutionPoints,
  );
  if (executionPointComparison.status !== 'PASS') comparison.status = 'FAIL';
  comparison.executionPointComparison = executionPointComparison;
  const sourceDataFlow = sourceDataFlowProof({
    changes,
    comparison,
    executionPointComparison,
    beforeJavap,
    afterJavap,
    beforeExecutionPoints,
    afterExecutionPoints,
    holderProof,
  });
  if (sourceDataFlow.status !== 'PASS') comparison.status = 'FAIL';
  writeJson(path.join(runRoot, 'sink-ledger-before.json'), beforeMeta.sinkLedger);
  writeJson(path.join(runRoot, 'sink-ledger-after.json'), afterMeta.sinkLedger);
  writeJson(path.join(runRoot, 'method-ledger-before.json'), methodLedger(beforeJavap));
  writeJson(path.join(runRoot, 'method-ledger-after.json'), methodLedger(afterJavap));
  writeJson(path.join(runRoot, 'execution-point-ledger-before.json'), beforeExecutionPoints);
  writeJson(path.join(runRoot, 'execution-point-ledger-after.json'), afterExecutionPoints);
  writeJson(path.join(runRoot, 'execution-point-comparison.json'), executionPointComparison);
  writeJson(path.join(runRoot, 'holder-proof.json'), holderProof);
  writeJson(path.join(runRoot, 'source-data-flow-proof.json'), sourceDataFlow);
  writeJson(
    path.join(runRoot, 'javap-before.json'),
    {
      ...beforeJavap,
      sections: beforeJavap.sections.map(section => ({
        classFile: section.classFile,
        normalizedSha256: digest(section.normalized),
        normalizedBytes: Buffer.byteLength(section.normalized),
      })),
    },
  );
  writeJson(
    path.join(runRoot, 'javap-after.json'),
    {
      ...afterJavap,
      sections: afterJavap.sections.map(section => ({
        classFile: section.classFile,
        normalizedSha256: digest(section.normalized),
        normalizedBytes: Buffer.byteLength(section.normalized),
      })),
    },
  );
  const proof = {
    schemaVersion: 1,
    kind: 'backend-sql-relocation-equivalence-proof',
    runId,
    generatedAt: new Date().toISOString(),
    baseline: {
      root: baselineRoot,
      sourceManifest: relativeTo(currentRoot, path.join(runRoot, 'source-before.json')),
      classManifest: relativeTo(currentRoot, path.join(runRoot, 'class-before.json')),
      javapArtifact: relativeTo(currentRoot, path.join(runRoot, 'before.javap.txt')),
    },
    current: {
      root: currentRoot,
      sourceManifest: relativeTo(currentRoot, path.join(runRoot, 'source-after.json')),
      classManifest: relativeTo(currentRoot, path.join(runRoot, 'class-after.json')),
      javapArtifact: relativeTo(currentRoot, path.join(runRoot, 'after.javap.txt')),
    },
    sourceDiff: {
      artifact: relativeTo(currentRoot, path.join(runRoot, 'source-diff.json')),
      totalChangedFiles: changes.length,
      nonHolderChangedFiles: changes.filter(change => !change.path.includes('/application/persistence/')).length,
      addedSqlHolders: changes.filter(
        change => change.kind === 'ADDED' && change.path.includes('/application/persistence/') && change.path.endsWith('Sql.java'),
      ).length,
    },
    classInputs: {
      modules: moduleNames,
      baselineClassCount: beforeClasses.fileCount,
      currentClassCount: afterClasses.fileCount,
      commonClassCount: commonClassPaths.length,
      order: 'sorted relative class path',
    },
    before: {
      classCount: beforeJavap.classCount,
      methodCount: beforeMeta.methodCount,
      invokedynamicClassCount: beforeMeta.invokedynamicClassCount,
      sinkInvocationCount: beforeMeta.sinkLedger.length,
    },
    after: {
      classCount: afterJavap.classCount,
      methodCount: afterMeta.methodCount,
      invokedynamicClassCount: afterMeta.invokedynamicClassCount,
      sinkInvocationCount: afterMeta.sinkLedger.length,
    },
    comparison,
    artifacts: {
      sinkLedgerBefore: relativeTo(currentRoot, path.join(runRoot, 'sink-ledger-before.json')),
      sinkLedgerAfter: relativeTo(currentRoot, path.join(runRoot, 'sink-ledger-after.json')),
      methodLedgerBefore: relativeTo(currentRoot, path.join(runRoot, 'method-ledger-before.json')),
      methodLedgerAfter: relativeTo(currentRoot, path.join(runRoot, 'method-ledger-after.json')),
      executionPointLedgerBefore: relativeTo(
        currentRoot,
        path.join(runRoot, 'execution-point-ledger-before.json'),
      ),
      executionPointLedgerAfter: relativeTo(
        currentRoot,
        path.join(runRoot, 'execution-point-ledger-after.json'),
      ),
      executionPointComparison: relativeTo(
        currentRoot,
        path.join(runRoot, 'execution-point-comparison.json'),
      ),
      holderProof: relativeTo(currentRoot, path.join(runRoot, 'holder-proof.json')),
      sourceDataFlowProof: relativeTo(currentRoot, path.join(runRoot, 'source-data-flow-proof.json')),
      javapBefore: relativeTo(currentRoot, path.join(runRoot, 'javap-before.json')),
      javapAfter: relativeTo(currentRoot, path.join(runRoot, 'javap-after.json')),
    },
    sourceDataFlow,
    status: comparison.status,
  };
  writeJson(path.join(runRoot, 'comparison.json'), proof);
  for (const name of [
    'source-before.json',
    'source-after.json',
    'source-diff.json',
    'class-before.json',
    'class-after.json',
    'javap-before.json',
    'javap-after.json',
    'sink-ledger-before.json',
    'sink-ledger-after.json',
    'method-ledger-before.json',
    'method-ledger-after.json',
    'execution-point-ledger-before.json',
    'execution-point-ledger-after.json',
    'execution-point-comparison.json',
    'holder-proof.json',
    'source-data-flow-proof.json',
    'comparison.json',
  ]) {
    fs.copyFileSync(path.join(runRoot, name), path.join(evidenceRoot, name));
  }
  state.status = comparison.status;
  state.result = {
    proof: relativeTo(currentRoot, path.join(runRoot, 'comparison.json')),
    commonClassCount: comparison.commonClassCount,
    methodInstructionMismatchCount: comparison.methodInstructionMismatchCount,
    methodSetMismatchCount: comparison.methodSetMismatchCount,
    bootstrapMismatchCount: comparison.bootstrapMismatchCount,
    sinkLedgerEqual: comparison.sinkLedgerEqual,
    executionPointComparison: executionPointComparison.status,
    executionPointCount: executionPointComparison.beforeCount,
  };
  process.stdout.write(
    [
      'BACKEND_SQL_RELOCATION_EQUIVALENCE=' + comparison.status,
      'RUN_ID=' + runId,
      'COMMON_CLASSES=' + comparison.commonClassCount,
      'METHOD_INSTRUCTION_MISMATCHES=' + comparison.methodInstructionMismatchCount,
      'METHOD_SET_MISMATCHES=' + comparison.methodSetMismatchCount,
      'BOOTSTRAP_MISMATCHES=' + comparison.bootstrapMismatchCount,
      'SINK_LEDGER_EQUAL=' + comparison.sinkLedgerEqual,
      'EXECUTION_POINT_COMPARISON=' + executionPointComparison.status,
      'EXECUTION_POINTS=' + executionPointComparison.beforeCount,
      'PROOF=' + relativeTo(currentRoot, path.join(runRoot, 'comparison.json')),
      '',
    ].join('\n'),
  );
  if (comparison.status !== 'PASS') process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  state.status = 'FAIL';
  state.error = error instanceof Error ? error.message : String(error);
  process.stderr.write(state.error + '\n');
  process.exitCode = 1;
} finally {
  try {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
    state.cleanupStatus = 'PASS';
  } catch (error) {
    state.cleanupStatus = 'FAIL';
    state.cleanupError = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  }
  state.finishedAt = new Date().toISOString();
  writeJson(path.join(runRoot, 'run-manifest.json'), state);
  writeJson(path.join(evidenceRoot, 'latest-run-manifest.json'), state);
}
