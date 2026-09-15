declare module 'react-test-renderer' {
  import type {ReactElement} from 'react';

  export type ReactTestInstance = {
    props: Record<string, unknown>;
  };

  export type ReactTestRenderer = {
    root: {
      findAllByType(type: string): ReactTestInstance[];
    };
    unmount(): void;
  };

  export function act(callback: () => void | Promise<void>): void | Promise<void>;
  export function create(element: ReactElement): ReactTestRenderer;
}
