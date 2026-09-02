import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state'
import type {UiCatalog} from './catalog'
import type {UiVariableDeclaration} from './variable'

export type UiStateModule = RuntimeModule & Readonly<{
  readonly catalog: UiCatalog
  readonly selectUiVariable: <TValue extends StateJsonValue>(
    root: StateRoot,
    declaration: UiVariableDeclaration<TValue>,
  ) => TValue
}>
