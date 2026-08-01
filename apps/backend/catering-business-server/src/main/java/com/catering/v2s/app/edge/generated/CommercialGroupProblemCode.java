// Generated R3 wire-compatibility subset from accepted R5 error disposition; do not edit.
package com.catering.v2s.app.edge.generated;

public enum CommercialGroupProblemCode {
  INVALID_EDGE_CONTEXT("INVALID_EDGE_CONTEXT"),
  GROUP_WORKSPACE_NOT_FOUND("GROUP_WORKSPACE_NOT_FOUND"),
  COMMERCIAL_GROUP_ALREADY_INITIALIZED("COMMERCIAL_GROUP_ALREADY_INITIALIZED"),
  IDEMPOTENCY_CONFLICT("IDEMPOTENCY_CONFLICT"),
  VALIDATION_FAILED("VALIDATION_FAILED"),
  UNKNOWN_SUBMISSION_RESULT("UNKNOWN_SUBMISSION_RESULT");

  private final String wireValue;
  CommercialGroupProblemCode(String wireValue) { this.wireValue = wireValue; }
  public String wireValue() { return wireValue; }
}
