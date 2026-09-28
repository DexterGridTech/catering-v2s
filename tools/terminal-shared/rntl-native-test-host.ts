import {Component, createElement, forwardRef, type ForwardedRef} from 'react';

export type NativeTestHostProps = Readonly<Record<string, unknown>>;
export type NativeTestRefFactory = (hostName: string, props: NativeTestHostProps) => unknown;

let refFactory: NativeTestRefFactory = () => ({});

export const setNativeTestRefFactory = (factory: NativeTestRefFactory): void => {
  refFactory = factory;
};

export const resetNativeTestRefFactory = (): void => {
  refFactory = () => ({});
};

export const createNativeTestHost = (hostName: string, statics: Readonly<Record<string, unknown>> = {}) => {
  type HostInstanceProps = NativeTestHostProps & {forwardedRef: ForwardedRef<unknown>};

  class NativeTestHostInstance extends Component<HostInstanceProps> {
    private nativeHandle: unknown;

    componentDidMount(): void {
      const {forwardedRef: _forwardedRef, ...props} = this.props;
      this.nativeHandle = refFactory(hostName, props);
      this.assignRef(this.props.forwardedRef, this.nativeHandle);
    }

    componentDidUpdate(previousProps: HostInstanceProps): void {
      if (previousProps.forwardedRef !== this.props.forwardedRef) {
        this.assignRef(previousProps.forwardedRef, null);
        this.assignRef(this.props.forwardedRef, this.nativeHandle);
      }
    }

    componentWillUnmount(): void {
      this.assignRef(this.props.forwardedRef, null);
    }

    render() {
      const {forwardedRef: _forwardedRef, ...props} = this.props;
      return createElement(hostName, props);
    }

    private assignRef(ref: ForwardedRef<unknown>, value: unknown): void {
      if (typeof ref === 'function') ref(value);
      else if (ref !== null) ref.current = value;
    }
  }

  return Object.assign(
    forwardRef<unknown, NativeTestHostProps>((props, ref) =>
      createElement(NativeTestHostInstance, {...props, forwardedRef: ref}),
    ),
    statics,
  );
};

export const withNativeTestHosts = <TModule extends Readonly<Record<string, unknown>>>(module: TModule) => ({
  ...module,
  View: createNativeTestHost('View'),
  TextInput: createNativeTestHost('TextInput', {
    State: (module.TextInput as {readonly State?: unknown}).State,
  }),
  ScrollView: createNativeTestHost('ScrollView'),
  Pressable: createNativeTestHost('Pressable'),
  Image: createNativeTestHost('Image'),
  VirtualizedList: createNativeTestHost('VirtualizedList'),
});
