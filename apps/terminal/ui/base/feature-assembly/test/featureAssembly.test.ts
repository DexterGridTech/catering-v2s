import {describe, expect, it} from 'vitest';
import {definePart} from '@catering-v2s/ui-base-render';
import {createUiRuntimeModule} from '../src/index';

const fixturePart = definePart({
  partKey: 'ui.feature.fixture-owner.notice',
  rendererKey: 'ui.feature.fixture-owner.notice.laptop',
  containerKeys: ['main'],
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: ['laptop'] as const,
  title: 'Fixture notice',
  description: 'Fixture notice',
  component: () => null,
});

const fixtureModule = () => ({
  moduleName: 'ui.feature.fixture-owner',
  kind: 'owner',
  dependencies: [],
  commandDefinitions: [],
  selectorDefinitions: [],
  actorDefinitions: [],
  stateSlices: [],
} as const);

describe('ui runtime module', () => {
  it('creates a runtime module with the owner presentation contributions attached', () => {
    const module = createUiRuntimeModule(fixtureModule(), {parts: []});

    expect(module.moduleName).toBe('ui.feature.fixture-owner');
    expect(module.kind).toBe('owner');
    expect(module.commandDefinitions).toEqual([]);
    expect(module.actorDefinitions).toEqual([]);
    expect(module.stateSlices).toEqual([]);
    expect(module.presentationContributions.parts).toEqual([]);
    expect(Object.isFrozen(module.presentationContributions)).toBe(true);
    expect(Object.isFrozen(module.presentationContributions.parts)).toBe(true);
    expect(Object.isFrozen(module)).toBe(true);
    expect('commands' in module).toBe(false);
    expect('actors' in module).toBe(false);
    expect('slices' in module).toBe(false);
  });

  it('preserves the RuntimeModule while freezing keyed owner dismissals', () => {
    const runtimeModule = createUiRuntimeModule(fixtureModule());
    const dismissal = () => undefined;
    const module = createUiRuntimeModule(runtimeModule, {
      parts: [fixturePart],
      layerDismissals: {[fixturePart.catalogEntry.partKey]: dismissal},
    });

    expect(module.moduleName).toBe(runtimeModule.moduleName);
    expect(module.presentationContributions.layerDismissals).toEqual({
      [fixturePart.catalogEntry.partKey]: dismissal,
    });
    expect(Object.isFrozen(module.presentationContributions.layerDismissals)).toBe(true);
  });

  it('rejects a layer dismissal without a part owned by the same module', () => {
    expect(() =>
      createUiRuntimeModule(fixtureModule(), {
        layerDismissals: {'ui.feature.other-owner.notice': () => undefined},
      }),
    ).toThrow(/layer dismissal has no package-owned part: ui\.feature\.other-owner\.notice/);
  });
});
