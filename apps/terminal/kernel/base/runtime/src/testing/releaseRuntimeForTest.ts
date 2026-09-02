/** The resource registry is production lifecycle infrastructure; this module only exposes it to tests. */
import {type RuntimeResourceRegistry} from '../foundations/createRuntimeResourceRegistry'
import type {Runtime} from '../types/runtime'

const registries = new WeakMap<object, RuntimeResourceRegistry>()

export const registerRuntimeResourceAccessorForTest = (
  runtime: Runtime,
  registry: RuntimeResourceRegistry,
): void => {
  registries.set(runtime, registry)
}

/**
 * Test-only cleanup; deliberately absent from the package root exports.
 * Runtime has no production-reachable stop or dispose exit, so only tests call this release seam.
 * Production has no registry-wide drain: resources that remain registered live until process exit.
 */
export const releaseRuntimeForTest = (runtime: Runtime): number =>
  registries.get(runtime)?.release() ?? 0
