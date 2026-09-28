import {PrimitiveContainer, PrimitiveText} from '@catering-v2s/ui-base-primitives';

export type MemberRowProps = Readonly<{
  readonly testID: string;
  readonly name: string;
  readonly phone: string;
}>;

export const MemberRow = ({testID, name, phone}: MemberRowProps) => (
  <PrimitiveContainer testID={testID} layout="content">
    <PrimitiveText testID={`${testID}:content`}>
      {name} {phone}
    </PrimitiveText>
  </PrimitiveContainer>
);
