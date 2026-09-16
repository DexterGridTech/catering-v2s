package com.catering.v2s.app.edge.audit;

import com.catering.v2s.app.edge.generated.wire.AuditChange;
import com.catering.v2s.app.edge.generated.wire.AuditValueState;
import com.catering.v2s.app.edge.generated.wire.AuditHistoryItem;
import com.catering.v2s.app.edge.generated.wire.AuditHistoryPage;
import com.catering.v2s.app.edge.generated.wire.AuditTarget;

/** Generated-wire adaptation only; action and field keys remain stable non-localized contract values. */
public final class AuditHistoryWireMapper {
    private AuditHistoryWireMapper() {}

    public static AuditHistoryPage page(com.catering.v2s.audit.contract.AuditHistoryPage value) {
        return new AuditHistoryPage(
                value.items().stream()
                        .map(item -> new AuditHistoryItem(
                                item.id(),
                                item.occurredAtEpochMillis(),
                                item.actorDisplayName(),
                                item.action(),
                                item.action(),
                                new AuditTarget(
                                        item.target().entityType(),
                                        item.target().entityRef()),
                                item.changes().stream()
                                        .map(change -> new AuditChange(
                                                change.fieldKey(),
                                                change.fieldLabelSnapshot(),
                                                change.beforeState() == null ? null : AuditValueState.valueOf(change.beforeState().name()),
                                                change.beforeValue(),
                                                change.afterState() == null ? null : AuditValueState.valueOf(change.afterState().name()),
                                                change.afterValue()))
                                        .toList()))
                        .toList(),
                value.page(),
                value.pageSize(),
                value.total());
    }
}
