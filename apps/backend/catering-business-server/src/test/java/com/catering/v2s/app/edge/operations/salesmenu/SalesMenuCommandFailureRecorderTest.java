package com.catering.v2s.app.edge.operations.salesmenu;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SalesMenuCommandFailureRecorderTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID MENU = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID ITEM = UUID.fromString("66666666-6666-4666-8666-666666666666");

    @Test
    void knownBusinessProblemIsRecordedAndOriginalProblemIsPreserved() {
        SalesMenuOwnerApi owner = mock(SalesMenuOwnerApi.class);
        SalesMenuCommandFailureRecorder recorder = new SalesMenuCommandFailureRecorder(owner);
        String message = "版本已变化";
        SalesMenuOwnerApi.Problem failure = new SalesMenuOwnerApi.Problem("SALES_MENU_VERSION_CONFLICT", 409, message);

        SalesMenuOwnerApi.Problem actual = assertThrows(
                SalesMenuOwnerApi.Problem.class,
                () -> recorder.execute("updateOperationsSalesMenuItem", context(), ITEM, null, () -> {
                    throw failure;
                }));

        assertSame(failure, actual);
        ArgumentCaptor<SalesMenuOwnerApi.RejectedOperationCommand> captured =
                ArgumentCaptor.forClass(SalesMenuOwnerApi.RejectedOperationCommand.class);
        verify(owner).recordRejectedOperation(captured.capture());
        assertEquals("updateOperationsSalesMenuItem", captured.getValue().operationKind());
        assertEquals(ITEM, captured.getValue().targetRef());
        assertEquals("SALES_MENU_VERSION_CONFLICT", captured.getValue().failureCode());
    }

    @Test
    void authorizationProblemIsNotConvertedIntoARejectedBusinessRecord() {
        SalesMenuOwnerApi owner = mock(SalesMenuOwnerApi.class);
        SalesMenuCommandFailureRecorder recorder = new SalesMenuCommandFailureRecorder(owner);
        SalesMenuOwnerApi.Problem failure = new SalesMenuOwnerApi.Problem("GRANT_INVALID", 403, "授权无效");

        assertSame(
                failure,
                assertThrows(
                        SalesMenuOwnerApi.Problem.class,
                        () -> recorder.execute("renameOperationsSalesMenu", context(), MENU, null, () -> {
                            throw failure;
                        })));

        verifyNoInteractions(owner);
    }

    @Test
    void failureToWriteRejectionDoesNotReplaceOriginalProblem() {
        SalesMenuOwnerApi owner = mock(SalesMenuOwnerApi.class);
        doThrow(new IllegalStateException("recording failed"))
                .when(owner)
                .recordRejectedOperation(any(SalesMenuOwnerApi.RejectedOperationCommand.class));
        SalesMenuCommandFailureRecorder recorder = new SalesMenuCommandFailureRecorder(owner);
        SalesMenuOwnerApi.Problem failure = new SalesMenuOwnerApi.Problem("SECTION_NOT_EMPTY", 409, "分区非空");

        assertSame(
                failure,
                assertThrows(
                        SalesMenuOwnerApi.Problem.class,
                        () -> recorder.execute("deleteOperationsSalesMenuSection", context(), MENU, null, () -> {
                            throw failure;
                        })));
    }

    private static SalesMenuCommandApi.CommandContext context() {
        return new SalesMenuCommandApi.CommandContext(
                new SalesMenuScope(WORKSPACE, "group-1", STORE),
                MENU,
                new OperationsOwnerScopeGrant(
                        WORKSPACE,
                        "group-1",
                        "OWNER_RECHECK_SALES_MENU",
                        "EDIT_STORE_SALES_MENU",
                        "STORE",
                        STORE,
                        "STORE",
                        STORE,
                        List.of()),
                1L,
                AuditActor.system(),
                "sales-menu-recorder-test");
    }
}
