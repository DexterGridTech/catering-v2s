package com.catering.v2s.app.edge.operations.salesmenu;

import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Records only closed-set, authorized sales-menu business rejections after the command transaction rolls back. */
@Component
final class SalesMenuCommandFailureRecorder {
    private static final Logger log = LoggerFactory.getLogger(SalesMenuCommandFailureRecorder.class);

    private static final Set<String> RECORDED_FAILURE_CODES = Set.of(
            "IDEMPOTENCY_CONFLICT",
            "MOVE_NOT_ALLOWED",
            "PUBLICATION_NOT_FOUND",
            "SALES_ITEM_NOT_FOUND",
            "SALES_MENU_ARCHIVED",
            "SALES_MENU_ASSET_INVALID",
            "SALES_MENU_ASSET_LIFECYCLE_CONFLICT",
            "SALES_MENU_ASSET_TARGET_MISMATCH",
            "SALES_MENU_CHANNEL_DISABLED",
            "SALES_MENU_CHANNEL_INELIGIBLE",
            "SALES_MENU_CONSTRAINT_INVALID",
            "SALES_MENU_DRAFT_INVALID",
            "SALES_MENU_ITEM_NOT_FOUND",
            "SALES_MENU_ITEM_REFERENCE_INVALID",
            "SALES_MENU_MANUAL_REASON_REQUIRED",
            "SALES_MENU_MANUAL_TARGET_INVALID",
            "SALES_MENU_NOT_FOUND",
            "SALES_MENU_ORDER_OPTION_REFERENCE_INVALID",
            "SALES_MENU_ORDER_OPTION_SELECTION_INVALID",
            "SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED",
            "SALES_MENU_PRICE_REQUIRED",
            "SALES_MENU_PUBLICATION_REQUIRED",
            "SALES_MENU_SCOPE_MISMATCH",
            "SALES_MENU_SKU_REFERENCE_INVALID",
            "SALES_MENU_STORE_DISABLED",
            "SALES_MENU_VERSION_CONFLICT",
            "SECTION_NOT_EMPTY",
            "SECTION_NOT_FOUND",
            "SALES_SECTION_NOT_FOUND",
            "TARGET_NOT_FOUND",
            "VERSION_CONFLICT");

    private final SalesMenuOwnerApi owner;

    SalesMenuCommandFailureRecorder(SalesMenuOwnerApi owner) {
        this.owner = owner;
    }

    <T> T execute(
            String operationKind,
            SalesMenuCommandApi.CommandContext context,
            UUID targetRef,
            UUID channelRef,
            Supplier<T> command) {
        return execute(operationKind, context, targetRef, null, channelRef, command);
    }

    <T> T execute(
            String operationKind,
            SalesMenuCommandApi.CommandContext context,
            UUID targetRef,
            String targetKind,
            UUID channelRef,
            Supplier<T> command) {
        try {
            return command.get();
        } catch (SalesMenuOwnerApi.Problem failure) {
            if (RECORDED_FAILURE_CODES.contains(failure.code())) {
                record(operationKind, context, targetRef, targetKind, channelRef, failure);
            }
            throw failure;
        }
    }

    private void record(
            String operationKind,
            SalesMenuCommandApi.CommandContext context,
            UUID targetRef,
            String targetKind,
            UUID channelRef,
            SalesMenuOwnerApi.Problem failure) {
        try {
            owner.recordRejectedOperation(new SalesMenuOwnerApi.RejectedOperationCommand(
                    context.ownerContext(), operationKind, targetRef, targetKind, null, failure.code(), channelRef));
        } catch (RuntimeException recordFailure) {
            log.atError()
                    .addKeyValue("event", "SALES_MENU_REJECTED_OPERATION_RECORD_FAILED")
                    .addKeyValue("operationKind", operationKind)
                    .addKeyValue("failureCode", failure.code())
                    .addKeyValue("recordFailureType", recordFailure.getClass().getSimpleName())
                    .setCause(recordFailure)
                    .log("sales-menu rejected operation could not be recorded");
        }
    }
}
