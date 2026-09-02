package com.catering.v2s.salesmenu.infrastructure;

import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;

/** Persistence boundary for sales-menu facts; SQL implementations belong to this owner module. */
public interface SalesMenuRepository {
    Optional<SalesMenuAggregate> find(SalesMenuTarget target);

    Optional<SalesMenuAggregate> findForUpdate(SalesMenuTarget target);

    boolean compareAndSetVersion(SalesMenuTarget target, long expectedVersion);

    /** Serializes one command idempotency key before the owner decides replay or executes the command. */
    void lockCommandReceipt(UUID workspaceUuid, String operationId, String idempotencyKey);

    <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... arguments);

    int update(String sql, Object... arguments);
}
