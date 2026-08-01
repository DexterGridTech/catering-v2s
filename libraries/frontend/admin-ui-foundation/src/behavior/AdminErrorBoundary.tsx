import {Component, type ErrorInfo, type ReactNode} from 'react';

type ErrorBoundaryState = {error?: Error};

export type ErrorRecoveryProps = {
  error: Error;
  reset: () => void;
};

export type AdminErrorBoundaryProps = {
  children: ReactNode;
  fallback: (props: ErrorRecoveryProps) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: readonly unknown[];
};

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unexpected UI error');
}

function changed(left?: readonly unknown[], right?: readonly unknown[]) {
  return left?.length !== right?.length || left?.some((entry, index) => !Object.is(entry, right?.[index])) === true;
}

/**
 * A face-neutral render-failure boundary. Each app owns its fallback wording,
 * reset location and session policy; foundation only makes recovery reliable.
 */
export class AdminErrorBoundary extends Component<AdminErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {error: toError(error)};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(toError(error), errorInfo);
  }

  componentDidUpdate(previousProps: AdminErrorBoundaryProps) {
    if (this.state.error && changed(previousProps.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => this.setState({error: undefined});

  render() {
    return this.state.error ? this.props.fallback({error: this.state.error, reset: this.reset}) : this.props.children;
  }
}
