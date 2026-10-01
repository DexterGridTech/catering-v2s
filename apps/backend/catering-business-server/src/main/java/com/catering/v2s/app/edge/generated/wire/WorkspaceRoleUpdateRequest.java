// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceRoleUpdateRequest.Deserializer.class)
public record WorkspaceRoleUpdateRequest(
    String name,
    String description,
    java.util.List<String> capabilityKeys,
    java.util.List<String> pageAccessKeys,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceRoleUpdateRequest> {
    @Override
    public WorkspaceRoleUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceRoleUpdateRequest) context.handleUnexpectedToken(WorkspaceRoleUpdateRequest.class, parser);
      String name = null;
      String description = null;
      java.util.List<String> capabilityKeys = null;
      java.util.List<String> pageAccessKeys = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "description" -> description = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "capabilityKeys" -> capabilityKeys = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          case "pageAccessKeys" -> pageAccessKeys = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "missing required property name");
      if (capabilityKeys == null) return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "missing required property capabilityKeys");
      if (pageAccessKeys == null) return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "missing required property pageAccessKeys");
      if (expectedVersion == null) return context.reportInputMismatch(WorkspaceRoleUpdateRequest.class, "missing required property expectedVersion");
      return new WorkspaceRoleUpdateRequest(name, description, capabilityKeys, pageAccessKeys, expectedVersion);
    }
  }
}
