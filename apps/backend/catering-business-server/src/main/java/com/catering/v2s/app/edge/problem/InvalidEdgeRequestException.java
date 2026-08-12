package com.catering.v2s.app.edge.problem;

/** A request-shape failure that must become a typed HTTP Problem, never a framework default response. */
public final class InvalidEdgeRequestException extends RuntimeException {
    public InvalidEdgeRequestException(String message) {
        super(message);
    }

    public InvalidEdgeRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
