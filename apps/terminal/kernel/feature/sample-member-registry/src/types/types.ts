export type Member = Readonly<{
  memberId: string
  name: string
  phone: string
  age?: number
  registeredAt: number
}>

export type PendingMember = Readonly<{
  name: string
  phone: string
}>

export type MemberState = Readonly<{
  members: readonly Member[]
  pending: PendingMember | null
}>

export type MemberRejectedPayload = Readonly<{
  reasonCode: 'customer-rejected'
}>
