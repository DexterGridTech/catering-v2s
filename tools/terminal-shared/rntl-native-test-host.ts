export type NativeTestHostProps = Readonly<Record<string, unknown>>;
export type NativeTestRefFactory = (hostName: string, props: NativeTestHostProps) => unknown;

let refFactory: NativeTestRefFactory = () => ({});
let nativeHandlesByRef = new WeakMap<object, unknown>();

export const setNativeTestRefFactory = (factory: NativeTestRefFactory): void => {
  refFactory = factory;
  nativeHandlesByRef = new WeakMap<object, unknown>();
};

export const resetNativeTestRefFactory = (): void => {
  refFactory = () => ({});
  nativeHandlesByRef = new WeakMap<object, unknown>();
};

export const createNativeTestHost = (
  hostName: string,
  reactRuntime: unknown,
  statics: Readonly<Record<string, unknown>> = {},
) => {
  const {createElement, forwardRef, useImperativeHandle} = reactRuntime as typeof import('react');
  return Object.assign(
    forwardRef<unknown, NativeTestHostProps>((props, ref) => {
      useImperativeHandle(ref, () => {
        const refKey = ref as object;
        if (!nativeHandlesByRef.has(refKey)) nativeHandlesByRef.set(refKey, refFactory(hostName, props));
        return nativeHandlesByRef.get(refKey);
      }, [ref]);
      return createElement(hostName, props);
    }),
    statics,
  );
};

export const withNativeTestHosts = <TModule extends Readonly<Record<string, unknown>>>(
  module: TModule,
  reactRuntime: unknown,
) => ({
  ...module,
  View: createNativeTestHost('View', reactRuntime),
  TextInput: createNativeTestHost('TextInput', reactRuntime, {
    State: (module.TextInput as {readonly State?: unknown}).State,
  }),
  ScrollView: createNativeTestHost('ScrollView', reactRuntime),
  Pressable: createNativeTestHost('Pressable', reactRuntime),
  Image: createNativeTestHost('Image', reactRuntime),
  VirtualizedList: createNativeTestHost('VirtualizedList', reactRuntime),
});
