// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceOperationsInvitationCreateRequest.Deserializer.class)
public record WorkspaceOperationsInvitationCreateRequest(
    java.util.UUID scopeRef,
    String mobile,
    java.util.List<String> roleIds,
    String idempotencyKey
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceOperationsInvitationCreateRequest> {
    @Override
    public WorkspaceOperationsInvitationCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceOperationsInvitationCreateRequest) context.handleUnexpectedToken(WorkspaceOperationsInvitationCreateRequest.class, parser);
      java.util.UUID scopeRef = null;
      String mobile = null;
      java.util.List<String> roleIds = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "property value is required");
        switch (property) {
          case "scopeRef" -> scopeRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "mobile" -> mobile = context.readValue(parser, String.class);
          case "roleIds" -> roleIds = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "object must end with END_OBJECT");
      if (mobile == null) return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "missing required property mobile");
      if (roleIds == null) return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "missing required property roleIds");
      if (idempotencyKey == null) return context.reportInputMismatch(WorkspaceOperationsInvitationCreateRequest.class, "missing required property idempotencyKey");
      return new WorkspaceOperationsInvitationCreateRequest(scopeRef, mobile, roleIds, idempotencyKey);
    }
  }
}
