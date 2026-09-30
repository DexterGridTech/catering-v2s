// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformPasswordRecoveryOtpVerifyRequest.Deserializer.class)
public record PlatformPasswordRecoveryOtpVerifyRequest(
    String code
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformPasswordRecoveryOtpVerifyRequest> {
    @Override
    public PlatformPasswordRecoveryOtpVerifyRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformPasswordRecoveryOtpVerifyRequest) context.handleUnexpectedToken(PlatformPasswordRecoveryOtpVerifyRequest.class, parser);
      String code = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformPasswordRecoveryOtpVerifyRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformPasswordRecoveryOtpVerifyRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformPasswordRecoveryOtpVerifyRequest.class, "property value is required");
        switch (property) {
          case "code" -> code = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformPasswordRecoveryOtpVerifyRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformPasswordRecoveryOtpVerifyRequest.class, "object must end with END_OBJECT");
      if (code == null) return context.reportInputMismatch(PlatformPasswordRecoveryOtpVerifyRequest.class, "missing required property code");
      return new PlatformPasswordRecoveryOtpVerifyRequest(code);
    }
  }
}
