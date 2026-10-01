// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OperationsPasswordRecoveryStartRequest.Deserializer.class)
public record OperationsPasswordRecoveryStartRequest(
    String loginName,
    String mobile
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OperationsPasswordRecoveryStartRequest> {
    @Override
    public OperationsPasswordRecoveryStartRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OperationsPasswordRecoveryStartRequest) context.handleUnexpectedToken(OperationsPasswordRecoveryStartRequest.class, parser);
      String loginName = null;
      String mobile = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "property value is required");
        switch (property) {
          case "loginName" -> loginName = context.readValue(parser, String.class);
          case "mobile" -> mobile = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "object must end with END_OBJECT");
      if (loginName == null) return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "missing required property loginName");
      if (mobile == null) return context.reportInputMismatch(OperationsPasswordRecoveryStartRequest.class, "missing required property mobile");
      return new OperationsPasswordRecoveryStartRequest(loginName, mobile);
    }
  }
}
