package com.catering.v2s.salesmenu.infrastructure;

import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;

/** Test-only legacy seam used to keep direct owner fixtures focused on business behavior during migration. */
public interface SalesMenuRepository {
    Optional<SalesMenuAggregate> find(SalesMenuTarget target);

    Optional<SalesMenuAggregate> findForUpdate(SalesMenuTarget target);

    boolean compareAndSetVersion(SalesMenuTarget target, long expectedVersion);

    void lockCommandReceipt(UUID workspaceUuid, String operationId, String idempotencyKey);

    <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... arguments);

    int update(String sql, Object... arguments);
}
