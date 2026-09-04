import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state'
import {createSampleStaffAuthModule} from './module'
import {parts} from './parts'
import {variables} from './variables'

export type StaffAuthAssembly = Readonly<{
  readonly parts: typeof parts
  readonly variables: readonly UiVariableDeclaration<StateJsonValue>[]
  readonly createModule: () => RuntimeModule
}>

export const sampleStaffAuthAssembly: StaffAuthAssembly = Object.freeze({
  parts,
  variables,
  createModule: createSampleStaffAuthModule,
})
