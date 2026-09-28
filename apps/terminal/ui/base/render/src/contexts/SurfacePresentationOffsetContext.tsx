import {createContext, useContext, type ReactNode} from 'react';
import type {Animated} from 'react-native';

export type SurfacePresentationOffset = number | Animated.Value | Animated.AnimatedInterpolation<number>;

type SurfacePresentationOffsetProviderProps = Readonly<{
  readonly offset: SurfacePresentationOffset;
  readonly children?: ReactNode;
}>;

const SurfacePresentationOffsetContext = createContext<SurfacePresentationOffset>(0);

export const SurfacePresentationOffsetProvider = ({offset, children}: SurfacePresentationOffsetProviderProps) => (
  <SurfacePresentationOffsetContext.Provider value={offset}>{children}</SurfacePresentationOffsetContext.Provider>
);

export const useSurfacePresentationOffset = (): SurfacePresentationOffset =>
  useContext(SurfacePresentationOffsetContext);
