package com.catering.v2s.storeterminal.application;

import java.security.SecureRandom;
import java.util.Locale;
import org.springframework.stereotype.Component;

/** Cryptographically unpredictable production source for eight-digit activation codes. */
@Component
public final class SecureActivationCodeCandidateSource implements ActivationCodeCandidateSource {
    private final SecureRandom random = new SecureRandom();

    @Override
    public String nextCandidate() {
        return String.format(Locale.ROOT, "%08d", random.nextInt(100_000_000));
    }
}
