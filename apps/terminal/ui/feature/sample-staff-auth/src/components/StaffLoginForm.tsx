import {PrimitiveForm} from '@catering-v2s/ui-base-primitives';
import {type ReactNode} from 'react';

type StaffLoginFormProps = Readonly<{
  readonly children: ReactNode;
}>;

/** Keeps the Web password control inside a native form without changing native layout. */
export const StaffLoginForm = ({children}: StaffLoginFormProps) => {
  return <PrimitiveForm>{children}</PrimitiveForm>;
};
