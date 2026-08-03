package com.catering.v2s.platform.foundation.seed;

import java.util.UUID;

/** DEV-only source for a purpose-bound OTP; owner services still hash and verify it normally. */
@FunctionalInterface
public interface DevFixedOtpIssuer {
    String issue(String purpose, UUID subjectRef);
}
