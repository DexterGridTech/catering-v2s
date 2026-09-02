package com.catering.v2s.salesmenu.domain;

import java.time.LocalTime;
import java.util.Objects;

/** Store-local schedule facts. The store timezone is resolved by the organization owner. */
public record SalesMenuSchedule(SalesMenuScheduleKind kind, LocalTime startLocalTime, LocalTime endLocalTime) {
    public SalesMenuSchedule {
        Objects.requireNonNull(kind, "kind");
        if (kind == SalesMenuScheduleKind.ALL_DAY) {
            if (startLocalTime != null || endLocalTime != null) {
                throw new IllegalArgumentException("all-day schedule cannot have local times");
            }
        } else if (startLocalTime == null || endLocalTime == null || startLocalTime.equals(endLocalTime)) {
            throw new IllegalArgumentException("daily time range requires two different local times");
        }
    }

    public static SalesMenuSchedule allDay() {
        return new SalesMenuSchedule(SalesMenuScheduleKind.ALL_DAY, null, null);
    }

    public static SalesMenuSchedule daily(LocalTime startLocalTime, LocalTime endLocalTime) {
        return new SalesMenuSchedule(SalesMenuScheduleKind.DAILY_TIME_RANGE, startLocalTime, endLocalTime);
    }
}
