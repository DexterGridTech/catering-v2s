package com.catering.v2s.platform.foundation.time;

import org.springframework.stereotype.Component;

@Component
public final class SystemTimeProvider implements TimeProvider {
    @Override
    public long currentEpochMillis() {
        return System.currentTimeMillis();
    }
}
