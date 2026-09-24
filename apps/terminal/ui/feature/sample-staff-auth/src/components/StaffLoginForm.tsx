import {createElement, type ReactNode} from 'react'

type StaffLoginFormProps = Readonly<{
  readonly children: ReactNode
}>

/** Keeps the Web password control inside a native form without changing native layout. */
export const StaffLoginForm = ({children}: StaffLoginFormProps) => {
  // The form boundary is a Web-only browser primitive. Checking the host
  // global keeps the native/test renderer path free of a Platform adapter
  // dependency while preserving the same native child tree.
  if (typeof document === 'undefined') return <>{children}</>
  return createElement(
    'form',
    {onSubmit: (event: {readonly preventDefault: () => void}) => event.preventDefault()},
    children,
  )
}
