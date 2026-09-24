// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = GroupWorkspaceCreateRequest.Deserializer.class)
public record GroupWorkspaceCreateRequest(
    String groupWorkspaceKey,
    String name,
    String operationsTitle,
    java.util.UUID logoAssetRef,
    String logoBindGrant,
    String notes,
    String idempotencyKey
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<GroupWorkspaceCreateRequest> {
    @Override
    public GroupWorkspaceCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (GroupWorkspaceCreateRequest) context.handleUnexpectedToken(GroupWorkspaceCreateRequest.class, parser);
      String groupWorkspaceKey = null;
      String name = null;
      String operationsTitle = null;
      java.util.UUID logoAssetRef = null;
      String logoBindGrant = null;
      String notes = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "property value is required");
        switch (property) {
          case "groupWorkspaceKey" -> groupWorkspaceKey = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "operationsTitle" -> operationsTitle = context.readValue(parser, String.class);
          case "logoAssetRef" -> logoAssetRef = context.readValue(parser, java.util.UUID.class);
          case "logoBindGrant" -> logoBindGrant = context.readValue(parser, String.class);
          case "notes" -> notes = context.readValue(parser, String.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "object must end with END_OBJECT");
      if (groupWorkspaceKey == null) return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "missing required property groupWorkspaceKey");
      if (name == null) return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "missing required property name");
      if (operationsTitle == null) return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "missing required property operationsTitle");
      if (logoAssetRef == null) return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "missing required property logoAssetRef");
      if (logoBindGrant == null) return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "missing required property logoBindGrant");
      if (idempotencyKey == null) return context.reportInputMismatch(GroupWorkspaceCreateRequest.class, "missing required property idempotencyKey");
      return new GroupWorkspaceCreateRequest(groupWorkspaceKey, name, operationsTitle, logoAssetRef, logoBindGrant, notes, idempotencyKey);
    }
  }
}
