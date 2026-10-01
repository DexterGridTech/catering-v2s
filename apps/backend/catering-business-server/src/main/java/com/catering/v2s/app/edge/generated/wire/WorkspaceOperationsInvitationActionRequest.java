// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceOperationsInvitationActionRequest.Deserializer.class)
public record WorkspaceOperationsInvitationActionRequest(
    java.util.UUID scopeRef,
    Long expectedContextVersion,
    Long expectedVersion,
    String idempotencyKey
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceOperationsInvitationActionRequest> {
    @Override
    public WorkspaceOperationsInvitationActionRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceOperationsInvitationActionRequest) context.handleUnexpectedToken(WorkspaceOperationsInvitationActionRequest.class, parser);
      java.util.UUID scopeRef = null;
      Long expectedContextVersion = null;
      Long expectedVersion = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "property value is required");
        switch (property) {
          case "scopeRef" -> scopeRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "expectedContextVersion" -> expectedContextVersion = context.readValue(parser, Long.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "object must end with END_OBJECT");
      if (expectedContextVersion == null) return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "missing required property expectedContextVersion");
      if (expectedVersion == null) return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "missing required property expectedVersion");
      if (idempotencyKey == null) return context.reportInputMismatch(WorkspaceOperationsInvitationActionRequest.class, "missing required property idempotencyKey");
      return new WorkspaceOperationsInvitationActionRequest(scopeRef, expectedContextVersion, expectedVersion, idempotencyKey);
    }
  }
}
