export type CustomerMemberMode = 'confirm' | 'handheld-confirm';

export type CustomerMemberProps = Readonly<{
  readonly mode: CustomerMemberMode;
  readonly prefix?: string;
  readonly pendingSource?: 'host' | 'branch';
}>;
