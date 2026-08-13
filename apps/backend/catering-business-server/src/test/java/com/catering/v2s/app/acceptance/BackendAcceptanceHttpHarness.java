package com.catering.v2s.app.acceptance;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;
import java.util.UUID;

/** Real HTTP client boundary used by the managed acceptance suite and calibration. */
public final class BackendAcceptanceHttpHarness {
    public static final String CALIBRATION_ROUTE = "/__backend-acceptance/measurement-calibration";
    public static final String OPERATION_HEADER = "X-Backend-Acceptance-Operation-Id";
    public static final String ROUTE_HEADER = "X-Backend-Acceptance-Route-Template";
    public static final String RUN_ID_HEADER = "X-Backend-Acceptance-Run-Id";
    public static final String SECRET_HEADER = "X-Backend-Acceptance-Secret";
    public static final String CALIBRATION_HEADER = "X-Backend-Acceptance-Calibration";

    private final HttpClient client;
    private final URI baseUri;
    private final String runId;
    private final String secret;
    private final BackendAcceptanceDatabaseMetricsSink sink;

    public BackendAcceptanceHttpHarness(URI baseUri, String runId, String secret,
                                        BackendAcceptanceDatabaseMetricsSink sink) {
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        this.baseUri = Objects.requireNonNull(baseUri, "baseUri");
        this.runId = requireToken(runId, "runId");
        this.secret = requireSecret(secret);
        this.sink = Objects.requireNonNull(sink, "sink");
    }

    public BackendAcceptanceMeasurementCalibrationScenario.Receipt runMeasurementCalibration() {
        String correlationId = "backend-acceptance-calibration-" + UUID.randomUUID();
        HttpRequest request = HttpRequest.newBuilder(baseUri.resolve(CALIBRATION_ROUTE))
                .timeout(Duration.ofMinutes(2))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("X-Correlation-Id", correlationId)
                .header(RUN_ID_HEADER, runId)
                .header(SECRET_HEADER, secret)
                .header(OPERATION_HEADER, BackendAcceptanceMeasurementCalibrationScenario.SCENARIO_ID)
                .header(ROUTE_HEADER, CALIBRATION_ROUTE)
                .header(CALIBRATION_HEADER, "true")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("BACKEND_ACCEPTANCE_CALIBRATION_HTTP_FAILED:status=" + response.statusCode());
            }
            return BackendAcceptanceMeasurementCalibrationScenario.verify(correlationId, sink);
        } catch (IOException failure) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_CALIBRATION_HTTP_IO_FAILED", failure);
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("BACKEND_ACCEPTANCE_CALIBRATION_HTTP_INTERRUPTED", failure);
        }
    }

    private static String requireToken(String value, String name) {
        if (value == null || !value.matches("[A-Za-z0-9._:-]{8,128}")) throw new IllegalArgumentException(name + " invalid");
        return value;
    }

    private static String requireSecret(String value) {
        if (value == null || value.length() < 24 || !value.matches("[A-Za-z0-9._:-]{24,256}")) {
            throw new IllegalArgumentException("secret invalid");
        }
        return value;
    }
}
