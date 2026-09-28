export type CustomerMemberMode = 'confirm' | 'handheld-confirm';

export type CustomerMemberProps = Readonly<{
  readonly mode: CustomerMemberMode;
}>;
