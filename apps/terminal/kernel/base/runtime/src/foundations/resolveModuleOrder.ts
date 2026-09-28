import type {AppModuleDependency} from '@catering-v2s/kernel-base-contracts';
import type {RuntimeModule} from '../types/module';

const VISITING = 1;
const VISITED = 2;

const dependencyList = (module: RuntimeModule): readonly AppModuleDependency[] => module.dependencies ?? [];

/** Resolve required/optional module dependencies with a stable topological order. */
export const resolveModuleOrder = (modules: readonly RuntimeModule[]): readonly RuntimeModule[] => {
  const byName = new Map<string, RuntimeModule>();
  for (const module of modules) {
    if (byName.has(module.moduleName)) {
      throw new Error(`Duplicate runtime module: ${module.moduleName}`);
    }
    byName.set(module.moduleName, module);
  }

  const visitState = new Map<string, number>();
  const ordered: RuntimeModule[] = [];
  const stack: string[] = [];

  const visit = (module: RuntimeModule): void => {
    const state = visitState.get(module.moduleName);
    if (state === VISITED) return;
    if (state === VISITING) {
      const start = stack.indexOf(module.moduleName);
      const cycle = [...stack.slice(start), module.moduleName];
      throw new Error(`Circular runtime module dependency: ${cycle.join(' -> ')}`);
    }

    visitState.set(module.moduleName, VISITING);
    stack.push(module.moduleName);
    for (const dependency of dependencyList(module)) {
      const target = byName.get(dependency.moduleName);
      if (target === undefined) {
        if (dependency.optional === true) continue;
        throw new Error(`Missing required runtime module dependency: ${module.moduleName} -> ${dependency.moduleName}`);
      }
      visit(target);
    }
    stack.pop();
    visitState.set(module.moduleName, VISITED);
    ordered.push(module);
  };

  for (const module of modules) visit(module);
  return Object.freeze(ordered);
};
