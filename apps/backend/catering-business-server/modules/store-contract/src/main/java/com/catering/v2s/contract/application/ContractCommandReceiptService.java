package com.catering.v2s.contract.application;

import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.contract.application.persistence.ContractCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/** Owner-local, exact terminal readback persistence for required-idempotency contract commands. */
@Service
public final class ContractCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final ContractCommandReceiptPersistence persistence;
    private final TimeProvider time;

    public ContractCommandReceiptService(org.springframework.jdbc.core.JdbcTemplate jdbc, TimeProvider time) {
        this(new ContractCommandReceiptPersistence(jdbc), time);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ContractCommandReceiptService(ContractCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    public StoreContractReadback execute(
            UUID workspaceUuid, String key, String canonicalRequest, Supplier<StoreContractReadback> command) {
        if (workspaceUuid == null || key == null || key.length() < 16 || key.length() > 128)
            throw new ContractCommandService.ContractValidationException();
        String hash = CommandReceiptSupport.requestHash(canonicalRequest);
        ContractCommandReceiptPersistence.Receipt prior = persistence.find(workspaceUuid, key);
        if (prior != null) {
            if (!hash.equals(prior.requestHash())) throw new ContractIdempotencyConflictException();
            return read(prior.responseJson());
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            StoreContractReadback result = command.get();
            persistence.insert(workspaceUuid, key, result.id(), hash, write(result), time.currentEpochMillis());
            return result;
        }
    }

    private static StoreContractReadback read(String value) {
        try {
            return CommandReceiptSupport.deserializeNullable(
                    JSON, value, StoreContractReadback.class, "store contract receipt is not readable");
        } catch (Exception exception) {
            throw new ContractReceiptCorruptException(exception);
        }
    }

    private static String write(StoreContractReadback value) {
        try {
            return CommandReceiptSupport.serialize(JSON, value, "store contract receipt is not writable");
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String hash(String value) {
        try {
            return CommandReceiptSupport.requestHash(value);
        } catch (NullPointerException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static final class ContractIdempotencyConflictException extends RuntimeException {}

    public static final class ContractReceiptCorruptException extends RuntimeException {
        public ContractReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
