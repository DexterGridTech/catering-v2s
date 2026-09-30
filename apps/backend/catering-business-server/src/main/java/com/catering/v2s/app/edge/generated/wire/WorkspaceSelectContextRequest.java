// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceSelectContextRequest.Deserializer.class)
public record WorkspaceSelectContextRequest(
    java.util.UUID roleAssignmentRef,
    Long requiredContextVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceSelectContextRequest> {
    @Override
    public WorkspaceSelectContextRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceSelectContextRequest) context.handleUnexpectedToken(WorkspaceSelectContextRequest.class, parser);
      java.util.UUID roleAssignmentRef = null;
      Long requiredContextVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "property value is required");
        switch (property) {
          case "roleAssignmentRef" -> roleAssignmentRef = context.readValue(parser, java.util.UUID.class);
          case "requiredContextVersion" -> requiredContextVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "object must end with END_OBJECT");
      if (roleAssignmentRef == null) return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "missing required property roleAssignmentRef");
      if (requiredContextVersion == null) return context.reportInputMismatch(WorkspaceSelectContextRequest.class, "missing required property requiredContextVersion");
      return new WorkspaceSelectContextRequest(roleAssignmentRef, requiredContextVersion);
    }
  }
}
