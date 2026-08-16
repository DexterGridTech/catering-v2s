package com.catering.v2s.contract.application;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

@Component
public final class BusinessDateProvider {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");
    private final TimeProvider time;

    public BusinessDateProvider(TimeProvider time) {
        this.time = time;
    }

    public LocalDate today() {
        return Instant.ofEpochMilli(time.currentEpochMillis())
                .atZone(BUSINESS_ZONE)
                .toLocalDate();
    }
}
