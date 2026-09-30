// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PublicInvitationOtpVerifyRequest.Deserializer.class)
public record PublicInvitationOtpVerifyRequest(
    String mobile,
    String code
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PublicInvitationOtpVerifyRequest> {
    @Override
    public PublicInvitationOtpVerifyRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PublicInvitationOtpVerifyRequest) context.handleUnexpectedToken(PublicInvitationOtpVerifyRequest.class, parser);
      String mobile = null;
      String code = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "property value is required");
        switch (property) {
          case "mobile" -> mobile = context.readValue(parser, String.class);
          case "code" -> code = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "object must end with END_OBJECT");
      if (mobile == null) return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "missing required property mobile");
      if (code == null) return context.reportInputMismatch(PublicInvitationOtpVerifyRequest.class, "missing required property code");
      return new PublicInvitationOtpVerifyRequest(mobile, code);
    }
  }
}
