/** The resource registry is production lifecycle infrastructure; this module only exposes it to tests. */
import type {Runtime} from '../types/runtime';
import {readRuntimeResourceRegistry} from '../foundations/runtimeResourceAccessorRegistry';

/**
 * Test-only cleanup; available only from the package's explicit testing subpath,
 * never from the production package root exports.
 * Runtime has no production-reachable stop or dispose exit, so only tests call this release seam.
 * Production has no registry-wide drain: resources that remain registered live until process exit.
 */
export const releaseRuntimeForTest = (runtime: Runtime): number => readRuntimeResourceRegistry(runtime)?.release() ?? 0;

/** Awaits module-owned asynchronous resources for tests that install async lifecycle owners. */
export const releaseRuntimeForTestAsync = async (runtime: Runtime): Promise<number> =>
  (await readRuntimeResourceRegistry(runtime)?.releaseAsync()) ?? 0;
