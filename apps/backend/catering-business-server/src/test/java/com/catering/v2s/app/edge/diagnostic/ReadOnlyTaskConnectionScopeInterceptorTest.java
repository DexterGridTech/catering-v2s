package com.catering.v2s.app.edge.diagnostic;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.servlet.HandlerMapping;

class ReadOnlyTaskConnectionScopeInterceptorTest {
    @Test
    void opensAndClosesOneReadScopeForEveryCatalogTaskReadInTheClosedSet() {
        assertOneReadScope(
                "/api/operations/catalog-inventory/category-candidates", "getOperationsCatalogCategoryCandidates");
        assertOneReadScope("/api/operations/catalog-inventory/items/{itemCode}/skus", "getOperationsCatalogItemSkus");
    }

    private void assertOneReadScope(String path, String operationId) {
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        TransactionStatus status = mock(TransactionStatus.class);
        when(transactions.getTransaction(org.mockito.ArgumentMatchers.any())).thenReturn(status);
        when(status.isCompleted()).thenReturn(false);
        ReadOnlyTaskConnectionScopeInterceptor interceptor = new ReadOnlyTaskConnectionScopeInterceptor(
                Map.of(
                        "GET " + path,
                        new EdgeRouteFaceRegistry.Definition(operationId, "GET", path, "catalog", "operations-admin")),
                transactions);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, path);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertTrue(interceptor.preHandle(request, response, new Object()));
        interceptor.afterCompletion(request, response, new Object(), null);

        verify(transactions).getTransaction(org.mockito.ArgumentMatchers.any());
        verify(transactions).rollback(status);
    }
}
