import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {createSampleMemberDeskModule} from '../application/module'
import {parts} from '../parts/parts'

export type MemberDeskAssembly = Readonly<{
  readonly parts: typeof parts
  readonly createModule: () => RuntimeModule
}>

export const sampleMemberDeskAssembly: MemberDeskAssembly = Object.freeze({
  parts,
  createModule: createSampleMemberDeskModule,
})
