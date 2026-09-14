import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from '../dependencies'
import {createWallpaperConsolePlacementActor} from '../features/actors/actors'
import {moduleKind, moduleName} from '../moduleName'

const runtimeModuleDependencies = dependencyModuleNames.filter(name =>
  ![
    'ui.base.render',
    'ui.base.primitives',
    'ui.base.input',
    'ui.base.admin-shell',
  ].includes(name),
)

export const createSampleWallpaperConsoleModule = (): RuntimeModule => {
  const actors = [createWallpaperConsolePlacementActor()] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencies.map(name => ({moduleName: name})),
    commands: [],
    commandDefinitions: [],
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [],
    stateSlices: [],
  })
}
