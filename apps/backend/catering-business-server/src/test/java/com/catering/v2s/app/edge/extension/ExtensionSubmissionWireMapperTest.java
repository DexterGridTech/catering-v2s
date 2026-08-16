package com.catering.v2s.app.edge.extension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ExtensionSubmissionWireMapperTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void mapsObjectValuesToSetAndClearIntent() throws Exception {
        ExtensionSubmission result =
                ExtensionSubmissionWireMapper.toSubmission(JSON.readTree("{\"remark\":\"test\",\"obsolete\":null}"));

        assertEquals(
                List.of(
                        new ExtensionSubmission.ExtensionFieldValue("remark", "\"test\"", ExtensionSubmission.Mode.SET),
                        ExtensionSubmission.ExtensionFieldValue.clear("obsolete")),
                result.fields());
    }

    @Test
    void preservesLegacyFieldListPayload() throws Exception {
        ExtensionSubmission result = ExtensionSubmissionWireMapper.toSubmission(
                JSON.readTree("[{\"fieldKey\":\"remark\",\"valueJson\":\"\\\"test\\\"\",\"mode\":\"SET\"}]"));

        assertEquals(
                List.of(new ExtensionSubmission.ExtensionFieldValue(
                        "remark", "\"test\"", ExtensionSubmission.Mode.SET)),
                result.fields());
    }

    @Test
    void rejectsMalformedPayloadShape() throws Exception {
        assertThrows(
                IllegalArgumentException.class, () -> ExtensionSubmissionWireMapper.toSubmission(JSON.readTree("[1]")));
    }
}
