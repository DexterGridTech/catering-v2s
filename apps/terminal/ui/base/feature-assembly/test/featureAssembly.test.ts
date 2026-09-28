import {describe, expect, it} from 'vitest';
import {createFeatureAssembly, type CreateFeatureAssemblyModuleInput} from '../src/index';

const fixtureModule = (): CreateFeatureAssemblyModuleInput => ({
  moduleName: 'ui.feature.fixture-owner',
  kind: 'owner',
  dependencies: [],
  commandDefinitions: [],
  actorDefinitions: [],
});

describe('ui feature assembly', () => {
  it('preserves feature identity while producing a real owner module', () => {
    const assembly = createFeatureAssembly({parts: ['fixture'], createModule: fixtureModule});
    const module = assembly.createModule();

    expect(module.moduleName).toBe('ui.feature.fixture-owner');
    expect(module.kind).toBe('owner');
    expect(module.commandDefinitions).toEqual([]);
  });
});
