package com.catering.v2s.terminaldataserver.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import reactor.blockhound.BlockingOperationError;
import reactor.core.scheduler.Schedulers;

class TdsBlockHoundTest {
    @Test
    void detectsBlockingCallsOnReactorParallelWorkers() throws Exception {
        CompletableFuture<Throwable> result = new CompletableFuture<>();
        Schedulers.parallel().schedule(() -> {
            try {
                Thread.sleep(1);
                result.complete(null);
            } catch (Throwable failure) {
                result.complete(failure);
            }
        });

        assertThat(result.get(2, TimeUnit.SECONDS))
                .as("TDS_BLOCKHOUND_BLOCKING_CALL_NOT_DETECTED")
                .isInstanceOf(BlockingOperationError.class);
    }
}
