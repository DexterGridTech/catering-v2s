package com.catering.v2s.platform.foundation.time;

/** Sole runtime source for persisted epoch-millisecond timestamps. */
@FunctionalInterface
public interface TimeProvider {
    long currentEpochMillis();
}
