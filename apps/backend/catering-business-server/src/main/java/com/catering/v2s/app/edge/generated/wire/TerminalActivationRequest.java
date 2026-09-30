// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalActivationRequest.Deserializer.class)
public record TerminalActivationRequest(
    String activationCode,
    String deviceId,
    String surfaceForm,
    String appVersion,
    String credentialSecret
) {
  @Override
  public String toString() {
    return "TerminalActivationRequest["
        + "redacted=" + "[REDACTED]"
        + ", deviceId=" + deviceId
        + ", surfaceForm=" + surfaceForm
        + ", appVersion=" + appVersion
        + ", redacted=" + "[REDACTED]"
        + "]";
  }


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalActivationRequest> {
    @Override
    public TerminalActivationRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalActivationRequest) context.handleUnexpectedToken(TerminalActivationRequest.class, parser);
      String activationCode = null;
      String deviceId = null;
      String surfaceForm = null;
      String appVersion = null;
      String credentialSecret = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalActivationRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalActivationRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalActivationRequest.class, "property value is required");
        switch (property) {
          case "activationCode" -> activationCode = context.readValue(parser, String.class);
          case "deviceId" -> deviceId = context.readValue(parser, String.class);
          case "surfaceForm" -> surfaceForm = context.readValue(parser, String.class);
          case "appVersion" -> appVersion = context.readValue(parser, String.class);
          case "credentialSecret" -> credentialSecret = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalActivationRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalActivationRequest.class, "object must end with END_OBJECT");
      if (activationCode == null) return context.reportInputMismatch(TerminalActivationRequest.class, "missing required property activationCode");
      if (deviceId == null) return context.reportInputMismatch(TerminalActivationRequest.class, "missing required property deviceId");
      if (surfaceForm == null) return context.reportInputMismatch(TerminalActivationRequest.class, "missing required property surfaceForm");
      if (appVersion == null) return context.reportInputMismatch(TerminalActivationRequest.class, "missing required property appVersion");
      if (credentialSecret == null) return context.reportInputMismatch(TerminalActivationRequest.class, "missing required property credentialSecret");
      return new TerminalActivationRequest(activationCode, deviceId, surfaceForm, appVersion, credentialSecret);
    }
  }
}
