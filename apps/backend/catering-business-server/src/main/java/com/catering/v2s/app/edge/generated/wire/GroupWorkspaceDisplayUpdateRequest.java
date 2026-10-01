// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = GroupWorkspaceDisplayUpdateRequest.Deserializer.class)
public record GroupWorkspaceDisplayUpdateRequest(
    String name,
    String operationsTitle,
    String notes,
    String logoIntent,
    java.util.UUID logoAssetRef,
    String logoBindGrant,
    Long expectedVersion,
    String idempotencyKey
) {
  @Override
  public String toString() {
    return "GroupWorkspaceDisplayUpdateRequest["
        + "name=" + name
        + ", operationsTitle=" + operationsTitle
        + ", notes=" + notes
        + ", logoIntent=" + logoIntent
        + ", logoAssetRef=" + logoAssetRef
        + ", redacted=" + "[REDACTED]"
        + ", expectedVersion=" + expectedVersion
        + ", idempotencyKey=" + idempotencyKey
        + "]";
  }



  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<GroupWorkspaceDisplayUpdateRequest> {
    @Override
    public GroupWorkspaceDisplayUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (GroupWorkspaceDisplayUpdateRequest) context.handleUnexpectedToken(GroupWorkspaceDisplayUpdateRequest.class, parser);
      String name = null;
      String operationsTitle = null;
      String notes = null;
      String logoIntent = null;
      java.util.UUID logoAssetRef = null;
      String logoBindGrant = null;
      Long expectedVersion = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          case "operationsTitle" -> operationsTitle = context.readValue(parser, String.class);
          case "notes" -> notes = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "logoIntent" -> logoIntent = context.readValue(parser, String.class);
          case "logoAssetRef" -> logoAssetRef = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, java.util.UUID.class));
          case "logoBindGrant" -> logoBindGrant = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "missing required property name");
      if (operationsTitle == null) return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "missing required property operationsTitle");
      if (logoIntent == null) return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "missing required property logoIntent");
      if (expectedVersion == null) return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "missing required property expectedVersion");
      if (idempotencyKey == null) return context.reportInputMismatch(GroupWorkspaceDisplayUpdateRequest.class, "missing required property idempotencyKey");
      return new GroupWorkspaceDisplayUpdateRequest(name, operationsTitle, notes, logoIntent, logoAssetRef, logoBindGrant, expectedVersion, idempotencyKey);
    }
  }
}
