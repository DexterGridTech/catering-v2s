// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = GroupWorkspaceStatusTransitionRequest.Deserializer.class)
public record GroupWorkspaceStatusTransitionRequest(
    GroupWorkspaceStatus targetStatus,
    Long expectedVersion,
    String idempotencyKey
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<GroupWorkspaceStatusTransitionRequest> {
    @Override
    public GroupWorkspaceStatusTransitionRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (GroupWorkspaceStatusTransitionRequest) context.handleUnexpectedToken(GroupWorkspaceStatusTransitionRequest.class, parser);
      GroupWorkspaceStatus targetStatus = null;
      Long expectedVersion = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "property value is required");
        switch (property) {
          case "targetStatus" -> targetStatus = context.readValue(parser, GroupWorkspaceStatus.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "object must end with END_OBJECT");
      if (targetStatus == null) return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "missing required property targetStatus");
      if (expectedVersion == null) return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "missing required property expectedVersion");
      if (idempotencyKey == null) return context.reportInputMismatch(GroupWorkspaceStatusTransitionRequest.class, "missing required property idempotencyKey");
      return new GroupWorkspaceStatusTransitionRequest(targetStatus, expectedVersion, idempotencyKey);
    }
  }
}
