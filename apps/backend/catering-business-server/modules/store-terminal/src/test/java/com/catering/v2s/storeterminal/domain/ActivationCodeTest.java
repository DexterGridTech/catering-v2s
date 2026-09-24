package com.catering.v2s.storeterminal.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ActivationCodeTest {
    @Test
    void valueObjectKeepsLeadingZeroAndNeverLeaksThroughToString() {
        ActivationCode code = ActivationCode.of("01234567");

        assertEquals("01234567", code.value());
        assertFalse(code.toString().contains("01234567"));
        assertEquals("ActivationCode[redacted]", code.toString());
    }

    @Test
    void rejectsValuesOutsideTheEightAsciiDigitContract() {
        assertThrows(IllegalArgumentException.class, () -> ActivationCode.of("1234567"));
        assertThrows(IllegalArgumentException.class, () -> ActivationCode.of("１２３４５６７８"));
    }
}
