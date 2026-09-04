import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state'
import {createSampleMemberDeskModule} from './module'
import {parts} from './parts'
import {variables} from './variables'

export type MemberDeskAssembly = Readonly<{
  readonly parts: typeof parts
  readonly variables: readonly UiVariableDeclaration<StateJsonValue>[]
  readonly createModule: () => RuntimeModule
}>

export const sampleMemberDeskAssembly: MemberDeskAssembly = Object.freeze({
  parts,
  variables,
  createModule: createSampleMemberDeskModule,
})
