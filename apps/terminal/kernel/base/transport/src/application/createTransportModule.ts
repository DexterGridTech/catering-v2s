import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';

/**
 * Transport has an owner module so its runtime dependency is explicit in the
 * same module graph as topology.  Session/framing behavior remains in this
 * package; this module deliberately owns no state, command or actor.
 */
export const createTransportModule = (): RuntimeModule =>
  Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: [],
    actors: [],
    slices: [],
  });
