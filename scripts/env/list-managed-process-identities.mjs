import fs from 'node:fs';
import path from 'node:path';

const runtime = process.env.RUNTIME;
if (!runtime || !fs.existsSync(runtime)) process.exit(0);

const walk = directory =>
  fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    return entry.isFile() && ['run-manifest.json', 'manifest.json'].includes(entry.name) ? [file] : [];
  });

const prefixes = (process.env.ALLOWED_PREFIXES || '').split('\n').filter(Boolean);
const prefixKinds = (process.env.ALLOWED_PREFIX_KINDS || '')
  .split('\n')
  .filter(Boolean)
  .map(value => {
    const separator = value.lastIndexOf('|');
    return [value.slice(0, separator), value.slice(separator + 1)];
  });
const groups = new Map();
for (const file of walk(runtime)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const processIdentity of manifest.processes || []) {
      if (!Number.isInteger(processIdentity.pid) || typeof processIdentity.startToken !== 'string') continue;
      const token = processIdentity.startToken.trim().replace(/\s+/g, ' ');
      const key = `${processIdentity.pid}\u0000${token}`;
      const group = groups.get(key) || {pid: processIdentity.pid, token, refs: []};
      group.refs.push({file, kind: manifest.kind || ''});
      groups.set(key, group);
    }
  } catch {
    // Malformed manifests are handled by the managed-run owner, not guessed here.
  }
}

for (const group of groups.values()) {
  const allowed = group.refs.every(
    reference =>
      prefixes.some(prefix => reference.file.startsWith(prefix)) ||
      prefixKinds.some(([prefix, kind]) => reference.file.startsWith(prefix) && reference.kind === kind) ||
      (reference.file === process.env.ALLOWED_EXACT_MANIFEST && reference.kind === process.env.ALLOWED_EXACT_KIND),
  );
  console.log(
    [group.pid, group.token, allowed ? 1 : 0, group.refs.map(reference => reference.file).join(',')].join('\t'),
  );
}
