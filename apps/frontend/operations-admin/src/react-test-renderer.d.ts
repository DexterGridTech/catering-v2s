declare module 'react-test-renderer' {
  import type {ReactElement} from 'react';

  export type ReactTestRenderer = {
    update(element: ReactElement): void;
    unmount(): void;
  };

  export type ReactTestRendererOptions = {
    createNodeMock?: (element: ReactElement) => unknown;
  };

  export function create(element: ReactElement, options?: ReactTestRendererOptions): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;
}
