// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceRoleCreateRequest.Deserializer.class)
public record WorkspaceRoleCreateRequest(
    String name,
    String description,
    String serviceNodeType,
    java.util.List<String> capabilityKeys,
    java.util.List<String> pageAccessKeys
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceRoleCreateRequest> {
    @Override
    public WorkspaceRoleCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceRoleCreateRequest) context.handleUnexpectedToken(WorkspaceRoleCreateRequest.class, parser);
      String name = null;
      String description = null;
      String serviceNodeType = null;
      java.util.List<String> capabilityKeys = null;
      java.util.List<String> pageAccessKeys = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "description" -> description = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "serviceNodeType" -> serviceNodeType = context.readValue(parser, String.class);
          case "capabilityKeys" -> capabilityKeys = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          case "pageAccessKeys" -> pageAccessKeys = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "missing required property name");
      if (serviceNodeType == null) return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "missing required property serviceNodeType");
      if (capabilityKeys == null) return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "missing required property capabilityKeys");
      if (pageAccessKeys == null) return context.reportInputMismatch(WorkspaceRoleCreateRequest.class, "missing required property pageAccessKeys");
      return new WorkspaceRoleCreateRequest(name, description, serviceNodeType, capabilityKeys, pageAccessKeys);
    }
  }
}
