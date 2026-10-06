import {deriveTestId, PrimitiveContainer, PrimitiveText, type TestId} from '@catering-v2s/ui-base-primitives';

export type MemberRowProps = Readonly<{
  readonly testID: TestId;
  readonly name: string;
  readonly phone: string;
}>;

export const MemberRow = ({testID, name, phone}: MemberRowProps) => (
  <PrimitiveContainer testID={testID} layout="content">
    <PrimitiveText testID={deriveTestId(testID, 'content')!}>
      {name} {phone}
    </PrimitiveText>
  </PrimitiveContainer>
);
