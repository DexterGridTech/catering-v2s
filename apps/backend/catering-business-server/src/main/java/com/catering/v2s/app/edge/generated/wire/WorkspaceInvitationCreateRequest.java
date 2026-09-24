// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = WorkspaceInvitationCreateRequest.Deserializer.class)
public record WorkspaceInvitationCreateRequest(
    String mobile,
    String targetOrganizationType,
    java.util.UUID targetOrganizationRef,
    java.util.List<String> roleIds
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<WorkspaceInvitationCreateRequest> {
    @Override
    public WorkspaceInvitationCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (WorkspaceInvitationCreateRequest) context.handleUnexpectedToken(WorkspaceInvitationCreateRequest.class, parser);
      String mobile = null;
      String targetOrganizationType = null;
      java.util.UUID targetOrganizationRef = null;
      java.util.List<String> roleIds = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "property value is required");
        switch (property) {
          case "mobile" -> mobile = context.readValue(parser, String.class);
          case "targetOrganizationType" -> targetOrganizationType = context.readValue(parser, String.class);
          case "targetOrganizationRef" -> targetOrganizationRef = context.readValue(parser, java.util.UUID.class);
          case "roleIds" -> roleIds = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<String>>() {});
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "object must end with END_OBJECT");
      if (mobile == null) return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "missing required property mobile");
      if (targetOrganizationType == null) return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "missing required property targetOrganizationType");
      if (targetOrganizationRef == null) return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "missing required property targetOrganizationRef");
      if (roleIds == null) return context.reportInputMismatch(WorkspaceInvitationCreateRequest.class, "missing required property roleIds");
      return new WorkspaceInvitationCreateRequest(mobile, targetOrganizationType, targetOrganizationRef, roleIds);
    }
  }
}
