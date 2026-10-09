// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateReportActual.Deserializer.class)
public record TerminalUpdateReportActual(
    tools.jackson.databind.JsonNode apkVersion,
    tools.jackson.databind.JsonNode nativeBuildNumber,
    String applicationId,
    String runtimeVersion,
    tools.jackson.databind.JsonNode jsVersion,
    tools.jackson.databind.JsonNode publicationId,
    tools.jackson.databind.JsonNode apkSha256,
    tools.jackson.databind.JsonNode bundleSha256,
    String entryKind,
    String unknownReason
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateReportActual> {
    @Override
    public TerminalUpdateReportActual deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateReportActual) context.handleUnexpectedToken(TerminalUpdateReportActual.class, parser);
      tools.jackson.databind.JsonNode apkVersion = null;
      tools.jackson.databind.JsonNode nativeBuildNumber = null;
      String applicationId = null;
      String runtimeVersion = null;
      tools.jackson.databind.JsonNode jsVersion = null;
      tools.jackson.databind.JsonNode publicationId = null;
      tools.jackson.databind.JsonNode apkSha256 = null;
      tools.jackson.databind.JsonNode bundleSha256 = null;
      String entryKind = null;
      String unknownReason = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateReportActual.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateReportActual.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateReportActual.class, "property value is required");
        switch (property) {
          case "apkVersion" -> apkVersion = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "nativeBuildNumber" -> nativeBuildNumber = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "applicationId" -> applicationId = context.readValue(parser, String.class);
          case "runtimeVersion" -> runtimeVersion = context.readValue(parser, String.class);
          case "jsVersion" -> jsVersion = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "publicationId" -> publicationId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "apkSha256" -> apkSha256 = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "bundleSha256" -> bundleSha256 = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          case "entryKind" -> entryKind = context.readValue(parser, String.class);
          case "unknownReason" -> unknownReason = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateReportActual.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateReportActual.class, "object must end with END_OBJECT");
      if (!seen.contains("apkVersion")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property apkVersion");
      if (!seen.contains("nativeBuildNumber")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property nativeBuildNumber");
      if (applicationId == null) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property applicationId");
      if (runtimeVersion == null) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property runtimeVersion");
      if (!seen.contains("jsVersion")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property jsVersion");
      if (!seen.contains("publicationId")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property publicationId");
      if (!seen.contains("apkSha256")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property apkSha256");
      if (!seen.contains("bundleSha256")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property bundleSha256");
      if (entryKind == null) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property entryKind");
      if (!seen.contains("unknownReason")) return context.reportInputMismatch(TerminalUpdateReportActual.class, "missing required property unknownReason");
      return new TerminalUpdateReportActual(apkVersion, nativeBuildNumber, applicationId, runtimeVersion, jsVersion, publicationId, apkSha256, bundleSha256, entryKind, unknownReason);
    }
  }
}
