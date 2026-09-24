// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OperationsPasswordRecoveryOtpSendRequest.Deserializer.class)
public record OperationsPasswordRecoveryOtpSendRequest(

) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OperationsPasswordRecoveryOtpSendRequest> {
    @Override
    public OperationsPasswordRecoveryOtpSendRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OperationsPasswordRecoveryOtpSendRequest) context.handleUnexpectedToken(OperationsPasswordRecoveryOtpSendRequest.class, parser);
      tools.jackson.core.JsonToken token = parser.nextToken();
      if (token == null)
        return context.reportInputMismatch(OperationsPasswordRecoveryOtpSendRequest.class, "object must end with END_OBJECT");
      if (token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token == tools.jackson.core.JsonToken.PROPERTY_NAME) {
          String property = parser.currentName();
          parser.nextToken();
          parser.skipChildren();
          return context.reportInputMismatch(OperationsPasswordRecoveryOtpSendRequest.class, "unknown property " + property);
        }
        return context.reportInputMismatch(OperationsPasswordRecoveryOtpSendRequest.class, "object property name is required");
      }
      return new OperationsPasswordRecoveryOtpSendRequest();
    }
  }
}
