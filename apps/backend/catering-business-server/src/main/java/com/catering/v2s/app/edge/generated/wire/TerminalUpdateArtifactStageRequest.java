// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateArtifactStageRequest.Deserializer.class)
public record TerminalUpdateArtifactStageRequest(
    String file,
    String sha256,
    String usage
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateArtifactStageRequest> {
    @Override
    public TerminalUpdateArtifactStageRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateArtifactStageRequest) context.handleUnexpectedToken(TerminalUpdateArtifactStageRequest.class, parser);
      String file = null;
      String sha256 = null;
      String usage = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "property value is required");
        switch (property) {
          case "file" -> file = context.readValue(parser, String.class);
          case "sha256" -> sha256 = context.readValue(parser, String.class);
          case "usage" -> usage = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "object must end with END_OBJECT");
      if (file == null) return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "missing required property file");
      if (sha256 == null) return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "missing required property sha256");
      if (usage == null) return context.reportInputMismatch(TerminalUpdateArtifactStageRequest.class, "missing required property usage");
      return new TerminalUpdateArtifactStageRequest(file, sha256, usage);
    }
  }
}
