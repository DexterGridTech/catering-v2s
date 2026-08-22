package com.catering.v2s.catalog.application.operations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class BatchTransitionOperationsCatalogItemStatusOperationTest {
    @Test
    void batchCommandResolvesAuthorizationAndOwnerFactsInsideRequiredTransaction() throws Exception {
        Method execute = BatchTransitionOperationsCatalogItemStatusOperation.class.getMethod(
                "execute", BatchTransitionOperationsCatalogItemStatusOperation.Invocation.class);
        Transactional transaction = execute.getAnnotation(Transactional.class);

        assertNotNull(transaction);
        assertEquals(Propagation.REQUIRED, transaction.propagation());
    }
}
