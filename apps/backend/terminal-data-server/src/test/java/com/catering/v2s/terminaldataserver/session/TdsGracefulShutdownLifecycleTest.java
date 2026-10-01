package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import com.catering.v2s.terminaldataserver.protocol.TdsWireJsonConfiguration;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository;
import com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriter;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.availability.AvailabilityChangeEvent;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ApplicationContext;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

class TdsGracefulShutdownLifecycleTest {
    @Test
    void readinessWithdrawsBeforeAdmissionClosesAndTheWebServerStopsAfterDrain() throws Exception {
        TdsTerminalSessionActors actors = mock(TdsTerminalSessionActors.class);
        ApplicationContext applicationContext = mock(ApplicationContext.class);
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "2",
                "16",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofMillis(100),
                TdsRuntimeSettings.SINGLE_NODE_ID,
                Duration.ofSeconds(2));
        when(actors.beginDrain()).thenReturn(Mono.just(true));
        when(actors.finishDrain()).thenReturn(Mono.empty());
        TdsGracefulShutdownLifecycle lifecycle =
                new TdsGracefulShutdownLifecycle(actors, settings, applicationContext, Schedulers.immediate());
        CountDownLatch stopped = new CountDownLatch(1);

        lifecycle.start();
        lifecycle.stop(stopped::countDown);

        verifyNoInteractions(actors);
        assertThat(stopped.await(250, TimeUnit.MILLISECONDS)).isFalse();

        var shutdownOrder = inOrder(applicationContext, actors);
        shutdownOrder.verify(applicationContext).publishEvent(any(AvailabilityChangeEvent.class));
        assertThat(stopped.await(3, TimeUnit.SECONDS)).isTrue();
        shutdownOrder.verify(actors).refuseNewConnections();
        shutdownOrder.verify(actors).beginDrain();
        shutdownOrder.verify(actors).finishDrain();
        assertThat(lifecycle.isRunning()).isFalse();
        assertThat(lifecycle.getPhase()).isGreaterThan(WebServerApplicationContext.GRACEFUL_SHUTDOWN_PHASE);
    }

    @Test
    void keepsStateWriterAndListenerAliveThroughWebServerStopAndStopsListenerLast() {
        var scheduler = Schedulers.immediate();
        TdsRuntimeSettings settings = TdsRuntimeSettings.from(
                "2",
                "16",
                Duration.ofSeconds(30),
                Duration.ofSeconds(90),
                Duration.ofSeconds(15),
                Duration.ofSeconds(10),
                TdsRuntimeSettings.SINGLE_NODE_ID,
                Duration.ofSeconds(2));
        TdsConnectionStateWriter stateWriter =
                new TdsConnectionStateWriter(mock(TdsConnectionStateRepository.class), settings, scheduler, scheduler);
        TdsBindingRevocationListener listener = new TdsBindingRevocationListener(
                mock(DataSource.class),
                mock(TdsConnectionStateRepository.class),
                mock(TdsTerminalSessionActors.class),
                new TdsListenerRecoveryGate("", "", ""),
                TdsWireJsonConfiguration.createWireObjectMapper(),
                scheduler);

        int webServerStopPhase = WebServerApplicationContext.START_STOP_LIFECYCLE_PHASE;
        assertThat(WebServerApplicationContext.GRACEFUL_SHUTDOWN_PHASE).isGreaterThan(webServerStopPhase);
        assertThat(stateWriter.getPhase()).isEqualTo(webServerStopPhase - 1);
        assertThat(listener.getPhase()).isEqualTo(stateWriter.getPhase() - 1);
    }
}
