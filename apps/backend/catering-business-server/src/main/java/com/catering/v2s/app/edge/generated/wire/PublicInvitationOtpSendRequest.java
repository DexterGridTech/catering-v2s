// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PublicInvitationOtpSendRequest.Deserializer.class)
public record PublicInvitationOtpSendRequest(
    String mobile
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PublicInvitationOtpSendRequest> {
    @Override
    public PublicInvitationOtpSendRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PublicInvitationOtpSendRequest) context.handleUnexpectedToken(PublicInvitationOtpSendRequest.class, parser);
      String mobile = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PublicInvitationOtpSendRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PublicInvitationOtpSendRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PublicInvitationOtpSendRequest.class, "property value is required");
        switch (property) {
          case "mobile" -> mobile = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PublicInvitationOtpSendRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PublicInvitationOtpSendRequest.class, "object must end with END_OBJECT");
      if (mobile == null) return context.reportInputMismatch(PublicInvitationOtpSendRequest.class, "missing required property mobile");
      return new PublicInvitationOtpSendRequest(mobile);
    }
  }
}
