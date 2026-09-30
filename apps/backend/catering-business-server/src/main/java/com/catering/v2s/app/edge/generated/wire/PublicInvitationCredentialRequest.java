// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PublicInvitationCredentialRequest.Deserializer.class)
public record PublicInvitationCredentialRequest(
    String verificationGrant,
    String userName,
    String loginName,
    String password
) {
  @Override
  public String toString() {
    return "PublicInvitationCredentialRequest["
        + "redacted=" + "[REDACTED]"
        + ", userName=" + userName
        + ", loginName=" + loginName
        + ", redacted=" + "[REDACTED]"
        + "]";
  }


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PublicInvitationCredentialRequest> {
    @Override
    public PublicInvitationCredentialRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PublicInvitationCredentialRequest) context.handleUnexpectedToken(PublicInvitationCredentialRequest.class, parser);
      String verificationGrant = null;
      String userName = null;
      String loginName = null;
      String password = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "property value is required");
        switch (property) {
          case "verificationGrant" -> verificationGrant = context.readValue(parser, String.class);
          case "userName" -> userName = context.readValue(parser, String.class);
          case "loginName" -> loginName = context.readValue(parser, String.class);
          case "password" -> password = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "object must end with END_OBJECT");
      if (verificationGrant == null) return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "missing required property verificationGrant");
      if (userName == null) return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "missing required property userName");
      if (loginName == null) return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "missing required property loginName");
      if (password == null) return context.reportInputMismatch(PublicInvitationCredentialRequest.class, "missing required property password");
      return new PublicInvitationCredentialRequest(verificationGrant, userName, loginName, password);
    }
  }
}
