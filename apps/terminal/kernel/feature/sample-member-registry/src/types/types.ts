export type Member = Readonly<{
  memberId: string;
  operationId: string;
  name: string;
  phone: string;
  age?: number;
  registeredAt: number;
}>;

export type PendingMember = Readonly<{
  operationId: string;
  name: string;
  phone: string;
}>;

export type MemberState = Readonly<{
  members: readonly Member[];
  /** Pending confirmation owned by the MASTER registry. */
  hostPending: PendingMember | null;
  /** Unfinished LSP-local registration; never included in host sync. */
  branchPending: PendingMember | null;
  /** Read-only current-host projection consumed by dual-machine LMS. */
  hostPendingProjection?: PendingMember | null;
}>;

export type MemberRejectedPayload = Readonly<{
  operationId: string;
  reasonCode: 'customer-rejected';
}>;
