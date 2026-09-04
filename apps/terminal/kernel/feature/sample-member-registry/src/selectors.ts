import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {memberSliceName} from './slice'
import type {Member, MemberState, PendingMember} from './types'

const readMemberState = (root: StateRoot): MemberState => {
  const value = root[memberSliceName]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Missing member state: ${memberSliceName}`)
  }
  const members = Reflect.get(value, 'members')
  const pending = Reflect.get(value, 'pending')
  if (!Array.isArray(members) || (pending !== null && typeof pending !== 'object')) {
    throw new Error(`Invalid member state: ${memberSliceName}`)
  }
  return value as MemberState
}

export const selectMembers = (root: StateRoot): readonly Member[] => readMemberState(root).members

export const selectPendingMember = (root: StateRoot): PendingMember | null => readMemberState(root).pending
