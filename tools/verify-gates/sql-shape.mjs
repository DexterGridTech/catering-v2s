const IDENTIFIER = '[A-Za-z_$][A-Za-z0-9_$]*';

function isEscaped(source, index) {
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function decodeJavaString(raw) {
  return raw
    .replace(/\\\r?\n[ \t]*/g, '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\(["'])/g, '$1');
}

function scanJavaStringLiterals(source) {
  const literals = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (source.startsWith('"""', index)) {
      const start = index;
      index += 3;
      let raw = '';
      while (index < source.length) {
        if (source.startsWith('"""', index) && !isEscaped(source, index)) {
          literals.push({start, end: index + 3, value: decodeJavaString(raw)});
          index += 3;
          break;
        }
        raw += source[index];
        index += 1;
      }
      continue;
    }
    if (source[index] !== '"') {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    let raw = '';
    while (index < source.length) {
      const character = source[index];
      if (character === '"' && !isEscaped(source, index)) {
        literals.push({start, end: index + 1, value: decodeJavaString(raw)});
        index += 1;
        break;
      }
      raw += character;
      index += 1;
    }
  }
  return literals;
}

function maskJavaComments(source) {
  const chars = [...source];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      const end = newline === -1 ? source.length : newline;
      for (let cursor = index; cursor < end; cursor += 1) chars[cursor] = ' ';
      index = end;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const endMarker = source.indexOf('*/', index + 2);
      const end = endMarker === -1 ? source.length : endMarker + 2;
      for (let cursor = index; cursor < end; cursor += 1) {
        if (chars[cursor] !== '\n' && chars[cursor] !== '\r') chars[cursor] = ' ';
      }
      index = end;
      continue;
    }
    if (source.startsWith('"""', index)) {
      index += 3;
      while (index < source.length && !(source.startsWith('"""', index) && !isEscaped(source, index))) index += 1;
      index += source.startsWith('"""', index) ? 3 : 0;
      continue;
    }
    if (source[index] === '"') {
      index += 1;
      while (index < source.length && !(source[index] === '"' && !isEscaped(source, index))) index += 1;
      index += source[index] === '"' ? 1 : 0;
      continue;
    }
    index += 1;
  }
  return chars.join('');
}

function splitTopLevelPlus(expression) {
  const pieces = [];
  let start = 0;
  let index = 0;
  let quote = null;
  let depth = 0;
  while (index < expression.length) {
    if (quote === 'text') {
      if (expression.startsWith('"""', index) && !isEscaped(expression, index)) {
        quote = null;
        index += 3;
      } else index += 1;
      continue;
    }
    if (quote === 'string') {
      if (expression[index] === '"' && !isEscaped(expression, index)) quote = null;
      index += 1;
      continue;
    }
    if (expression.startsWith('"""', index)) {
      quote = 'text';
      index += 3;
      continue;
    }
    if (expression[index] === '"') {
      quote = 'string';
      index += 1;
      continue;
    }
    if (expression[index] === '(') depth += 1;
    if (expression[index] === ')') depth -= 1;
    if (expression[index] === '+' && depth === 0) {
      pieces.push(expression.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }
  pieces.push(expression.slice(start));
  return pieces;
}

function unwrapParentheses(value) {
  let current = value.trim();
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let balanced = true;
    for (let index = 0; index < current.length; index += 1) {
      if (current[index] === '(') depth += 1;
      if (current[index] === ')') depth -= 1;
      if (depth === 0 && index !== current.length - 1) {
        balanced = false;
        break;
      }
    }
    if (!balanced) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

function resolveConstantExpression(expression, constants) {
  const pieces = splitTopLevelPlus(expression).map(unwrapParentheses);
  if (pieces.some(piece => piece.length === 0)) return undefined;
  const values = [];
  for (const piece of pieces) {
    const literals = scanJavaStringLiterals(piece);
    if (literals.length === 1 && piece.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"/g, '').trim() === '') {
      values.push(literals[0].value);
      continue;
    }
    const reference = piece.match(new RegExp(`^${IDENTIFIER}$`));
    if (reference && constants.has(reference[0])) {
      values.push(constants.get(reference[0]));
      continue;
    }
    return undefined;
  }
  return values.join('');
}

function collectConstantExpressions(source, literals) {
  const masked = maskJavaComments(source);
  const declarations = [];
  const declarationPattern = /\bstatic\s+final\s+String\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/g;
  for (const match of masked.matchAll(declarationPattern)) {
    const expressionStart = match.index + match[0].length;
    let expressionEnd = expressionStart;
    let quote = null;
    while (expressionEnd < masked.length) {
      const character = masked[expressionEnd];
      if (quote === 'text') {
        if (masked.startsWith('"""', expressionEnd) && !isEscaped(masked, expressionEnd)) {
          quote = null;
          expressionEnd += 3;
        } else expressionEnd += 1;
        continue;
      }
      if (quote === 'string') {
        if (character === '"' && !isEscaped(masked, expressionEnd)) quote = null;
        expressionEnd += 1;
        continue;
      }
      if (masked.startsWith('"""', expressionEnd)) {
        quote = 'text';
        expressionEnd += 3;
        continue;
      }
      if (character === '"') {
        quote = 'string';
        expressionEnd += 1;
        continue;
      }
      if (character === ';') break;
      expressionEnd += 1;
    }
    declarations.push({name: match[1], expression: source.slice(expressionStart, expressionEnd), start: match.index});
  }
  const constants = new Map();
  for (let pass = 0; pass < declarations.length + 1; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      const value = resolveConstantExpression(declaration.expression, constants);
      if (value !== undefined && constants.get(declaration.name) !== value) {
        constants.set(declaration.name, value);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return declarations
    .filter(declaration => constants.has(declaration.name))
    .map(declaration => ({start: declaration.start, value: constants.get(declaration.name)}));
}

function collectAdjacentLiteralValues(source, literals) {
  const values = [];
  for (let index = 0; index < literals.length; index += 1) {
    const chain = [literals[index]];
    let cursor = index;
    while (cursor < literals.length - 1) {
      const between = source.slice(literals[cursor].end, literals[cursor + 1].start);
      if (!/^\s*\+\s*$/.test(between)) break;
      chain.push(literals[cursor + 1]);
      cursor += 1;
    }
    if (chain.length > 1) {
      values.push({start: chain[0].start, value: chain.map(literal => literal.value).join('')});
      index = cursor;
    } else {
      values.push({start: literals[index].start, value: literals[index].value});
    }
  }
  return values;
}

function cteNames(sql) {
  const names = new Set();
  const pattern = new RegExp(`(?:\\bWITH\\s+(?:RECURSIVE\\s+)?|,)\\s*(${IDENTIFIER})\\s+AS\\s*(?:MATERIALIZED\\s*)?\\(`, 'gi');
  for (const match of sql.matchAll(pattern)) names.add(match[1].toLowerCase());
  return names;
}

function sqlParenthesisStackAt(sql, offset) {
  const stack = [];
  let index = 0;
  while (index < offset) {
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? offset : Math.min(newline + 1, offset);
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? offset : Math.min(end + 2, offset);
      continue;
    }
    if (sql[index] === "'" || sql[index] === '"') {
      index = Math.min(skipSqlQuoted(sql, index), offset);
      continue;
    }
    if (sql[index] === '(') stack.push(index);
    else if (sql[index] === ')') stack.pop();
    index += 1;
  }
  return stack;
}

function sqlStatementEnd(sql, offset) {
  let index = offset;
  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[index] === "'" || sql[index] === '"') {
      index = skipSqlQuoted(sql, index);
      continue;
    }
    if (sql[index] === ';') return index;
    index += 1;
  }
  return sql.length;
}

function sqlScopeEnd(sql, offset) {
  const stack = sqlParenthesisStackAt(sql, offset);
  if (!stack.length) return sqlStatementEnd(sql, offset);
  const open = stack[stack.length - 1];
  let depth = 1;
  let index = open + 1;
  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[index] === "'" || sql[index] === '"') {
      index = skipSqlQuoted(sql, index);
      continue;
    }
    if (sql[index] === '(') depth += 1;
    if (sql[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return sql.length;
}

function relationIsAllowed(relation, names) {
  if (relation === '(') return true;
  const normalized = relation.replace(/\s+/g, '').toLowerCase();
  return !normalized.includes('.') && names.has(normalized);
}

function sqlKeywordAt(sql, offset, keyword) {
  const before = offset === 0 ? '' : sql[offset - 1];
  const after = sql[offset + keyword.length] ?? '';
  return (
    sql.slice(offset, offset + keyword.length).toUpperCase() === keyword &&
    !/[A-Za-z0-9_$]/.test(before) &&
    !/[A-Za-z0-9_$]/.test(after)
  );
}

function skipSqlTrivia(sql, offset) {
  let index = offset;
  while (index < sql.length) {
    if (/\s/.test(sql[index])) {
      index += 1;
      continue;
    }
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    break;
  }
  return index;
}

function skipSqlQuoted(sql, offset) {
  const quote = sql[offset];
  let index = offset + 1;
  while (index < sql.length) {
    if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 2;
        continue;
      }
      if (!isEscaped(sql, index)) return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function selectKeywordPositions(sql) {
  const positions = [];
  let index = 0;
  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[index] === "'" || sql[index] === '"') {
      index = skipSqlQuoted(sql, index);
      continue;
    }
    if (sqlKeywordAt(sql, index, 'SELECT')) positions.push(index);
    index += 1;
  }
  return positions;
}

function topLevelKeywordPosition(sql, offset, keyword) {
  let index = offset;
  let depth = 0;
  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[index] === "'" || sql[index] === '"') {
      index = skipSqlQuoted(sql, index);
      continue;
    }
    if (sql[index] === '(') {
      depth += 1;
      index += 1;
      continue;
    }
    if (sql[index] === ')') {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    if (depth === 0 && sqlKeywordAt(sql, index, keyword)) return index;
    index += 1;
  }
  return -1;
}

function splitTopLevelSqlCommas(expression) {
  const pieces = [];
  let start = 0;
  let index = 0;
  let depth = 0;
  while (index < expression.length) {
    if (expression.startsWith('--', index)) {
      const newline = expression.indexOf('\n', index + 2);
      index = newline === -1 ? expression.length : newline + 1;
      continue;
    }
    if (expression.startsWith('/*', index)) {
      const end = expression.indexOf('*/', index + 2);
      index = end === -1 ? expression.length : end + 2;
      continue;
    }
    if (expression[index] === "'" || expression[index] === '"') {
      index = skipSqlQuoted(expression, index);
      continue;
    }
    if (expression[index] === '(') depth += 1;
    if (expression[index] === ')') depth = Math.max(0, depth - 1);
    if (expression[index] === ',' && depth === 0) {
      pieces.push(expression.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }
  pieces.push(expression.slice(start));
  return pieces;
}

function removeSqlTrivia(value) {
  return value
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
}

function removeBalancedPrefix(value, prefixPattern) {
  const match = value.match(prefixPattern);
  if (!match) return value;
  let index = skipSqlTrivia(value, match[0].length);
  if (value[index] !== '(') return value;
  let depth = 0;
  while (index < value.length) {
    if (value[index] === "'" || value[index] === '"') {
      index = skipSqlQuoted(value, index);
      continue;
    }
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') {
      depth -= 1;
      if (depth === 0) return value.slice(index + 1).trim();
    }
    index += 1;
  }
  return value;
}

function wildcardProjection(projection) {
  let normalized = removeSqlTrivia(projection);
  normalized = normalized.replace(/^DISTINCT\b\s*/i, '');
  normalized = removeBalancedPrefix(normalized, /^ON\b\s*/i);
  normalized = normalized.replace(/^ALL\b\s*/i, '');
  for (const piece of splitTopLevelSqlCommas(normalized)) {
    const candidate = removeSqlTrivia(piece)
      .replace(/\s+AS\s+[A-Za-z_$][A-Za-z0-9_$]*\s*$/i, '')
      .trim();
    const match = candidate.match(new RegExp('^(' + IDENTIFIER + '\\s*\\.\\s*)?\\*$', 'i'));
    if (match) return match[1] ? match[1].replace(/\s+/g, '').replace(/\.$/, '') : '*';
  }
  return undefined;
}

function relationAt(sql, fromPosition) {
  const start = skipSqlTrivia(sql, fromPosition + 4);
  if (sql[start] === '(') return {relation: '(', start};
  const match = sql.slice(start).match(
    new RegExp('^' + IDENTIFIER + '(?:\\s*\\.\\s*' + IDENTIFIER + ')?', 'i'),
  );
  if (!match) return {relation: 'UNRESOLVED', start};
  return {relation: match[0], start};
}

function selectStarFacts(sql) {
  const facts = [];
  for (const selectStart of selectKeywordPositions(sql)) {
    const fromStart = topLevelKeywordPosition(sql, selectStart + 6, 'FROM');
    if (fromStart === -1) continue;
    const projection = wildcardProjection(sql.slice(selectStart + 6, fromStart));
    if (!projection) continue;
    const relation = relationAt(sql, fromStart);
    facts.push({projection, relation: relation.relation, relationStart: relation.start, selectStart});
  }
  return facts;
}

function statementStart(sql, offset) {
  let last = 0;
  let index = 0;
  while (index < offset) {
    if (sql[index] === "'" || sql[index] === '"') {
      index = Math.min(skipSqlQuoted(sql, index), offset);
      continue;
    }
    if (sql[index] === ';') last = index + 1;
    index += 1;
  }
  return last;
}

function cteNamesForSelect(sql, selectStart) {
  const statementOffset = statementStart(sql, selectStart);
  const prefix = sql.slice(statementOffset, selectStart);
  const targetDepth = sqlParenthesisStackAt(sql, selectStart).length;
  const names = new Set();
  const pattern = new RegExp(`(?:\\bWITH\\s+(?:RECURSIVE\\s+)?|,)\\s*(${IDENTIFIER})\\s+AS\\s*(?:MATERIALIZED\\s*)?\\(`, 'gi');
  for (const match of prefix.matchAll(pattern)) {
    const nameOffset = statementOffset + match.index + match[0].lastIndexOf(match[1]);
    const nameDepth = sqlParenthesisStackAt(sql, nameOffset).length;
    if (nameDepth > targetDepth) continue;
    // A CTE declared inside a sibling subquery is not visible merely because
    // it appeared earlier in the Java string. Keep the enclosing SQL scope
    // in the visibility proof and fail closed when it is not provable.
    if (selectStart > sqlScopeEnd(sql, nameOffset)) continue;
    names.add(match[1].toLowerCase());
  }
  return names;
}

function isPersistenceSqlHolder(file, source) {
  if (!file.includes('/src/main/java/') || !file.includes('/persistence/')) return false;
  const className = source.match(/\b(?:public\s+)?(?:final\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/)?.[1];
  return Boolean(className && /(?:Sql|SQL|SqlFragments)$/.test(className));
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function isAssertionText(source, offset) {
  const before = source.slice(Math.max(0, offset - 240), offset);
  return /(?:assert\w*\s*\([^;]*|\.contains\s*\(\s*)$/i.test(before);
}

function maskJavaLiterals(source, literals) {
  const chars = source.split('');
  for (const literal of literals) {
    for (let index = literal.start; index < literal.end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
    }
  }
  return chars.join('');
}

function isSqlLikeLiteral(value) {
  const trimmed = value.trim();
  if (/^(?:SELECT|INSERT|UPDATE|DELETE)\s/i.test(trimmed)) return true;
  if (/^WITH\s+(?:RECURSIVE\s+)?[A-Za-z_$]/i.test(trimmed)) return true;
  if (/^\*\s+FROM\b/i.test(trimmed)) return true;
  if (/^(?:FROM|JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|VALUES|RETURNING|SET|LIMIT|OFFSET)(?:\s|$)/.test(trimmed))
    return true;
  if (/^(?:AND|OR)(?:\s|$)/.test(trimmed) && /(?:[.?=<>]|\b(?:IN|IS|LIKE|BETWEEN)\b)/.test(trimmed))
    return true;
  return false;
}

function findStringDeclarations(source, literals) {
  const withCommentsRemoved = maskJavaComments(source);
  const masked = maskJavaLiterals(withCommentsRemoved, literals);
  const declarations = [];
  const pattern =
    /\b(?:(?:public|protected|private|static|final|volatile|transient)\s+)*(?:String|CharSequence)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
  for (const match of masked.matchAll(pattern)) {
    let expressionStart = match.index + match[0].length;
    while (/\s/.test(source[expressionStart] ?? '')) expressionStart += 1;
    const expressionEnd = masked.indexOf(';', expressionStart);
    if (expressionEnd === -1) continue;
    const declarationHead = masked.slice(match.index, expressionStart);
    declarations.push({
      name: match[1],
      expression: source.slice(expressionStart, expressionEnd),
      expressionStart,
      expressionEnd,
      start: match.index,
      staticFinal: /\bstatic\b/.test(declarationHead) && /\bfinal\b/.test(declarationHead),
    });
  }
  return declarations;
}

function expressionUsesSqlLiteral(expression, expressionStart, expressionEnd, literals) {
  return literals.some(
    literal =>
      literal.start >= expressionStart &&
      literal.end <= expressionEnd &&
      isSqlLikeLiteral(literal.value),
  );
}

function expressionReferences(expression) {
  return new Set(expression.match(new RegExp(IDENTIFIER, 'g')) ?? []);
}

function methodNameForReturn(maskedCode, offset) {
  const pattern = new RegExp(
    '\\b(?:[A-Za-z_$][A-Za-z0-9_$]*\\s+)*(?:String|CharSequence)\\s+(' +
      IDENTIFIER +
      ')\\s*\\([^)]*\\)\\s*\\{',
    'g',
  );
  let methodName;
  for (const match of maskedCode.matchAll(pattern)) {
    if (match.index >= offset) break;
    methodName = match[1];
  }
  return methodName;
}

function sqlReturningMethodNames(source, literals) {
  const maskedCode = maskJavaLiterals(maskJavaComments(source), literals);
  const names = new Set();
  for (const match of maskedCode.matchAll(/\\breturn\\b/g)) {
    const expressionStart = match.index + match[0].length;
    const expressionEnd = maskedCode.indexOf(';', expressionStart);
    if (expressionEnd === -1) continue;
    if (
      literals.some(
        literal =>
          literal.start >= expressionStart &&
          literal.end <= expressionEnd &&
          isSqlLikeLiteral(literal.value),
      )
    ) {
      const methodName = methodNameForReturn(maskedCode, match.index);
      if (methodName) names.add(methodName);
    }
  }
  return names;
}

function qualifiedSqlFieldReferences(maskedCode, sqlFieldNames) {
  const references = [];
  const pattern = new RegExp('\\b' + IDENTIFIER + '\\s*\\.\\s*(' + IDENTIFIER + ')\\b', 'g');
  for (const match of maskedCode.matchAll(pattern)) {
    if (sqlFieldNames.has(match[1])) {
      const qualifier = match[0].slice(0, match[0].lastIndexOf(match[1])).replace(/\s*\.\s*$/, '').trim();
      references.push({name: match[1], qualifier, offset: match.index});
    }
  }
  return references;
}

function moduleNameForFile(file) {
  return file.match(/\/modules\/([^/]+)\//)?.[1] ?? null;
}

function persistenceConstantCatalog(entries) {
  const constants = new Map();
  for (const {file, source} of entries) {
    if (!file.includes('/src/main/java/') || !file.includes('/persistence/')) continue;
    const packageName = source.match(/^package\s+([^;]+);/m)?.[1];
    const className = source.match(/\b(?:public\s+)?(?:final\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/)?.[1];
    if (!packageName || !className || !/(?:Sql|SQL|SqlFragments)$/.test(className)) continue;
    const literals = scanJavaStringLiterals(source);
    const declarations = findStringDeclarations(source, literals);
    const resolved = resolveStaticStringDeclarations(declarations);
    for (const declaration of declarations) {
      const value = resolved.get(declaration.name);
      if (!declaration.staticFinal || value === undefined) continue;
      constants.set(`${packageName}.${className}.${declaration.name}`, {
        file,
        module: moduleNameForFile(file),
        value,
      });
    }
  }
  return constants;
}

function persistenceHolderCteDefinitions(entries) {
  const definitions = new Map();
  for (const {file, source} of entries) {
    if (!isPersistenceSqlHolder(file, source)) continue;
    const literals = scanJavaStringLiterals(source);
    const declarations = findStringDeclarations(source, literals);
    const resolved = resolveStaticStringDeclarations(declarations);
    const cteToConstants = new Map();
    const ordered = declarations
      .filter(declaration => declaration.staticFinal && resolved.has(declaration.name))
      .map(declaration => ({name: declaration.name, value: resolved.get(declaration.name)}));
    let combined = '';
    const ranges = [];
    for (const declaration of ordered) {
      if (combined) combined += ' ';
      const start = combined.length;
      combined += declaration.value;
      ranges.push({start, end: combined.length, name: declaration.name});
    }
    const pattern = new RegExp(
      `(?:\\bWITH\\s+(?:RECURSIVE\\s+)?|,)\\s*(${IDENTIFIER})\\s+AS\\s*(?:MATERIALIZED\\s*)?\\(`,
      'gi',
    );
    for (const match of combined.matchAll(pattern)) {
      const nameOffset = match.index + match[0].lastIndexOf(match[1]);
      const owner = ranges.find(range => nameOffset >= range.start && nameOffset < range.end);
      if (!owner) continue;
      const owners = cteToConstants.get(match[1].toLowerCase()) ?? new Set();
      owners.add(owner.name);
      cteToConstants.set(match[1].toLowerCase(), owners);
    }
    definitions.set(file, cteToConstants);
  }
  return definitions;
}

function connectedPersistenceCteScopes(entries, persistenceConstants, holderDefinitions) {
  const scopes = new Map();
  for (const {file, source} of entries) {
    if (isPersistenceSqlHolder(file, source)) continue;
    const literals = scanJavaStringLiterals(source);
    const maskedCode = maskJavaLiterals(maskJavaComments(source), literals);
    const references = qualifiedPersistenceConstantReferences(
      file,
      source,
      maskedCode,
      persistenceConstants,
    ).filter(reference => reference.approved && reference.constantFile);
    const groups = new Map();
    for (const reference of references) {
      const bounds = statementBounds(source, reference.offset);
      const key = `${file}:${bounds.start}:${bounds.end}`;
      const group = groups.get(key) ?? [];
      group.push(reference);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const byHolder = new Map();
      for (const reference of group) {
        const holderRefs = byHolder.get(reference.constantFile) ?? [];
        holderRefs.push(reference);
        byHolder.set(reference.constantFile, holderRefs);
      }
      for (const [holderFile, holderRefs] of byHolder) {
        if (holderRefs.length < 2) continue;
        const definitions = holderDefinitions.get(holderFile);
        if (!definitions) continue;
        const scopeByConstant = scopes.get(holderFile) ?? new Map();
        for (const reference of holderRefs) {
          const connectedNames = scopeByConstant.get(reference.name) ?? new Set();
          for (const [cteName, ownerConstants] of definitions) {
            if (ownerConstants.has(reference.name)) continue;
            if (
              holderRefs.some(
                other => other.offset < reference.offset && ownerConstants.has(other.name),
              )
            )
              connectedNames.add(cteName);
          }
          if (connectedNames.size) scopeByConstant.set(reference.name, connectedNames);
        }
        if (scopeByConstant.size) scopes.set(holderFile, scopeByConstant);
      }
    }
  }
  return scopes;
}

function qualifiedPersistenceConstantReferences(file, source, maskedCode, constants) {
  const imports = new Map();
  for (const match of source.matchAll(/^import\s+([^;]+)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*;/gm))
    imports.set(match[2], match[1] + '.' + match[2]);
  const references = [];
  const pattern = new RegExp('\\b(' + IDENTIFIER + ')\\s*\\.\\s*(' + IDENTIFIER + ')\\b', 'g');
  for (const match of maskedCode.matchAll(pattern)) {
    const className = match[1];
    const fieldName = match[2];
    const qualifiedClass = imports.get(className);
    if (!qualifiedClass) continue;
    const fact = constants.get(`${qualifiedClass}.${fieldName}`);
    if (!fact) continue;
    references.push({
      name: fieldName,
      qualifier: className,
      offset: match.index,
      constantFile: fact.file,
      approved: fact.module === moduleNameForFile(file),
    });
  }
  return references;
}

function calledSqlReturningMethods(maskedCode, sqlReturningMethods) {
  const calls = [];
  for (const methodName of sqlReturningMethods) {
    const escaped = methodName.replace(/[.*+?^()|[\\]\\\\]/g, '\\\\$&').replaceAll('$', '\\\\$');
    const pattern = new RegExp('\\\\b' + escaped + '\\\\s*\\\\(', 'g');
    for (const match of maskedCode.matchAll(pattern)) calls.push({name: methodName, offset: match.index});
  }
  return calls;
}

function resolveStaticStringDeclarations(declarations) {
  const constants = new Map();
  for (let pass = 0; pass < declarations.length + 1; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      if (!declaration.staticFinal) continue;
      const value = resolveConstantExpression(declaration.expression, constants);
      if (value !== undefined && constants.get(declaration.name) !== value) {
        constants.set(declaration.name, value);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return constants;
}

function expressionContainsUnsupportedConstruction(expression) {
  return (
    /\bStringBuilder\b|\bString\s*\.\s*(?:format|join)\s*\(/.test(expression) ||
    /\?[^:;]*:/.test(expression) ||
    /\b[A-Za-z_$][A-Za-z0-9_$]*\s*\([^;]*\)/.test(expression) ||
    /\+/.test(expression)
  );
}

function unknownRecord(file, source, offset, kind, reason, expression) {
  const normalizedExpression = expression.replace(/\s+/g, ' ').trim().slice(0, 320);
  return {
    file,
    line: lineAt(source, offset),
    kind,
    reason,
    expression: normalizedExpression,
    sink: 'UNRESOLVED_SQL_CONSTRUCTION',
    branch: kind === 'UNRESOLVED_BRANCH' ? reason : null,
    proof: 'CAPTURE_OR_COMPLETE_DATA_FLOW_REVIEW',
  };
}

function addUnknown(unknowns, seen, record) {
  const key = [record.file, record.line, record.kind, record.reason, record.expression].join('|');
  if (seen.has(key)) return;
  seen.add(key);
  unknowns.push(record);
}

function statementBounds(source, offset) {
  const starts = [
    source.lastIndexOf(';', offset - 1),
    source.lastIndexOf('{', offset - 1),
    source.lastIndexOf('}', offset - 1),
  ];
  const start = Math.max(...starts) + 1;
  const ends = [source.indexOf(';', offset), source.indexOf('}', offset)].filter(index => index >= 0);
  const end = ends.length ? Math.min(...ends) : source.length;
  return {start, end};
}

function statementIsSqlBearing(source, maskedSource, offset, literals, sqlNames, declarationNames) {
  const {start, end} = statementBounds(source, offset);
  if (
    literals.some(
      literal => literal.start >= start && literal.end <= end && isSqlLikeLiteral(literal.value),
    )
  )
    return true;
  const references = expressionReferences(maskedSource.slice(start, end));
  return [...references].some(
    reference =>
      sqlNames.has(reference) &&
      (!declarationNames || declarationNames.has(reference)),
  );
}

function expressionHasSelectStar(expression) {
  const literals = scanJavaStringLiterals(expression);
  const values = [
    ...literals,
    ...collectAdjacentLiteralValues(expression, literals),
  ];
  return values.some(value => selectStarFacts(value.value).length > 0);
}

function isUnresolvedSqlValueContext(source, maskedSource, offset) {
  const statementStart = Math.max(source.lastIndexOf(';', offset - 1), source.lastIndexOf('{', offset - 1), source.lastIndexOf('}', offset - 1)) + 1;
  const statementEnd = source.indexOf(';', offset) === -1 ? source.length : source.indexOf(';', offset);
  const statement = source.slice(statementStart, statementEnd);
  if (/\bStringBuilder\b|\.append\s*\(|\bString\s*\.\s*(?:format|join)\s*\(/.test(statement)) return true;
  const maskedStatement = maskedSource.slice(statementStart, statementEnd);
  if (/\b(?:String|CharSequence)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*[^;]*\+[^;]*\b[A-Za-z_$][A-Za-z0-9_$]*/.test(maskedStatement))
    return true;
  if (/\breturn\b[^;]*\+[^;]*\b[A-Za-z_$][A-Za-z0-9_$]*/.test(maskedStatement)) return true;
  if (/\?[^:;]*:/.test(maskedStatement)) return true;
  return false;
}

function scanJavaFile(file, source) {
  const literals = scanJavaStringLiterals(source);
  const maskedSource = maskJavaLiterals(maskJavaComments(source), literals);
  const values = [
    ...collectAdjacentLiteralValues(source, literals),
    ...collectConstantExpressions(source, literals),
  ];
  const violations = [];
  const seen = new Set();
  for (const value of values) {
    if (isAssertionText(source, value.start)) continue;
    if (isUnresolvedSqlValueContext(source, maskedSource, value.start)) continue;
    for (const fact of selectStarFacts(value.value)) {
      // A fragment whose relation is not present in this complete statement is
      // not enough evidence of a physical-table SELECT *. It is reported by
      // the SQL-construction unknown stream below instead of being silently
      // treated as a safe persistence fragment.
      if (fact.relation === 'UNRESOLVED') continue;
      const localNames = cteNamesForSelect(value.value, fact.selectStart);
      if (
        isPersistenceSqlHolder(file, source) &&
        !fact.relation.includes('.') &&
        !localNames.has(fact.relation.toLowerCase())
      )
        continue;
      if (relationIsAllowed(fact.relation, localNames)) continue;
      const key = `${value.start}:${fact.selectStart}:${fact.relation}:${fact.projection}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({
        file,
        line: lineAt(source, value.start),
        relation: fact.relation.replace(/\s+/g, ''),
        projection: fact.projection === '*' ? '*' : `${fact.projection}.*`,
      });
    }
  }
  return violations;
}

export function findJavaSelectStarViolations(entries) {
  const violations = [];
  const seenFiles = new Set();
  for (const entry of entries) {
    if (seenFiles.has(entry.file)) continue;
    seenFiles.add(entry.file);
    violations.push(...scanJavaFile(entry.file, entry.source));
  }
  return violations;
}

export function findJavaSqlConstructionUnknowns(entries) {
  const unknowns = [];
  const persistenceConstants = persistenceConstantCatalog(entries);
  const persistenceHolderDefinitions = persistenceHolderCteDefinitions(entries);
  const connectedCteScopes = connectedPersistenceCteScopes(
    entries,
    persistenceConstants,
    persistenceHolderDefinitions,
  );
  const entryFacts = entries.map(({file, source}) => {
    const literals = scanJavaStringLiterals(source);
    const declarations = findStringDeclarations(source, literals);
    const constants = resolveStaticStringDeclarations(declarations);
    const maskedCode = maskJavaLiterals(maskJavaComments(source), literals);
    const sqlFields = new Set();
    for (const declaration of declarations) {
      if (!declaration.staticFinal) continue;
      const resolved = constants.get(declaration.name);
      if (resolved !== undefined && isSqlLikeLiteral(resolved)) sqlFields.add(declaration.name);
    }
    return {
      file,
      source,
      literals,
      declarations,
      constants,
      maskedCode,
      sqlFields,
      sqlReturningMethods: sqlReturningMethodNames(source, literals),
      persistenceFieldReferences: qualifiedPersistenceConstantReferences(
        file,
        source,
        maskedCode,
        persistenceConstants,
      ),
    };
  });
  const sqlFieldNames = new Set(entryFacts.flatMap(entry => [...entry.sqlFields]));
  const sqlReturningMethods = new Set(entryFacts.flatMap(entry => [...entry.sqlReturningMethods]));
  for (const entry of entryFacts) {
    const {file, source, literals, declarations, constants, maskedCode} = entry;
    const hasSqlLiteral = literals.some(literal => isSqlLikeLiteral(literal.value));
    const approvedPersistenceReferences = new Set(
      entry.persistenceFieldReferences
        .filter(reference => reference.approved)
        .map(reference => `${reference.offset}:${reference.qualifier}.${reference.name}`),
    );
    const externalFieldReferences = [
      ...qualifiedSqlFieldReferences(maskedCode, sqlFieldNames).filter(
        reference => !approvedPersistenceReferences.has(`${reference.offset}:${reference.qualifier}.${reference.name}`),
      ),
      ...entry.persistenceFieldReferences.filter(reference => !reference.approved),
    ];
    const helperCalls = calledSqlReturningMethods(maskedCode, sqlReturningMethods);
    if (!hasSqlLiteral && externalFieldReferences.length === 0 && helperCalls.length === 0) continue;
    const sqlNames = new Set();
    const declarationByName = new Map(declarations.map(declaration => [declaration.name, declaration]));
    const declarationNames = new Set(declarationByName.keys());
    const unresolvedDeclarations = new Map();
    for (let pass = 0; pass < declarations.length + 1; pass += 1) {
      let changed = false;
      for (const declaration of declarations) {
        const maskedExpression = maskedCode.slice(declaration.expressionStart, declaration.expressionEnd);
        const references = expressionReferences(maskedExpression);
        const directSql = expressionUsesSqlLiteral(
          declaration.expression,
          declaration.expressionStart,
          declaration.expressionEnd,
          literals,
        );
        const referencesSql = [...references].some(
          reference => declarationNames.has(reference) && sqlNames.has(reference),
        );
        const conditionalSql =
          /\?[^:;]*:/.test(maskedExpression) &&
          (directSql ||
            referencesSql ||
            statementIsSqlBearing(
              source,
              maskedCode,
              declaration.expressionStart,
              literals,
              sqlNames,
              declarationNames,
            ));
        const specialSql =
          (expressionContainsUnsupportedConstruction(maskedExpression) && (directSql || referencesSql)) ||
          conditionalSql;
        if (directSql || referencesSql || specialSql) {
          if (!sqlNames.has(declaration.name)) {
            sqlNames.add(declaration.name);
            changed = true;
          }
          const resolved = resolveConstantExpression(declaration.expression, constants);
          const literalOnly =
            resolveConstantExpression(declaration.expression, new Map()) !== undefined ||
            (resolved !== undefined && declaration.staticFinal);
          const unsupportedConstruction =
            expressionContainsUnsupportedConstruction(maskedExpression) &&
            resolveConstantExpression(declaration.expression, new Map()) === undefined;
          if (!literalOnly || unsupportedConstruction) {
            unresolvedDeclarations.set(declaration.name, declaration);
          }
        }
      }
      if (!changed) break;
    }

    const seen = new Set();
    const sqlNamesWithSelectStar = new Set();
    for (let pass = 0; pass < declarations.length + 1; pass += 1) {
      let changed = false;
      for (const declaration of declarations) {
        if (!sqlNames.has(declaration.name)) continue;
        const references = expressionReferences(declaration.expression);
        if (
          expressionHasSelectStar(declaration.expression) ||
          [...references].some(
            reference =>
              declarationNames.has(reference) && sqlNamesWithSelectStar.has(reference),
          )
        ) {
          if (!sqlNamesWithSelectStar.has(declaration.name)) {
            sqlNamesWithSelectStar.add(declaration.name);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    const addConstruction = (offset, kind, reason, expression) => {
      const references = expressionReferences(expression);
      const effectiveKind =
        kind === 'UNRESOLVED_SQL_CONSTRUCTION' &&
        (expressionHasSelectStar(expression) ||
          [...references].some(reference => sqlNamesWithSelectStar.has(reference)))
          ? 'SELECT_STAR_UNRESOLVED'
          : kind;
      addUnknown(unknowns, seen, unknownRecord(file, source, offset, effectiveKind, reason, expression));
    };

    // A SELECT-star fragment that ends before its relation is supplied cannot
    // be classified as a physical table or a CTE from this source unit alone.
    // Keep the select-star gate conservative and make the unresolved boundary
    // explicit so B3 capture/data-flow review cannot be bypassed by a holder
    // fragment or by a CTE declared in another, unrelated constant.
    const values = [
      ...collectAdjacentLiteralValues(source, literals),
      ...collectConstantExpressions(source, literals),
    ];
    for (const value of values) {
      if (isAssertionText(source, value.start)) continue;
      if (
        selectStarFacts(value.value).some(
          fact => fact.relation === 'UNRESOLVED' && /\bFROM\s*$/i.test(value.value.trim()),
        )
      ) {
        addConstruction(value.start, 'SELECT_STAR_UNRESOLVED', 'incomplete-select-star-fragment', value.value);
      }
      if (
        isPersistenceSqlHolder(file, source) &&
        selectStarFacts(value.value).some(fact => {
          if (fact.relation === 'UNRESOLVED' || fact.relation === '(' || fact.relation.includes('.')) return false;
          const localNames = cteNamesForSelect(value.value, fact.selectStart);
          if (localNames.has(fact.relation.toLowerCase())) return false;
          const declaration = declarations.find(
            candidate => candidate.start <= value.start && value.start <= candidate.expressionEnd,
          );
          const connectedNames = declaration
            ? connectedCteScopes.get(file)?.get(declaration.name)
            : undefined;
          return !connectedNames?.has(fact.relation.toLowerCase());
        })
      ) {
        addConstruction(value.start, 'SELECT_STAR_UNRESOLVED', 'unscoped-persistence-select-star', value.value);
      }
    }

    for (const declaration of unresolvedDeclarations.values()) {
      const maskedExpression = maskedCode.slice(declaration.expressionStart, declaration.expressionEnd);
      const references = expressionReferences(maskedExpression);
      let kind = 'UNRESOLVED_SQL_CONSTRUCTION';
      let reason = 'field-or-cross-method-reference';
      if (/\?[^:;]*:/.test(maskedExpression)) {
        kind = 'UNRESOLVED_BRANCH';
        reason = 'conditional';
      } else if (/\bStringBuilder\b/.test(maskedExpression)) reason = 'StringBuilder';
      else if (/\bString\s*\.\s*format\s*\(/.test(maskedExpression)) reason = 'String.format';
      else if (/\bString\s*\.\s*join\s*\(/.test(maskedExpression)) reason = 'String.join';
      else if (/\b[A-Za-z_$][A-Za-z0-9_$]*\s*\([^;]*\)/.test(maskedExpression)) reason = 'method-call-construction';
      else if (/\+/.test(maskedExpression) && [...references].some(reference => sqlNames.has(reference)))
        reason = 'non-static-sql-concat';
      addConstruction(declaration.expressionStart, kind, reason, declaration.expression);
    }

    for (const match of maskedCode.matchAll(/\breturn\b/g)) {
      const expressionStart = match.index + match[0].length;
      const expressionEnd = maskedCode.indexOf(';', expressionStart);
      if (expressionEnd === -1) continue;
      const expression = source.slice(expressionStart, expressionEnd);
      const maskedExpression = maskedCode.slice(expressionStart, expressionEnd);
      const references = expressionReferences(maskedExpression);
      const directSql = expressionUsesSqlLiteral(source, expressionStart, expressionEnd, literals);
      const referencesSql = [...references].some(
        reference => declarationNames.has(reference) && sqlNames.has(reference),
      );
      const hasStringConstruction =
        /\+\s*[A-Za-z_$][A-Za-z0-9_$]*/.test(maskedExpression) ||
        /\bStringBuilder\b|\bString\s*\.\s*(?:format|join)\s*\(/.test(maskedExpression);
      const helperName = methodNameForReturn(maskedCode, match.index);
      if (!directSql && !referencesSql) continue;
      if (directSql && !referencesSql && !hasStringConstruction && !helperName) continue;
      addConstruction(match.index, 'UNRESOLVED_SQL_CONSTRUCTION', 'helper-return', expression);
    }

    for (const reference of externalFieldReferences) {
      const {start, end} = statementBounds(source, reference.offset);
      const statement = maskedCode.slice(start, end);
      if (!/[+?:=]|\breturn\b/.test(statement)) continue;
      addConstruction(
        reference.offset,
        'UNRESOLVED_SQL_CONSTRUCTION',
        'cross-file-constant-reference',
        source.slice(start, end),
      );
    }

    for (const call of helperCalls) {
      const {start, end} = statementBounds(source, call.offset);
      const statement = maskedCode.slice(start, end);
      if (!/[+?:=]|\breturn\b/.test(statement)) continue;
      addConstruction(
        call.offset,
        'UNRESOLVED_SQL_CONSTRUCTION',
        'cross-method-helper-call',
        source.slice(start, end),
      );
    }

    for (const [reason, pattern] of [
      ['StringBuilder', /\bStringBuilder\b/g],
      ['String.format', /\bString\s*\.\s*format\s*\(/g],
      ['String.join', /\bString\s*\.\s*join\s*\(/g],
      ['StringBuilder.append', /\b[A-Za-z_$][A-Za-z0-9_$]*\s*\.\s*append\s*\(/g],
    ]) {
      for (const match of maskedCode.matchAll(pattern)) {
        if (!statementIsSqlBearing(source, maskedCode, match.index, literals, sqlNames, declarationNames))
          continue;
        addConstruction(
          match.index,
          'UNRESOLVED_SQL_CONSTRUCTION',
          reason,
          source.slice(match.index, match.index + 160),
        );
      }
    }

    for (const match of maskedCode.matchAll(/\?/g)) {
      const {start, end} = statementBounds(source, match.index);
      const statement = maskedCode.slice(start, end);
      if (
        /:/.test(statement) &&
        statementIsSqlBearing(source, maskedCode, match.index, literals, sqlNames, declarationNames)
      )
        addConstruction(match.index, 'UNRESOLVED_BRANCH', 'conditional', source.slice(match.index, match.index + 240));
    }

    for (const declaration of declarations) {
      if (!declarationByName.has(declaration.name) || !sqlNames.has(declaration.name)) continue;
      const assignmentPattern = new RegExp(`\\b${declaration.name}\\s*=\\s*`);
      const assignment = assignmentPattern.exec(maskedCode.slice(declaration.expressionEnd + 1));
      if (!assignment) continue;
      const offset = declaration.expressionEnd + 1 + assignment.index;
      const context = maskedCode.slice(Math.max(0, offset - 120), offset + 240);
      if (/\b(?:if|else|switch|case)\b/.test(context)) addConstruction(offset, 'UNRESOLVED_BRANCH', 'if-or-switch-selection', source.slice(offset, offset + 240));
    }
  }
  return unknowns;
}
