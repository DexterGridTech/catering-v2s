import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {createSampleMemberDeskModule} from './module'
import {parts} from './parts'

export type MemberDeskAssembly = Readonly<{
  readonly parts: typeof parts
  readonly createModule: () => RuntimeModule
}>

export const sampleMemberDeskAssembly: MemberDeskAssembly = Object.freeze({
  parts,
  createModule: createSampleMemberDeskModule,
})
