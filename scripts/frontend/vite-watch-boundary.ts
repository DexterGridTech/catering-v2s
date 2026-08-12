import path from 'node:path';

const isWithin = (candidate: string, root: string) =>
  candidate === root || candidate.startsWith(`${root}${path.sep}`);

const isAncestorOf = (candidate: string, descendant: string) =>
  descendant.startsWith(`${candidate}${path.sep}`);

/**
 * Keep Vite's filesystem watcher on the files that can affect an admin app.
 * The app root is still watched so Vite can reach the allowed children, but
 * every non-allowlisted child is rejected by the same predicate in both apps.
 */
export function createFrontendWatchBoundary(appRoot: string) {
  const resolvedAppRoot = path.resolve(appRoot);
  const workspaceRoot = path.resolve(resolvedAppRoot, '../../..');
  const allowedDirectories = [
    path.join(resolvedAppRoot, 'src'),
    path.join(resolvedAppRoot, 'public'),
    path.join(workspaceRoot, 'libraries/frontend/admin-ui-foundation/src'),
  ];
  const allowedFiles = new Set([
    path.join(resolvedAppRoot, 'index.html'),
    path.join(resolvedAppRoot, 'vite.config.ts'),
    path.join(resolvedAppRoot, 'tsconfig.json'),
    path.join(workspaceRoot, 'scripts/frontend/vite-watch-boundary.ts'),
  ]);

  const isAllowed = (file: string) => {
    const candidate = path.resolve(file);
    if (allowedFiles.has(candidate)) return true;

    const appRelative = path.relative(resolvedAppRoot, candidate);
    if (!appRelative.includes(path.sep) && path.basename(candidate).startsWith('.env')) return true;

    return allowedDirectories.some(
      (directory) => isWithin(candidate, directory) || isAncestorOf(candidate, directory),
    );
  };

  return {
    ignored: (file: string) => !isAllowed(file),
  };
}
