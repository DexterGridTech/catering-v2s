import type {ComponentType} from 'react';

type ClassNameProps = Readonly<{readonly className?: string}>;

/**
 * The browser and focused-render test paths already pass className through to
 * their host. Native gets the actual CSS interop implementation from the
 * platform sibling without making the shared slot import a platform runtime.
 */
export const cssInterop = <Props extends object>(
  component: ComponentType<Props>,
  _mapping: Readonly<Record<string, string>> = {},
): ComponentType<Props & ClassNameProps> => component as ComponentType<Props & ClassNameProps>;
