export type SessionStatus = 'anonymous' | 'authenticated'

export type SessionState = Readonly<{
  status: SessionStatus
  operatorName: string | null
}>

export type LoginPayload = Readonly<{
  operatorName: string
  passcode: string
}>

export type LoginFailedPayload = Readonly<{
  reasonCode: 'invalid-credentials'
}>
