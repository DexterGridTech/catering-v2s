// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OperationsPasswordRecoveryCompleteRequest.Deserializer.class)
public record OperationsPasswordRecoveryCompleteRequest(
    String newPassword
) {
  @Override
  public String toString() {
    return "OperationsPasswordRecoveryCompleteRequest["
        + "redacted=" + "[REDACTED]"
        + "]";
  }



  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OperationsPasswordRecoveryCompleteRequest> {
    @Override
    public OperationsPasswordRecoveryCompleteRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OperationsPasswordRecoveryCompleteRequest) context.handleUnexpectedToken(OperationsPasswordRecoveryCompleteRequest.class, parser);
      String newPassword = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OperationsPasswordRecoveryCompleteRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OperationsPasswordRecoveryCompleteRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OperationsPasswordRecoveryCompleteRequest.class, "property value is required");
        switch (property) {
          case "newPassword" -> newPassword = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OperationsPasswordRecoveryCompleteRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OperationsPasswordRecoveryCompleteRequest.class, "object must end with END_OBJECT");
      if (newPassword == null) return context.reportInputMismatch(OperationsPasswordRecoveryCompleteRequest.class, "missing required property newPassword");
      return new OperationsPasswordRecoveryCompleteRequest(newPassword);
    }
  }
}
